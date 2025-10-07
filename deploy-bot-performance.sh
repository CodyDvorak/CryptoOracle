#!/bin/bash

echo "🚀 Deploying bot-performance edge function..."

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Deploy the function
echo "📦 Deploying bot-performance function..."
supabase functions deploy bot-performance

echo "✅ Deployment complete!"
echo ""
echo "🧪 Test the function:"
echo "curl https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/bot-performance \\"
echo "  -H 'Authorization: Bearer YOUR_ANON_KEY' \\"
echo "  -H 'apikey: YOUR_ANON_KEY'"
