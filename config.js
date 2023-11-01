import { config } from 'tiny-env-config'

export const PG_HOST = config('PG_HOST', '')
export const PG_PORT = config('PG_HORT', '')
export const PG_NAME = config('PG_NAME', '')
export const PG_USER = config('PG_USER', '')
export const PG_PASS = config('PG_PASS', '')
export const TZKT_API = config('TZKT_API', '')
export const SENTRY_DSN = config('SENTRY_DSN', '')
export const TCP_CONTRACT = config('TCP_CONTRACT', '')
export const IPFS_ENDPOINT = config('IPFS_ENDPOINT', '')
export const SCRAPE_INTERVAL = config('SCRAPE_INTERVAL', 5000)
export const TEZOS_NETWORK_NAME = config('NETWORK_NAME', '')
export const METADATA_FETCH_TIMEOUT = config('METADATA_FETCH_TIMEOUT', 2000)