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

# Not `npm run start`: that script sets NODE_OPTIONS itself, which would
# replace whatever is set here rather than add to it.
#
# The heap ceiling matters on a 512 MB instance. Left to itself Node sizes its
# heap from the *machine's* memory, not the container's limit, so it will
# happily grow past 512 MB and be killed outright — which looks like a random
# crash with nothing in the log. Told where the ceiling is, it collects garbage
# harder instead and stays alive.
export NODE_OPTIONS="--no-deprecation --max-old-space-size=384"

echo "  starting the server"
exec npx next start
