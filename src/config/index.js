require('dotenv').config();

const config = {
  // MongoDB Configuration
  mongodb: {
    uri: process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://localhost:27017/sync_db',
    database: process.env.MONGODB_DATABASE || process.env.DATABASE_NAME || 'sync_db',
    collection: process.env.MONGODB_COLLECTION || process.env.COLLECTION_NAME || 'items'
  },

  // OpenSearch Configuration
  opensearch: {
    url: process.env.OPENSEARCH_URL || process.env.ELASTICSEARCH_URL || 'https://localhost:9200',
    username: process.env.OPENSEARCH_USERNAME || process.env.ELASTICSEARCH_USERNAME || 'admin',
    password: process.env.OPENSEARCH_PASSWORD || process.env.ELASTICSEARCH_PASSWORD || 'admin',
    index: process.env.OPENSEARCH_INDEX || 'facebook-ads-hot',
    indexAlias: process.env.OPENSEARCH_INDEX_ALIAS || 'facebook-ads-read',
    ssl: {
      rejectUnauthorized: false
    }
  },

  // Sync Configuration
  sync: {
    batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 100, // Smaller batches to prevent timeouts
    batchSizeBytes: parseInt(process.env.SYNC_BATCH_SIZE_BYTES) || 5242880, // 5MB
    concurrency: parseInt(process.env.SYNC_CONCURRENCY) || 2,
    intervalMs: parseInt(process.env.SYNC_INTERVAL_MS) || 1000,
    enabled: process.env.SYNC_ENABLED === 'true' || true
  },

  // Server Configuration
  server: {
    port: parseInt(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  // Health Check Configuration
  healthCheck: {
    intervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS) || 30000
  },

  // Count Monitor Configuration
  countMonitor: {
    enabled: process.env.COUNT_MONITOR_ENABLED === 'true' || true,
    autoSyncEnabled: process.env.COUNT_MONITOR_AUTO_SYNC === 'true' || true,
    autoSyncThreshold: parseInt(process.env.COUNT_MONITOR_THRESHOLD) || 100,
    checkIntervalMs: parseInt(process.env.COUNT_MONITOR_INTERVAL_MS) || 5 * 60 * 60 * 1000, // 5 hours
    startupDelayMs: parseInt(process.env.COUNT_MONITOR_STARTUP_DELAY_MS) || 5 * 60 * 1000 // 5 minutes
  },

  // Reconciliation Service Configuration
  reconciliation: {
    enabled: process.env.RECONCILIATION_ENABLED === 'true' || true,
    checkIntervalMs: parseInt(process.env.RECONCILIATION_INTERVAL_MS) || 30 * 60 * 1000, // 30 minutes
    startupDelayMs: parseInt(process.env.RECONCILIATION_STARTUP_DELAY_MS) || 2 * 60 * 1000 // 2 minutes
  }
};

module.exports = config;
