import util from 'util'
import fetch from 'node-fetch'
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
//import './sentry.js'

/** HELPERS **/

let global_client = null
const debug = util.debuglog('TCP_INDEXER')

async function calc_batches() {
  const tcp_storage = await fetch(`${TZKT_API}/v1/contracts/${TCP_CONTRACT}/bigmaps/profiles`).then(r => r.json())
  // TODO: Get # of updates since last_level_synced (to calc batches needed) for now we just assume all activeKeys have been updates
  const num_updated_keys = tcp_storage?.activeKeys 
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

async function update_key(key) {
  try {
    const address = key.key
    const values = {}
    for (let ikey of INDEX_KEYS) {
      if (!key.value[ikey]) continue
      const char = bytes2Char(key.value[ikey])
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

async function fetch_keys_and_update(batch) {
  const keys = await fetch(`${TZKT_API}/v1/contracts/${TCP_CONTRACT}/bigmaps/profiles/keys?offset=${batch.start}&limit=${batch.end}`).then(r => r.json())
  const key_updates = keys.map(key => update_key(key))
  const results = await Promise.allSettled(key_updates)
  return results
}

/** SYNC TCP **/

async function sync_tcp() {
  const batches = await calc_batches()
  const batch_updates = batches.map(b => fetch_keys_and_update(b)) 
  const results = await Promise.allSettled(batch_updates)
  const all_res = results.reduce((coll, r) => coll.concat(r.value), [])
  const fulfilled = all_res.filter(r => r.status == 'fulfilled')
  const rejected = all_res.filter(r => r.status == 'rejected')
  console.log(`Successful updates: ${fulfilled.length}`)
  console.log(`Rejected updates: ${rejected.length}`)
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
//    Sentry.captureException(e)
  }
  setTimeout(scrape_loop, SCRAPE_INTERVAL)
}

scrape_loop()
