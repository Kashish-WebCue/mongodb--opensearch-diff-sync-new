# Reconciliation Service - Setup Complete! 🎉

## What Was Created

### 1. **Reconciliation Service** (`src/services/reconciliationService.js`)
A smart background service that automatically:
- Checks for document count differences between MongoDB and OpenSearch
- Identifies which specific documents are missing
- Syncs ONLY the missing documents (not everything)
- Runs on a configurable schedule (default: every 30 minutes)

### 2. **API Routes** (`src/routes/reconciliation.js`)
Four endpoints to control the service:
- `POST /api/reconciliation/start` - Start the service
- `POST /api/reconciliation/stop` - Stop the service
- `GET /api/reconciliation/status` - Check service statistics
- `POST /api/reconciliation/check` - Trigger immediate check/sync

### 3. **Configuration** (in `src/config/index.js`)
```javascript
reconciliation: {
  enabled: true,                    // Auto-start on server startup
  checkIntervalMs: 1800000,         // Check every 30 minutes
  startupDelayMs: 120000            // Wait 2 minutes after startup
}
```

### 4. **Server Integration** (`src/server.js`)
- Automatically initializes with the server
- Starts in the background
- Graceful shutdown support

### 5. **Documentation**
- `RECONCILIATION.md` - Complete user guide
- `test-reconciliation.sh` - Test script

## Key Features

### ✅ Smart Sync (Not Full Sync)
```
Instead of syncing ALL 1,967 documents:
1. Fetches all IDs from MongoDB and OpenSearch
2. Compares the IDs
3. Syncs ONLY the missing ones
```

### ✅ Automatic Background Operation
```
Server starts → Wait 2 min → Check every 30 min → Sync if needed
```

### ✅ Detailed Logging
```
🔍 Starting reconciliation check...
📊 MongoDB: 1967, OpenSearch: 1850, Difference: 117
📝 Found 117 missing documents
Synced batch 1/2: 100 documents
Synced batch 2/2: 17 documents
✅ Reconciliation complete! Synced 117 documents
```

### ✅ Performance Optimized
- Batches of 100 documents
- 200ms delay between batches
- Efficient ID comparison using Sets
- Minimal memory footprint

## How to Use

### Option 1: Automatic (Recommended)

The service starts automatically when you run your server:

```bash
npm start
```

That's it! The service will:
1. Wait 2 minutes for other services to stabilize
2. Run first check
3. Continue checking every 30 minutes
4. Sync missing documents automatically

### Option 2: Manual Control

```bash
# Start with default interval (30 min)
curl -X POST http://localhost:3000/api/reconciliation/start

# Start with custom interval (1 hour)
curl -X POST http://localhost:3000/api/reconciliation/start \
  -H "Content-Type: application/json" \
  -d '{"intervalMs": 3600000}'

# Check status
curl http://localhost:3000/api/reconciliation/status | jq .

# Trigger immediate check
curl -X POST http://localhost:3000/api/reconciliation/check | jq .

# Stop service
curl -X POST http://localhost:3000/api/reconciliation/stop
```

### Option 3: Use Test Script

```bash
./test-reconciliation.sh
```

## Environment Variables

Add to your `.env` file (optional - has good defaults):

```bash
# Enable/disable automatic start
RECONCILIATION_ENABLED=true

# Check interval (milliseconds)
# Default: 1800000 (30 minutes)
RECONCILIATION_INTERVAL_MS=1800000

# Startup delay (milliseconds)  
# Default: 120000 (2 minutes)
RECONCILIATION_STARTUP_DELAY_MS=120000
```

## What Problems Does This Solve?

### Problem 1: Change Stream Misses Documents
**Before**: If change stream drops or misses updates, documents get out of sync
**After**: Reconciliation catches and syncs missing documents automatically

### Problem 2: Manual Checking Required
**Before**: You had to manually check counts and run full sync
**After**: Automatically checks and syncs only what's needed

### Problem 3: Full Sync Takes Too Long
**Before**: Full sync processes all 1,967 documents even if only 10 are missing
**After**: Only syncs the specific missing documents

### Problem 4: No Visibility
**Before**: Hard to know if systems are in sync
**After**: Detailed logs and status API show exactly what's happening

## Example Workflow

### Scenario: 100 Documents Get Missed

```bash
# Time: 10:00 AM - Documents missed due to network issue
MongoDB: 1967 docs
OpenSearch: 1867 docs

# Time: 10:30 AM - Reconciliation check runs automatically
🔍 Starting reconciliation check...
📊 Count comparison - MongoDB: 1967, OpenSearch: 1867, Difference: 100
⚠️  MongoDB has 100 more documents. Finding and syncing...
📝 Found 100 missing documents in OpenSearch
Starting to sync 100 documents...
Synced batch 1/1: 100 documents (Total: 100/100)
✅ Reconciliation complete! Synced 100 missing documents

# Time: 10:32 AM - Systems back in sync
MongoDB: 1967 docs
OpenSearch: 1967 docs ✓
```

## Monitoring

### Check if service is running:
```bash
curl http://localhost:3000/api/reconciliation/status | jq .stats.isRunning
```

### View statistics:
```bash
curl http://localhost:3000/api/reconciliation/status | jq .stats
```

Output:
```json
{
  "lastCheck": "2025-12-11T10:30:00.000Z",
  "lastSync": "2025-12-11T10:30:15.000Z",
  "totalChecks": 25,
  "totalSyncs": 3,
  "documentsSynced": 150,
  "errors": 0,
  "isRunning": true
}
```

### View logs:
```bash
tail -f logs/combined.log | grep -i reconciliation
```

## Comparison with Other Features

| Feature | Purpose | When It Runs | Syncs |
|---------|---------|--------------|-------|
| **Change Stream** | Real-time sync | Continuous | New/updated docs |
| **Full Sync API** | Complete resync | On-demand | All documents |
| **Reconciliation** | **Gap filling** | **Every 30 min** | **Missing docs only** |
| **Count Monitor** | Count tracking | Every 5 hours | Triggers full sync |

## Best Configuration

For most use cases:

```bash
# .env file
RECONCILIATION_ENABLED=true           # Auto-start
RECONCILIATION_INTERVAL_MS=1800000    # 30 minutes
RECONCILIATION_STARTUP_DELAY_MS=120000 # 2 minutes

# Sync settings (already updated)
SYNC_BATCH_SIZE=100                   # Smaller batches
SYNC_BATCH_SIZE_BYTES=5242880         # 5MB
```

## Testing Your Setup

1. **Run the test script:**
   ```bash
   ./test-reconciliation.sh
   ```

2. **Check the output:**
   - Should show current counts
   - Should indicate if systems are in sync
   - Should show number of documents synced (if any)

3. **Monitor logs:**
   ```bash
   tail -f logs/combined.log
   ```

## Troubleshooting

### Service not starting
```bash
# Check configuration
grep RECONCILIATION .env

# Check server logs
tail -50 logs/combined.log | grep -i reconciliation

# Check if server is running
curl http://localhost:3000/
```

### Documents not syncing
```bash
# Trigger manual check
curl -X POST http://localhost:3000/api/reconciliation/check | jq .

# Check for errors
tail -100 logs/error.log | grep -i reconciliation

# Verify MongoDB and OpenSearch connections
curl http://localhost:3000/api/health | jq .
```

## What's Next?

The reconciliation service is now:
- ✅ Created and integrated
- ✅ Configured with sensible defaults
- ✅ Ready to use automatically
- ✅ Fully documented

Just restart your server and it will start working automatically!

```bash
# Restart to enable reconciliation
pm2 restart opensearch-diff-sync
# OR if running manually
npm start
```

## Summary

🎯 **Main Benefit**: Automatic background checking and smart syncing of only missing documents

⏱️ **Default Schedule**: Every 30 minutes

🔧 **Zero Configuration**: Works out of the box with sensible defaults

📊 **Smart**: Only syncs what's actually missing, not everything

🎉 **Result**: Your MongoDB and OpenSearch stay in sync automatically!



