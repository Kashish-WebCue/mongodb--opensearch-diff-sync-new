#!/bin/bash

echo "🚀 Facebook Ads OpenSearch Sync - Quick Start"
echo "=============================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "✅ .env file created with DigitalOcean configuration"
    echo ""
    echo "🔧 Configuration:"
    echo "   MongoDB: selauto.fb_ad collection"
    echo "   OpenSearch: DigitalOcean cluster"
    echo "   Index: facebook-ads-hot"
    echo ""
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create logs directory
mkdir -p logs

echo ""
echo "🎯 Ready to start! Choose your option:"
echo ""
echo "1. Start with Docker:"
echo "   docker-compose up -d"
echo ""
echo "2. Start locally:"
echo "   npm start"
echo ""
echo "3. Run tests:"
echo "   npm run test:sync"
echo ""
echo "📊 Monitor at: http://localhost:3000/api/health"
echo "🔄 Sync status: http://localhost:3000/api/sync/status"
echo ""
echo "Happy syncing! 🎉"
