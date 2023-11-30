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
cp ghostnet.env myconfig.env
source myconfig.env
npm start
```

## TODO

Missing stuff.

* Keep track of last_level_synced and only sync new items (waiting to tzkt to possibly add required /count endpoint)
* Content-Length verification before fetching and storing content
* Support onchfs://
* Use @tcp/schemas to validate indexed keys

enjoy.
