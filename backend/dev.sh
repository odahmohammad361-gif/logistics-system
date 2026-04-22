#!/bin/bash
# Start backend via Unix socket (bypasses Nekoray TUN mode)
export SECRET_KEY="dev-secret-key-for-migrations"
export DATABASE_URL="postgresql://logistics_user:logistics_pass@127.0.0.1:5432/logistics_db"
export NO_PROXY="127.0.0.1,localhost"

echo "Starting backend on Unix socket: /tmp/logistics.sock"
echo "Test with: curl --unix-socket /tmp/logistics.sock http://localhost/api/..."
uvicorn app.main:app --uds /tmp/logistics.sock --reload
