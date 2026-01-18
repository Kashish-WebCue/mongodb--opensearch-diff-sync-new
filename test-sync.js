#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function testSync() {
  console.log('🧪 Testing Facebook Ads Sync Service...\n');

  try {
    // 1. Check health
    console.log('1. Checking service health...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health:', healthResponse.data.status);
    console.log('   MongoDB:', healthResponse.data.mongodb?.status || 'N/A');
    console.log('   OpenSearch:', healthResponse.data.opensearch?.status || 'N/A');
    console.log('');

    // 2. Check sync status
    console.log('2. Checking sync status...');
    const statusResponse = await axios.get(`${BASE_URL}/sync/status`);
    console.log('✅ Sync Running:', statusResponse.data.isRunning);
    console.log('   Documents Processed:', statusResponse.data.stats?.documentsProcessed || 0);
    console.log('   Errors:', statusResponse.data.stats?.errors || 0);
    console.log('');

    // 3. Trigger full sync
    console.log('3. Triggering full sync...');
    const fullSyncResponse = await axios.post(`${BASE_URL}/sync/full-sync`, {
      batchSize: 100
    });
    console.log('✅ Full Sync Result:', fullSyncResponse.data);
    console.log('');

    // 4. Check updated status
    console.log('4. Checking updated sync status...');
    const updatedStatusResponse = await axios.get(`${BASE_URL}/sync/status`);
    console.log('✅ Updated Stats:');
    console.log('   Documents Processed:', updatedStatusResponse.data.stats?.documentsProcessed || 0);
    console.log('   Queue Size:', updatedStatusResponse.data.stats?.bulkProcessor?.queueSize || 0);
    console.log('   Last Sync:', updatedStatusResponse.data.stats?.lastSync || 'N/A');
    console.log('');

    // 5. Get detailed health
    console.log('5. Getting detailed health info...');
    const detailedHealthResponse = await axios.get(`${BASE_URL}/health/detailed`);
    console.log('✅ Detailed Health:');
    console.log('   MongoDB Collections:', detailedHealthResponse.data.mongodb?.collections || 'N/A');
    console.log('   OpenSearch Index:', detailedHealthResponse.data.opensearch?.status || 'N/A');
    console.log('   Sync Queue:', detailedHealthResponse.data.stats?.bulkProcessor?.queueSize || 0);
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Make changes to your MongoDB ads collection');
    console.log('   2. Watch the sync service automatically detect and sync changes');
    console.log('   3. Query OpenSearch to see the updated data');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure the service is running: npm start');
    console.log('   2. Check MongoDB and OpenSearch are accessible');
    console.log('   3. Verify environment configuration');
  }
}

// Run the test
testSync();
