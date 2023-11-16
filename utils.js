import pg from 'pg'
import fetch from 'node-fetch'
import {
  PG_HOST, 
  PG_PORT,
  PG_USER,
  PG_PASS,
  PG_NAME,
  IPFS_ENDPOINT,
  METADATA_FETCH_TIMEOUT
} from './config.js'

export const sleep = ms => new Promise(r => setTimeout(r, ms))

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


