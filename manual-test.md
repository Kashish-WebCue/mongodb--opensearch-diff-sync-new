# Manual MongoDB Sync Test

This guide will help you manually test the sync by creating a document and making changes.

## Prerequisites

1. **Start the sync service:**
```bash
npm start
```

2. **In another terminal, run the automated test:**
```bash
npm run test:mongodb
```

## Manual Testing Steps

### Step 1: Connect to MongoDB

Connect to your DigitalOcean MongoDB using MongoDB Compass or mongosh:

**Connection String:**
```
mongodb+srv://doadmin:52e3T4p1u89cXKn6@webcue-data-e8122b46.mongo.ondigitalocean.com/selauto?tls=true&authSource=admin&replicaSet=webcue-data
```

**Database:** `selauto`
**Collection:** `fb_ad`

### Step 2: Create Test Document

Insert this document into the `fb_ad` collection:

```javascript
db.fb_ad.insertOne({
  ad_archive_id: "TEST_" + Date.now(),
  page_id: "TEST_PAGE_" + Date.now(),
  page_name: "Testing sync",
  advertiser_name: "Testing sync",
  status: "Active",
  is_active: true,
  started_running_on: new Date().toISOString(),
  start_date: Math.floor(Date.now() / 1000),
  end_date: Math.floor(Date.now() / 1000) + 86400,
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
});
```

**Note the `_id` of the inserted document for the next step.**

### Step 3: Check Sync Status

Check if the sync service detected the new document:

```bash
curl http://localhost:3000/api/sync/status
```

### Step 4: Make Changes

Update the document with "Test1" changes (replace `YOUR_DOCUMENT_ID` with the actual `_id`):

```javascript
db.fb_ad.updateOne(
  { _id: ObjectId("YOUR_DOCUMENT_ID") },
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
```

### Step 5: Verify Sync

1. **Check sync status again:**
```bash
curl http://localhost:3000/api/sync/status
```

2. **Check OpenSearch directly:**
```bash
curl -X POST http://localhost:9200/facebook-ads-read/_search \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "term": {
        "page_name": "Test1"
      }
    }
  }'
```

### Step 6: Clean Up

Delete the test document:

```javascript
db.fb_ad.deleteOne({ _id: ObjectId("YOUR_DOCUMENT_ID") });
```

## Expected Results

✅ **Document Creation:** New document should appear in OpenSearch within seconds
✅ **Document Update:** Changes should sync automatically
✅ **Field Changes:** All modified fields should be updated in OpenSearch
✅ **Nested Objects:** Changes in `creative` and `snapshot` should sync
✅ **Arrays:** Changes to `keywords` array should sync

## Troubleshooting

### Sync Not Working?
1. Check if sync service is running: `curl http://localhost:3000/api/health`
2. Start sync: `curl -X POST http://localhost:3000/api/sync/start`
3. Check MongoDB connection in health response

### Changes Not Appearing?
1. Wait a few seconds for sync to process
2. Check sync queue: `curl http://localhost:3000/api/sync/status`
3. Flush pending changes: `curl -X POST http://localhost:3000/api/sync/flush`

### OpenSearch Connection Issues?
1. Verify OpenSearch URL and credentials in `.env`
2. Check OpenSearch cluster health
3. Ensure index exists: `curl http://localhost:9200/facebook-ads-read/_mapping`
