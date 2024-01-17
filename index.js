import util from 'util'
import fetch from 'node-fetch'
import Sentry from '@sentry/node'
import { bytes2Char } from '@taquito/utils'
import {
  TZKT_API,
  BATCH_SIZE,
  INDEX_KEYS,
  TCP_CONTRACT,
  IPFS_ENDPOINT,
  SCRAPE_INTERVAL,
} from './config.js'
import { 
  get_client,
  get_ipfs_metadata 
} from './utils.js'
import './sentry.js'

/** HELPERS **/

let global_client = null
const debug = util.debuglog('TCP_INDEXER')

async function calc_batches({ bigmap, last_level_synced }) {
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

function debug_log_result_maybe(fulfilled, rejected) {
  const fulfilled_addresses = fulfilled.map(v => `OK: ${v.value.address} ${Object.keys(v.value).join(',')}`).join('\n')
  debug('\n'+fulfilled_addresses)
  const rejected_addresses = rejected.map(v => `ERROR: ${v.reason.message.split('\n')[0]}`).join('\n')
  debug('\n'+rejected_addresses)
}

async function store_profile(profile) {
  // Add created, updated
  await global_client.query(`
    insert into profiles (address, data) values ($1, $2)
    on conflict on constraint profiles_pkey
    do update set data=$2, time_updated=$3
  `, [profile.address, profile, new Date().getTime()]) 
}

async function handle_update(update) {
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
    await store_profile(profile)
    return profile
  } catch(e) {
    throw new Error(`Unable to update key: ${key?.key} ${e.message}`)
  }
}

async function fetch_keys_and_update({ bigmap, last_level_synced, batch }) {
  const updates = await fetch(`${TZKT_API}/v1/bigmaps/updates/?bigmap=${bigmap}&level.gt=${last_level_synced}&offset=${batch.start}&limit=${batch.end}`).then(r => r.json())
  const _updates = updates.map(u => handle_update(u))
  const results = await Promise.allSettled(_updates)
  return results
}

/** SYNC TCP **/

async function sync_tcp() {
  // TODO: CLEANUP!
  const head = await fetch(`${TZKT_API}/v1/head`).then(r => r.json())
  const level = head.level
  const config = await global_client.query(`select config from config`).then(r => r.rows[0]?.config || {})
  console.log(config)
  const tcp_storage = await fetch(`${TZKT_API}/v1/contracts/${TCP_CONTRACT}/storage`).then(r => r.json())
  const last_level_synced = config[TCP_CONTRACT]?.last_level_synced || 0
  const bigmap = tcp_storage?.profiles
  const batches = await calc_batches({ bigmap, last_level_synced })
  const batch_updates = batches.map(b => fetch_keys_and_update({ batch: b, bigmap, last_level_synced })) 
  const results = await Promise.allSettled(batch_updates)
  const all_res = results.reduce((coll, r) => coll.concat(r.value), [])
  const fulfilled = all_res.filter(r => r.status == 'fulfilled')
  const rejected = all_res.filter(r => r.status == 'rejected')
  console.log(`Successful updates: ${fulfilled.length}`)
  console.log(`Rejected updates: ${rejected.length}`)
  const config_updates = {}
  config_updates[TCP_CONTRACT] = {}
  config_updates[TCP_CONTRACT]['last_level_synced'] = level
  await global_client.query(`update config set config=$1`, [Object.assign({}, config, config_updates)])
  debug_log_result_maybe(fulfilled, rejected)
}

/** SCRAPE LOOP **/

async function scrape_loop() {
  console.log('-------')
  const client = get_client()
  try {
    await client.connect()
    global_client = client
    await sync_tcp(client)
    await client.end()
  } catch(e) {
    await client.end()
    console.error(e)
    Sentry.captureException(e)
  }
  setTimeout(scrape_loop, SCRAPE_INTERVAL)
}

scrape_loop()
