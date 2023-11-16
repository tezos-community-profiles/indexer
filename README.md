# TCP Indexer

Indexer for the Tezos Community Profiles (TCP).

Free to use by anyone!

## Run

Coming soon!

```
docker ...
```

## Develop

```
psql -h db_host -U db_user -p 5432 -d tcp < db/schema.sql
cp ghostnet.env mywhatever.env
source mywhatever.env
npm start
```

## TODO

Missing stuff.

* Keep track of last_level_synced and only sync new items (waiting to tzkt to possibly add required /count endpoint)
* Support onchfs://

enjoy.
