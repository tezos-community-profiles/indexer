CREATE TABLE IF NOT EXISTS profiles (
  address       varchar(100) primary key,
  time_updated  bigint default extract(epoch from now())*1000,
  time_created  bigint default extract(epoch from now())*1000,
  metadata      jsonb
);
