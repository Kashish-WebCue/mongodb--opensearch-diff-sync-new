# Reconciliation Service

The Reconciliation Service automatically checks for differences between MongoDB and OpenSearch and syncs only the missing documents.

## Features

- 🔍 **Automatic Detection**: Periodically checks if MongoDB and OpenSearch have the same document count
- 🎯 **Smart Syncing**: Only syncs documents that are missing in OpenSearch (not full sync)
- 📊 **Progress Tracking**: Detailed logging of sync progress and statistics
- ⚡ **Efficient**: Uses batched operations to minimize resource usage
- 🔄 **Background Service**: Runs automatically in the background

## How It Works

1. **Count Comparison**: Compares document counts between MongoDB and OpenSearch
2. **ID Collection**: If counts differ, fetches all document IDs from both systems
3. **Missing Detection**: Identifies which MongoDB documents are missing in OpenSearch
4. **Targeted Sync**: Syncs only the missing documents in small batches

## Configuration

Add to your `.env` file:

```bash
# Enable/disable the service
RECONCILIATION_ENABLED=true

# How often to check (in milliseconds)
# Default: 1800000 (30 minutes)
RECONCILIATION_INTERVAL_MS=1800000

# Delay before first check after startup (in milliseconds)
# Default: 120000 (2 minutes)
RECONCILIATION_STARTUP_DELAY_MS=120000
```

## API Endpoints

### Start Reconciliation Service

```bash
POST /api/reconciliation/start
```

**Body** (optional):
```json
{
  "intervalMs": 1800000  // Check interval in milliseconds
}
```

**Response**:
```json
{
  "success": true,
  "message": "Reconciliation service started successfully",
  "intervalMs": 1800000,
  "intervalMinutes": 30
}
```

### Stop Reconciliation Service

```bash
POST /api/reconciliation/stop
```

**Response**:
```json
{
  "success": true,
  "message": "Reconciliation service stopped successfully"
}
```

### Get Service Status

```bash
GET /api/reconciliation/status
```

**Response**:
```json
{
  "success": true,
  "stats": {
    "lastCheck": "2025-12-11T10:30:00.000Z",
    "lastSync": "2025-12-11T10:30:15.000Z",
    "totalChecks": 25,
    "totalSyncs": 3,
    "documentsSynced": 150,
    "errors": 0,
    "isRunning": true,
    "nextCheck": "scheduled"
  }
}
```

### Trigger Manual Check

```bash
POST /api/reconciliation/check
```

**Response**:
```json
{
  "success": true,
  "inSync": true,
  "mongoCount": 1967,
  "opensearchCount": 1967,
  "difference": 0,
  "synced": 0
}
```

Or if syncing was needed:
```json
{
  "success": true,
  "inSync": true,
  "synced": 150,
  "missingCount": 150
}
```

## Use Cases

### 1. Automatic Background Reconciliation

The service starts automatically on server startup and runs in the background:

```bash
# Just start your server
npm start

# The reconciliation service will:
# - Wait 2 minutes after startup
# - Check every 30 minutes (configurable)
# - Sync missing documents automatically
```

### 2. Manual Reconciliation Check

Trigger a check manually via API:

```bash
# Check and sync if needed
curl -X POST http://localhost:3000/api/reconciliation/check
```

### 3. On-Demand Reconciliation

Start/stop the service as needed:

```bash
# Start with custom interval (1 hour)
curl -X POST http://localhost:3000/api/reconciliation/start \
  -H "Content-Type: application/json" \
  -d '{"intervalMs": 3600000}'

# Stop when not needed
curl -X POST http://localhost:3000/api/reconciliation/stop
```

### 4. Monitor Reconciliation Activity

Check the service status:

```bash
curl http://localhost:3000/api/reconciliation/status | jq .
```

## Logging

The service provides detailed logs:

```
🔍 Starting reconciliation check...
📊 Count comparison - MongoDB: 1967, OpenSearch: 1850, Difference: 117
⚠️  MongoDB has 117 more documents. Finding and syncing missing documents...
🔄 Identifying missing documents...
Found 1967 documents in MongoDB
Found 1850 documents in OpenSearch
📝 Found 117 missing documents in OpenSearch
Starting to sync 117 documents in batches of 100...
Synced batch 1/2: 100 documents (Total: 100/117)
Synced batch 2/2: 17 documents (Total: 117/117)
✅ Reconciliation complete! Synced 117 missing documents
```

## Performance Considerations

- **Batch Size**: Syncs 100 documents per batch
- **Delay Between Batches**: 200ms to prevent overwhelming OpenSearch
- **ID Fetching**: Uses efficient pagination to fetch all IDs
- **Memory Usage**: Processes documents in batches to keep memory usage low

## When to Use

### ✅ Use Reconciliation Service When:
- You want automatic background sync for missing documents
- You're recovering from a partial failure
- You need to ensure data consistency without full resync
- Documents are occasionally missed by the change stream

### ❌ Don't Use When:
- You need an initial full sync (use `/api/sync/full-sync` instead)
- You want to re-sync all documents (use full sync)
- The change stream is working reliably (it's redundant)

## Comparison with Other Services

| Service | Purpose | Frequency | Use Case |
|---------|---------|-----------|----------|
| **Change Stream** | Real-time sync | Continuous | Sync new/updated documents immediately |
| **Full Sync** | Complete resync | On-demand | Initial sync or complete refresh |
| **Reconciliation** | Gap filling | Periodic (30 min) | Catch missed documents automatically |
| **Count Monitor** | Count comparison | 5 hours | Monitor and alert on count differences |

## Best Practices

1. **Set Appropriate Interval**: 30 minutes is a good balance for most use cases
2. **Monitor Logs**: Check logs regularly to ensure reconciliation is working
3. **Use with Change Stream**: Reconciliation complements the real-time sync
4. **Adjust Startup Delay**: Give other services time to initialize (2 min default)

## Troubleshooting

### Service not starting
- Check if `RECONCILIATION_ENABLED=true` in your `.env`
- Ensure MongoDB and OpenSearch connections are healthy
- Check server logs for initialization errors

### High sync frequency
- Increase `RECONCILIATION_INTERVAL_MS` if syncing too often
- Investigate why documents are being missed by change stream

### Performance issues
- Reduce batch size if causing OpenSearch load
- Increase delay between batches
- Check OpenSearch cluster health

## Example Workflow

```bash
# 1. Start server (reconciliation starts automatically)
npm start

# 2. Check status after a few minutes
curl http://localhost:3000/api/reconciliation/status | jq .

# 3. Trigger manual check if needed
curl -X POST http://localhost:3000/api/reconciliation/check | jq .

# 4. View logs
tail -f logs/combined.log | grep -i reconciliation
```

## Integration with Other Services

The Reconciliation Service works alongside:

- **Sync Service**: Handles real-time changes via MongoDB change streams
- **Count Monitor**: Monitors overall document counts and triggers full syncs
- **Full Sync API**: Provides on-demand complete synchronization

Together, they provide a comprehensive solution for keeping MongoDB and OpenSearch in sync.

