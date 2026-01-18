# Testing Facebook Ads Sync Service

This guide shows you how to test the sync service to ensure it properly handles changes to any Facebook ads fields.

## 🚀 Quick Test

### 1. Start the Service
```bash
# Using Docker (recommended)
docker-compose up -d

# Or locally
npm install
npm start
```

### 2. Run Automated Test
```bash
npm run test:sync
```

This will:
- Check service health
- Trigger a full sync
- Show sync statistics
- Verify everything is working

## 🧪 Manual Testing

### Test Real-time Sync

1. **Start the sync service:**
```bash
curl -X POST http://localhost:3000/api/sync/start
```

2. **Make changes to your MongoDB fb_ad collection:**
```javascript
// Example: Update an ad's status
db.fb_ad.updateOne(
  { "_id": ObjectId("68cd2e9b4370abd473d39009") },
  { 
    $set: { 
      "is_active": true,
      "status": "Active",
      "page_name": "Updated Page Name"
    }
  }
);

// Example: Add new keywords
db.fb_ad.updateOne(
  { "_id": ObjectId("68cd2e9b4370abd473d39009") },
  { 
    $push: { 
      "keywords": "New Keyword"
    }
  }
);

// Example: Update creative content
db.fb_ad.updateOne(
  { "_id": ObjectId("68cd2e9b4370abd473d39009") },
  { 
    $set: { 
      "creative.headline": "New Headline",
      "creative.body": "New body text"
    }
  }
);
```

3. **Watch the sync happen automatically!** The change stream will detect any field changes and sync them to OpenSearch.

### Test Full Sync

```bash
# Trigger full sync of all documents
curl -X POST http://localhost:3000/api/sync/full-sync \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 1000}'
```

### Check Sync Status

```bash
# Get current sync statistics
curl http://localhost:3000/api/sync/status
```

## 🔍 What Gets Synced

**ANY change to ANY field** will be automatically synced:

### Core Fields
- `ad_archive_id` ✅
- `page_id` ✅
- `page_name` ✅
- `advertiser_name` ✅
- `status` ✅
- `is_active` ✅

### Geographic Fields
- `countrySearchedfor` ✅
- `search_country` ✅
- `country` ✅
- `region` ✅
- `countrySearchedfor_all` ✅

### Platform Fields
- `platforms.facebook` ✅
- `platforms.instagram` ✅
- `platforms.messenger` ✅
- `platforms.audience_network` ✅
- `publisher_platform` ✅

### Creative Fields
- `creative.headline` ✅
- `creative.body` ✅
- `creative.cta_text` ✅
- `creative.image_url` ✅
- `creative.cards` ✅
- `snapshot.images` ✅
- `snapshot.videos` ✅
- `snapshot.cards` ✅

### Date Fields
- `start_date` ✅
- `end_date` ✅
- `started_running_on` ✅
- `scraped_at` ✅

### URL Fields
- `permalink_url` ✅
- `redirected_final_url` ✅
- `creative.link_url` ✅

### Metadata Fields
- `keywords` ✅
- `categories` ✅
- `page_categories` ✅
- `page_like_count` ✅
- `collation_id` ✅
- `contains_digital_created_media` ✅
- `contains_sensitive_content` ✅
- `is_profile_page` ✅
- `page_is_deleted` ✅

## 📊 Monitoring Sync Performance

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Detailed Statistics
```bash
curl http://localhost:3000/api/health/detailed
```

### Sync Statistics
```bash
curl http://localhost:3000/api/sync/status
```

## 🐛 Troubleshooting

### Sync Not Working?
1. Check if sync is running:
```bash
curl http://localhost:3000/api/sync/status
```

2. Start sync if needed:
```bash
curl -X POST http://localhost:3000/api/sync/start
```

3. Check MongoDB connection:
```bash
curl http://localhost:3000/api/health
```

### Performance Issues?
1. Check queue size:
```bash
curl http://localhost:3000/api/sync/status
```

2. Flush pending documents:
```bash
curl -X POST http://localhost:3000/api/sync/flush
```

### Data Not Appearing in OpenSearch?
1. Trigger full sync:
```bash
curl -X POST http://localhost:3000/api/sync/full-sync
```

2. Check OpenSearch directly:
```bash
curl http://localhost:9200/facebook-ads-read/_search?size=1
```

## 🎯 Test Scenarios

### Scenario 1: New Ad Insertion
```javascript
// Insert a new ad
db.fb_ad.insertOne({
  ad_archive_id: "123456789",
  page_id: "987654321",
  page_name: "Test Advertiser",
  is_active: true,
  countrySearchedfor: "US",
  keywords: ["test", "ad"],
  // ... other fields
});
```
**Expected:** Ad appears in OpenSearch within seconds

### Scenario 2: Field Updates
```javascript
// Update multiple fields
db.fb_ad.updateOne(
  { "ad_archive_id": "123456789" },
  { 
    $set: { 
      "is_active": false,
      "status": "Inactive",
      "page_name": "Updated Name",
      "keywords": ["updated", "keywords"]
    }
  }
);
```
**Expected:** All changes sync to OpenSearch

### Scenario 3: Nested Object Updates
```javascript
// Update creative content
db.fb_ad.updateOne(
  { "ad_archive_id": "123456789" },
  { 
    $set: { 
      "creative.headline": "New Headline",
      "creative.body": "New body text",
      "snapshot.title": "New Title"
    }
  }
);
```
**Expected:** Nested changes sync properly

### Scenario 4: Array Updates
```javascript
// Add to keywords array
db.fb_ad.updateOne(
  { "ad_archive_id": "123456789" },
  { 
    $push: { 
      "keywords": "new keyword",
      "publisher_platform": "MESSENGER"
    }
  }
);
```
**Expected:** Array changes sync correctly

## ✅ Verification

After making changes, verify in OpenSearch:

```bash
# Search for the updated document
curl -X POST http://localhost:9200/facebook-ads-read/_search \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "term": {
        "ad_archive_id": "123456789"
      }
    }
  }'
```

The sync service will efficiently handle **any changes to any fields** in your Facebook ads documents!
