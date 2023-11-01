import fetch from 'node-fetch'
//import ohash from 'object-hash'
//import Sentry from '@sentry/node'
//import { promises as fs } from 'fs'
import { bytes2Char } from '@taquito/utils'
//import { Parser, unpackDataBytes } from '@taquito/michel-codec'
import {
  TZKT_API,
  TCP_CONTRACT,
  IPFS_ENDPOINT,
  SCRAPE_INTERVAL,
} from './config.js'
import { 
  get_ipfs_metadata 
} from './utils.js'
//import './sentry.js'

/** HELPERS **/

async function calc_batches() {
  const tcp_storage = await fetch(`${TZKT_API}/v1/contracts/${TCP_CONTRACT}/bigmaps/profiles`).then(r => r.json())
  // TODO: Get # of updates since last_level_synced (to calc batches needed) for now we just assume all activeKeys have been updates
  const num_updated_keys = tcp_storage?.activeKeys 
  const batch_size = 1000
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
  } catch(e) {
    throw new Error(`Unable to update key: ${key?.key}\n${e.message}`)
  }
}

async function fetch_keys_and_update(batch) {
  const keys = await fetch(`${TZKT_API}/v1/contracts/${TCP_CONTRACT}/bigmaps/profiles/keys?offset=${batch.start}&limit=${batch.end}`).then(r => r.json())
  const key_updates = keys.map(key => update_key(key))
  const results = await Promise.allSettled(key_updates)
  results.forEach(r => { if (r.status === 'rejected') throw r.reason })
}

/** SYNC TCP **/

async function sync_tcp() {
  const batches = await calc_batches()
  const batch_updates = batches.map(b => fetch_keys_and_update(b)) 
  const results = await Promise.allSettled(batch_updates)
  // TODO: Handle results. List num_successful + num_errors and optionally list errors via debug_log ?
  console.log('fullsync results', results)
}

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
