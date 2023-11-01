#!/bin/sh
NAME=tcp-postgres
docker stop $NAME
docker run --rm --name $NAME \
-p 5432:5432 \
-e POSTGRES_PASSWORD=postgres \
-v $(pwd)/.data/psql/tcp:/var/lib/postgresql/data \
-it postgres:14.6 
