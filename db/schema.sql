CREATE TABLE IF NOT EXISTS profiles (
  address       varchar(100) primary key,
  time_updated  bigint default extract(epoch from now())*1000,
  time_created  bigint default extract(epoch from now())*1000,
  data          jsonb
);

/* Config table for storing `last_level_synced` */

CREATE TABLE IF NOT EXISTS config (
  config json
);
