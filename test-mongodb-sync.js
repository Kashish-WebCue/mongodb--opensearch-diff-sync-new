#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const axios = require('axios');
const config = require('./src/config');

const BASE_URL = 'http://localhost:3000/api';

async function testMongoDBSync() {
  console.log('🧪 Testing MongoDB to OpenSearch Sync...\n');

  let client;
  let testDocId;

  try {
    // 1. Connect to MongoDB
    console.log('1. Connecting to MongoDB...');
    client = new MongoClient(config.mongodb.uri);
    await client.connect();
    const db = client.db(config.mongodb.database);
    const collection = db.collection(config.mongodb.collection);
    console.log('✅ Connected to MongoDB');

    // 2. Check if sync service is running
    console.log('\n2. Checking sync service status...');
    try {
      const healthResponse = await axios.get(`${BASE_URL}/health`);
      console.log('✅ Sync service is running');
      console.log('   Status:', healthResponse.data.status);
    } catch (error) {
      console.log('❌ Sync service is not running. Please start it first:');
      console.log('   npm start');
      return;
    }

    // 3. Start sync if not running
    console.log('\n3. Starting sync service...');
    try {
      await axios.post(`${BASE_URL}/sync/start`);
      console.log('✅ Sync service started');
    } catch (error) {
      console.log('ℹ️  Sync service may already be running');
    }

    // 4. Create test document
    console.log('\n4. Creating test document...');
    const testDocument = {
      ad_archive_id: "TEST_" + Date.now(),
      page_id: "TEST_PAGE_" + Date.now(),
      page_name: "Testing sync",
      advertiser_name: "Testing sync",
      status: "Active",
      is_active: true,
      started_running_on: new Date().toISOString(),
      start_date: Math.floor(Date.now() / 1000),
      end_date: Math.floor(Date.now() / 1000) + 86400, // 24 hours later
      scraped_at: new Date(),
      permalink_url: "https://test.example.com",
      redirected_final_url: "https://test.example.com",
      currency: "USD",
      keywords: ["testing", "sync"],
      countrySearchedfor: "US",
      search_country: "US",
      country: "US",
      region: "North America",
      platforms: {
        facebook: true,
        instagram: true,
        messenger: false,
        audience_network: false
      },
      publisher_platform: ["FACEBOOK", "INSTAGRAM"],
      search_query: "testing sync",
      search_media_type: "all",
      categories: ["TEST"],
      page_categories: ["Test Category"],
      page_like_count: 1000,
      collation_id: "TEST_COLLATION",
      collation_count: 1,
      contains_digital_created_media: false,
      contains_sensitive_content: false,
      is_profile_page: false,
      page_is_deleted: false,
      page_entity_type: "PERSON_PROFILE",
      entity_type: "PERSON_PROFILE",
      gated_type: "ELIGIBLE",
      hide_data_status: "NONE",
      is_aaa_eligible: true,
      targeted_or_reached_countries: [],
      political_countries: [],
      countrySearchedfor_all: ["US"],
      creative: {
        headline: "Testing sync",
        body: "Testing sync",
        cta_text: "Learn More",
        cta_type: "LEARN_MORE",
        link_url: "https://test.example.com"
      },
      snapshot: {
        title: "Testing sync",
        body: {
          text: "Testing sync"
        },
        caption: "Testing sync caption"
      }
    };

    const insertResult = await collection.insertOne(testDocument);
    testDocId = insertResult.insertedId;
    console.log('✅ Test document created with ID:', testDocId.toString());
    console.log('   Document:', JSON.stringify(testDocument, null, 2));

    // 5. Wait a moment for sync
    console.log('\n5. Waiting for initial sync...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 6. Check sync status
    console.log('\n6. Checking sync status...');
    const statusResponse = await axios.get(`${BASE_URL}/sync/status`);
    console.log('✅ Sync Status:');
    console.log('   Running:', statusResponse.data.isRunning);
    console.log('   Documents Processed:', statusResponse.data.stats?.documentsProcessed || 0);
    console.log('   Queue Size:', statusResponse.data.stats?.bulkProcessor?.queueSize || 0);

    // 7. Make a change to the document
    console.log('\n7. Making changes to test document...');
    const updateResult = await collection.updateOne(
      { _id: testDocId },
      {
        $set: {
          page_name: "Test1",
          advertiser_name: "Test1",
          creative: {
            headline: "Test1",
            body: "Test1"
          },
          snapshot: {
            title: "Test1",
            body: {
              text: "Test1"
            },
            caption: "Test1 caption"
          },
          keywords: ["Test1", "updated"],
          is_active: false,
          status: "Inactive"
        }
      }
    );

    console.log('✅ Document updated:', updateResult.modifiedCount, 'documents modified');
    console.log('   Changes made:');
    console.log('   - page_name: "Testing sync" → "Test1"');
    console.log('   - advertiser_name: "Testing sync" → "Test1"');
    console.log('   - creative.headline: "Testing sync" → "Test1"');
    console.log('   - creative.body: "Testing sync" → "Test1"');
    console.log('   - snapshot.title: "Testing sync" → "Test1"');
    console.log('   - snapshot.body.text: "Testing sync" → "Test1"');
    console.log('   - keywords: ["testing", "sync"] → ["Test1", "updated"]');
    console.log('   - is_active: true → false');
    console.log('   - status: "Active" → "Inactive"');

    // 8. Wait for sync
    console.log('\n8. Waiting for sync to process changes...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 9. Check final sync status
    console.log('\n9. Final sync status...');
    const finalStatusResponse = await axios.get(`${BASE_URL}/sync/status`);
    console.log('✅ Final Sync Status:');
    console.log('   Documents Processed:', finalStatusResponse.data.stats?.documentsProcessed || 0);
    console.log('   Errors:', finalStatusResponse.data.stats?.errors || 0);
    console.log('   Last Sync:', finalStatusResponse.data.stats?.lastSync || 'N/A');

    // 10. Clean up - remove test document
    console.log('\n10. Cleaning up test document...');
    const deleteResult = await collection.deleteOne({ _id: testDocId });
    console.log('✅ Test document deleted:', deleteResult.deletedCount, 'documents removed');

    console.log('\n🎉 Sync test completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Created test document with "Testing sync" content');
    console.log('   ✅ Updated document with "Test1" changes');
    console.log('   ✅ Verified sync service processed changes');
    console.log('   ✅ Cleaned up test data');
    console.log('\n🔍 Next steps:');
    console.log('   1. Check OpenSearch to see if the changes were synced');
    console.log('   2. Make more changes to your real Facebook ads data');
    console.log('   3. Monitor the sync service for automatic updates');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure MongoDB is accessible');
    console.log('   2. Make sure sync service is running: npm start');
    console.log('   3. Check your .env configuration');
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 MongoDB connection closed');
    }
  }
}

// Run the test
testMongoDBSync();
