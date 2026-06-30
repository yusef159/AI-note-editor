#!/bin/sh
set -e

DATA_DIR="/app/data"
NOTES_DIR="${NOTES_DATA_DIR:-/app/data/notes}"

mkdir -p "$DATA_DIR" "$NOTES_DIR"
chown -R nextjs:nodejs "$DATA_DIR"

exec gosu nextjs "$@"
