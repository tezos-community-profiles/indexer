import {
  PG_HOST,
  PG_PORT,
  PG_USER,
  PG_PASS,
  PG_NAME
} from './config.js'

let client = null;
export const get_client = () => client
export const set_client = (c) => { client = c; }

export const get_new_client = function() {
  return new pg.Client({
    host     : PG_HOST,
    port     : PG_PORT,
    user     : PG_USER,
    password : PG_PASS,
    database : PG_NAME
  })
}
