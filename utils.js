import pg from 'pg'
import fetch from 'node-fetch'
import {
  PG_HOST, 
  PG_PORT,
  PG_USER,
  PG_PASS,
  PG_NAME,
  TZKT_API,
  BATCH_SIZE,
  TCP_CONTRACT,
  IPFS_ENDPOINT,
  METADATA_FETCH_TIMEOUT
} from './config.js'

export const sleep = ms => new Promise(r => setTimeout(r, ms))
export const get_head = async () => (await fetch(`${TZKT_API}/v1/head`).then(r => r.json()))
export const get_config = async ({ client }) => (await client.query(`select config from config`).then(r => r.rows[0]?.config || {}))

export const get_client = function() {
  return new pg.Client({
    host     : PG_HOST, 
    port     : PG_PORT,
    user     : PG_USER,
    password : PG_PASS,
    database : PG_NAME
  })
}

export async function get_ipfs_metadata(ipfs_cid) {
  const controller = new AbortController();
  const timeout = setTimeout(() => { controller.abort() }, METADATA_FETCH_TIMEOUT)
  const ipfs_res = await fetch(`${IPFS_ENDPOINT}/${ipfs_cid}`, { signal: controller.signal })
  const metadata = await ipfs_res.json()
  return metadata
}

export async function update_config({ client, config, level }) {
  const config_updates = {}
  config_updates[TCP_CONTRACT] = {}
  config_updates[TCP_CONTRACT]['last_level_synced'] = level
  const updated_config = Object.assign({}, config, config_updates)
  await client.query(`update config set config=$1`, [updated_config])
  return updated_config
}

export async function calc_batches({ bigmap, last_level_synced }) {
  const updated_keys = await fetch(`${TZKT_API}/v1/bigmaps/updates/count?bigmap=${bigmap}&level.gt=${last_level_synced}`).then(r => r.text())
  const num_updated_keys = parseInt(updated_keys) 
  const batch_size = BATCH_SIZE
  const num_batches = Math.ceil(num_updated_keys / batch_size)
  const batches = Array.from(new Array(num_batches)).map((_, i) => {
    let start = i*batch_size
    let end = start+batch_size
    if (end > num_updated_keys) end = num_updated_keys
    return { start, end }
  })
  return batches
}

async function store_profile({ client, profile }) {
  await client.query(`
    insert into profiles (address, data) values ($1, $2)
    on conflict on constraint profiles_pkey
    do update set data=$2, time_updated=$3
  `, [profile.address, profile, new Date().getTime()]) 
}

async function handle_update({ client, update }) {
  try {
    const address = update.content.key
    const values = {}
    for (let ikey of INDEX_KEYS) {
      if (!update.content.value[ikey]) continue
      const char = bytes2Char(update.content.value[ikey])
      const [protocol, hash] = char.split('://')
      const data = await get_ipfs_metadata(hash) // TODO: Support more protocols 
      values[ikey] = data
    }
    const profile = { address, ...values }
    await store_profile({ client, profile })
    return profile
  } catch(e) {
    throw new Error(`Unable to update key: ${key?.key} ${e.message}`)
  }
}

async function fetch_keys_and_update({ client, bigmap, last_level_synced, batch }) {
  const updates = await fetch(`${TZKT_API}/v1/bigmaps/updates/?bigmap=${bigmap}&level.gt=${last_level_synced}&offset=${batch.start}&limit=${batch.end}`).then(r => r.json())
  const _updates = updates.map(update => handle_update({ client, update }))
  const results = await Promise.allSettled(_updates)
  return results
}

export async function update_since({ client, last_level_synced }) {
  const tcp_storage = await fetch(`${TZKT_API}/v1/contracts/${TCP_CONTRACT}/storage`).then(r => r.json())
  const bigmap = tcp_storage?.profiles
  const batches = await calc_batches({ bigmap, last_level_synced })
  const batch_updates = batches.map(b => fetch_keys_and_update({ batch: b, client, bigmap, last_level_synced })) 
  const results = await Promise.allSettled(batch_updates)
  const all_res = results.reduce((coll, r) => coll.concat(r.value), [])
  const fulfilled = all_res.filter(r => r.status == 'fulfilled')
  const rejected = all_res.filter(r => r.status == 'rejected')
  return { fulfilled, rejected }
}
