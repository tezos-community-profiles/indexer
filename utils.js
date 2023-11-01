import pg from 'pg'
import fetch from 'node-fetch'
import {
  IPFS_ENDPOINT,
  METADATA_FETCH_TIMEOUT
} from './config.js'

export const sleep = ms => new Promise(r => setTimeout(r, ms))

export async function get_ipfs_metadata(ipfs_cid) {
  const controller = new AbortController();
  const timeout = setTimeout(() => { controller.abort() }, METADATA_FETCH_TIMEOUT)
  const ipfs_res = await fetch(`${IPFS_ENDPOINT}/${ipfs_cid}`, { signal: controller.signal })
  const metadata = await ipfs_res.json()
  return metadata
}

