#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi
if [ ! -f .env.local ]; then
  echo "ERROR: .env.local is missing. Copy .env.example to .env.local and add DATABASE_URL first."
  exit 1
fi
echo "Starting NutreeNext Billing at http://localhost:3000"
npm run dev
