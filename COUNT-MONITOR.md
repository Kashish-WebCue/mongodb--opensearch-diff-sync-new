# Document Count Monitor

A background process that automatically checks document counts between MongoDB and OpenSearch every 5 hours to ensure data consistency.

## 🎯 **Purpose**

- **Data Integrity**: Ensures MongoDB and OpenSearch have the same number of documents
- **Sync Monitoring**: Detects if the sync service is working properly
- **Issue Detection**: Identifies potential sync problems early
- **Automated Monitoring**: Runs continuously without manual intervention

## 🚀 **Quick Start**

### Start the Monitor
```bash
# Start as background process
./manage-count-monitor.sh start

# Or using npm
npm run count-monitor
```

### Check Status
```bash
./manage-count-monitor.sh status
```

### View Logs
```bash
./manage-count-monitor.sh logs
```

### Manual Check
```bash
./manage-count-monitor.sh test
```

## 📊 **What It Monitors**

### Document Counts
- **MongoDB**: Counts documents in `selauto.fb_ad` collection
- **OpenSearch**: Counts documents in `facebook-ads-hot` index
- **Comparison**: Calculates difference and detects mismatches

### Monitoring Frequency
- **Automatic**: Every 5 hours (18,000,000 ms)
- **Manual**: On-demand via API or script
- **Real-time**: Continuous background process

## 🔍 **Detection Capabilities**

### ✅ **Normal Operation**
```
✅ Document count check passed: MongoDB=133433, OpenSearch=133433
```

### ⚠️ **Mismatch Detection**
```
⚠️ Document count mismatch detected: {
  mongodb: 133433,
  opensearch: 31084,
  difference: 102349,
  mongodbHigher: true
}
```

### 📋 **Detailed Analysis**
When mismatches are detected, the monitor provides:
- Sample document IDs from MongoDB
- Verification of existence in OpenSearch
- Possible causes and troubleshooting steps

## 🛠️ **Management Commands**

### Basic Operations
```bash
# Start monitor
./manage-count-monitor.sh start

# Stop monitor
./manage-count-monitor.sh stop

# Restart monitor
./manage-count-monitor.sh restart

# Check status
./manage-count-monitor.sh status

# View logs
./manage-count-monitor.sh logs

# Manual check
./manage-count-monitor.sh test
```

### Systemd Service (Optional)
```bash
# Install as system service
./manage-count-monitor.sh install-systemd

# Start system service
sudo systemctl start document-count-monitor

# Check system service status
sudo systemctl status document-count-monitor

# Uninstall system service
./manage-count-monitor.sh uninstall-systemd
```

## 🌐 **API Endpoints**

The count monitor is integrated into the main sync service API:

### Start Monitoring
```bash
POST /api/count-monitor/start
```

### Stop Monitoring
```bash
POST /api/count-monitor/stop
```

### Get Status
```bash
GET /api/count-monitor/status
```

### Manual Check
```bash
POST /api/count-monitor/check
```

### Get Statistics
```bash
GET /api/count-monitor/stats
```

## 📈 **Statistics Tracking**

The monitor tracks:
- **Checks Performed**: Total number of count checks
- **Mismatches Detected**: Number of times mismatches were found
- **Last Check**: Timestamp of the most recent check
- **Last Mismatch**: Timestamp of the most recent mismatch
- **Next Check**: When the next automatic check will occur

## 📝 **Logging**

### Log Locations
- **Background Process**: `logs/count-monitor.log`
- **Systemd Service**: `journalctl -u document-count-monitor`
- **Main Service**: Integrated with main sync service logs

### Log Levels
- **INFO**: Normal operations, successful checks
- **WARN**: Mismatches detected, potential issues
- **ERROR**: Connection failures, critical errors

## 🔧 **Configuration**

### Environment Variables
```bash
# MongoDB Configuration
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=selauto
MONGODB_COLLECTION=fb_ad

# OpenSearch Configuration
OPENSEARCH_URL=https://...
OPENSEARCH_USERNAME=doadmin
OPENSEARCH_PASSWORD=...
OPENSEARCH_INDEX=facebook-ads-hot
```

### Monitoring Settings
- **Check Interval**: 5 hours (configurable in code)
- **Connection Timeout**: 10 seconds
- **Sample Size**: 5 documents for detailed analysis
- **Retry Logic**: Built-in error handling

## 🚨 **Troubleshooting**

### Common Issues

#### 1. **Large Document Count Differences**
**Cause**: Sync service may not be running or processing slowly
**Solution**: 
- Check sync service status: `curl http://localhost:3000/api/sync/status`
- Start sync service: `curl -X POST http://localhost:3000/api/sync/start`
- Trigger full sync: `curl -X POST http://localhost:3000/api/sync/full-sync`

#### 2. **Connection Errors**
**Cause**: MongoDB or OpenSearch connection issues
**Solution**:
- Verify connection strings in `.env`
- Check network connectivity
- Verify credentials

#### 3. **Monitor Not Starting**
**Cause**: Port conflicts or permission issues
**Solution**:
- Check if port 3000 is available
- Verify file permissions
- Check logs for specific errors

### Debug Commands
```bash
# Check monitor process
ps aux | grep count-monitor

# Check logs
tail -f logs/count-monitor.log

# Test connections
./manage-count-monitor.sh test

# Check systemd service
sudo systemctl status document-count-monitor
```

## 📊 **Current Status**

Based on the initial test:
- **MongoDB Documents**: 133,433
- **OpenSearch Documents**: 31,084
- **Difference**: 102,349 documents
- **Status**: Large backlog detected - sync service needs to catch up

## 🎯 **Next Steps**

1. **Monitor Running**: ✅ Background process active
2. **Sync Service**: Ensure sync service is running and processing
3. **Full Sync**: Consider running full sync to catch up
4. **Regular Monitoring**: Monitor will check every 5 hours automatically

## 📞 **Support**

- **Logs**: Check `logs/count-monitor.log` for detailed information
- **API**: Use `/api/count-monitor/*` endpoints for programmatic access
- **Scripts**: Use `./manage-count-monitor.sh` for manual operations

The document count monitor is now running and will help ensure your MongoDB to OpenSearch sync maintains data integrity! 🎉
