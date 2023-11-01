CREATE TABLE IF NOT EXISTS profiles (
  address   varchar(100) primary key,
  metadata  jsonb
);

CREATE TABLE IF NOT EXISTS config (
  config json
);
