import util from 'util'
import fetch from 'node-fetch'
//import ohash from 'object-hash'
//import Sentry from '@sentry/node'
//import { promises as fs } from 'fs'
import { bytes2Char } from '@taquito/utils'
//import { Parser, unpackDataBytes } from '@taquito/michel-codec'
import {
  TZKT_API,
  BATCH_SIZE,
  TCP_CONTRACT,
  IPFS_ENDPOINT,
  SCRAPE_INTERVAL,
} from './config.js'
import { 
  get_ipfs_metadata 
} from './utils.js'
//import './sentry.js'

/** HELPERS **/

const debug = util.debuglog('TCP_API')

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

async function update_key(key) {
  try {
    const address = key.key
    const profile = bytes2Char(key.value[''])
    const [protocol, hash] = profile.split('://')
    const profile_data = await get_ipfs_metadata(hash) 
    // TODO: Update database
    return { address, profile }
  } catch(e) {
    throw new Error(`Unable to update key: ${key?.key}\n${e.message}`)
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
  const fulfilled_addresses = fulfilled.map(v => v.value.address).join('\n')
  debug(fulfilled_addresses)
  console.log(`Rejected updates: ${rejected.length}`)
  const rejected_addresses = rejected.map(v => v.reason.message.split('\n')[0].split(': ')[1]).join('\n')
  debug(rejected_addresses)
}

/** SCRAPE LOOP **/

async function scrape_loop() {
  console.log('-------')
  try {
    await sync_tcp() 
  } catch(e) {
    console.error(e)
//    Sentry.captureException(e)
  }
  setTimeout(scrape_loop, SCRAPE_INTERVAL)
}

scrape_loop()
