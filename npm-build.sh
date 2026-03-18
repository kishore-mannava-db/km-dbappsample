#!/bin/bash
set -e

echo "=== Building Lakebase Track Frontend ==="

cd "$(dirname "$0")/frontend"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "Building React app..."
npm run build

echo "=== Build complete! Output in frontend/build/ ==="
