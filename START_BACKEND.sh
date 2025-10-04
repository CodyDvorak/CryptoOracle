#!/bin/bash

# Crypto Oracle Backend Startup Script
# This script starts the FastAPI backend server with the virtual environment

echo "🚀 Starting Crypto Oracle Backend..."
echo ""

# Navigate to backend directory
cd "$(dirname "$0")/backend"

# Check if virtual environment exists
if [ ! -d "/tmp/cc-agent/57997993/venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Run: python3 -m venv /tmp/cc-agent/57997993/venv"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found in backend directory!"
    exit 1
fi

# Start the server
echo "Starting uvicorn server..."
echo "API Docs will be available at: http://localhost:8000/docs"
echo ""

/tmp/cc-agent/57997993/venv/bin/uvicorn server:app --reload --host 0.0.0.0 --port 8000
