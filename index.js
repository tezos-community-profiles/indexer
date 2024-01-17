import util from 'util'
import fetch from 'node-fetch'
import Sentry from '@sentry/node'
import { bytes2Char } from '@taquito/utils'
import {
  TZKT_API,
  INDEX_KEYS,
  TCP_CONTRACT,
  IPFS_ENDPOINT,
  SCRAPE_INTERVAL,
} from './config.js'
import { 
  get_head,
  get_client,
  get_config,
  update_since,
  update_config,
  get_ipfs_metadata 
} from './utils.js'
import './sentry.js'

/** LOGGING **/

const debug = util.debuglog('TCP_INDEXER')

function debug_log_result_maybe({ fulfilled, rejected }) {
  const fulfilled_addresses = fulfilled.map(v => `OK: ${v.value.address} ${Object.keys(v.value).join(',')}`).join('\n')
  debug('\n'+fulfilled_addresses)
  const rejected_addresses = rejected.map(v => `ERROR: ${v.reason.message.split('\n')[0]}`).join('\n')
  debug('\n'+rejected_addresses)
}

function log_result({ config, updated_config, fulfilled, rejected }) {
  console.log(`Last level synced: ${config[TCP_CONTRACT]?.last_level_synced}`)
  console.log(`Successful updates: ${fulfilled.length}`)
  console.log(`Rejected updates: ${rejected.length}`)
  console.log(`Current level synced: ${updated_config[TCP_CONTRACT]?.last_level_synced}`)
  debug_log_result_maybe({ fulfilled, rejected })
}

/** SYNC TCP **/

async function sync_tcp({ client }) {
  const head = await get_head() 
  const config = await get_config({ client }) 
  const last_level_synced = config[TCP_CONTRACT]?.last_level_synced || 0
  const { fulfilled, rejected } = await update_since({ client, last_level_synced })
  const updated_config = await update_config({ client, config, level: head.level })
  log_result({ config, updated_config, fulfilled, rejected })
}

/** SCRAPE LOOP **/

async function scrape_loop() {
  console.log(`\n--- TCP ${new Date()} ---\n`)
  const client = get_client()
  try {
    await client.connect()
    await sync_tcp({ client })
    await client.end()
  } catch(e) {
    await client.end()
    console.error(e)
    Sentry.captureException(e)
  }
  setTimeout(scrape_loop, SCRAPE_INTERVAL)
}

scrape_loop()
