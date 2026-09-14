#!/bin/sh
#
# Starts the demo.
#
# Three things happen before the server does: the data directory is seeded if
# it is empty, an administrator is created if there is not one, and only then
# does Next.js start.
#
# `set -e` matters here. If the administrator cannot be created the container
# must die, not carry on and serve a site whose /admin offers its "create the
# first user" screen to the first stranger who finds it.

set -e

DATA_DIR="${DATA_DIR:-/data}"

mkdir -p "$DATA_DIR"

# First boot on a fresh disk: copy the demo content across. On every boot after
# that these are already there, and whatever has been edited through the admin
# panel since is left alone.
if [ ! -f "$DATA_DIR/diocese.db" ]; then
  echo "  seeding $DATA_DIR/diocese.db"
  cp /app/demo-data/diocese.db "$DATA_DIR/diocese.db"
fi

if [ ! -d "$DATA_DIR/media" ]; then
  echo "  seeding $DATA_DIR/media"
  cp -r /app/seed-media "$DATA_DIR/media"
fi

if [ ! -d "$DATA_DIR/documents" ]; then
  echo "  seeding $DATA_DIR/documents"
  cp -r /app/seed-documents "$DATA_DIR/documents"
fi

echo "  checking for an administrator account"
npx payload run scripts/ensure-admin.ts

echo "  starting the server"
exec npm run start
