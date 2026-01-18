const { MongoClient } = require('mongodb');
const { Client } = require('@opensearch-project/opensearch');
const config = require('../config');
const logger = require('../utils/logger');

class DocumentCountMonitor {
  constructor() {
    this.mongodbClient = null;
    this.opensearchClient = null;
    this.isRunning = false;
    this.checkInterval = null;
    this.autoSyncEnabled = true; // Enable auto-sync by default
    this.autoSyncThreshold = 100; // Auto-sync if difference > 100 documents
    this.stats = {
      checksPerformed: 0,
      mismatchesDetected: 0,
      autoSyncTriggered: 0,
      lastCheck: null,
      lastMismatch: null,
      lastAutoSync: null
    };
  }

  async initialize() {
    try {
      // Initialize MongoDB connection
      this.mongodbClient = new MongoClient(config.mongodb.uri, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 30000
      });
      await this.mongodbClient.connect();
      
      // Initialize OpenSearch connection
      this.opensearchClient = new Client({
        node: config.opensearch.url,
        auth: {
          username: config.opensearch.username,
          password: config.opensearch.password
        },
        ssl: config.opensearch.ssl
      });

      logger.info('Document count monitor initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize document count monitor:', error);
      throw error;
    }
  }

  async getMongoDBCount() {
    try {
      const db = this.mongodbClient.db(config.mongodb.database);
      const collection = db.collection(config.mongodb.collection);
      const count = await collection.countDocuments();
      return count;
    } catch (error) {
      logger.error('Failed to get MongoDB count:', error);
      throw error;
    }
  }

  async getOpenSearchCount() {
    try {
      const response = await this.opensearchClient.count({
        index: config.opensearch.index
      });
      return response.body.count;
    } catch (error) {
      logger.error('Failed to get OpenSearch count:', error);
      throw error;
    }
  }

  async performCountCheck() {
    try {
      logger.info('Starting document count check...');
      
      const [mongoCount, opensearchCount] = await Promise.all([
        this.getMongoDBCount(),
        this.getOpenSearchCount()
      ]);

      const difference = Math.abs(mongoCount - opensearchCount);
      const isMatch = difference === 0;

      this.stats.checksPerformed++;
      this.stats.lastCheck = new Date();

      if (isMatch) {
        logger.info(`✅ Document count check passed: MongoDB=${mongoCount}, OpenSearch=${opensearchCount}`);
      } else {
        this.stats.mismatchesDetected++;
        this.stats.lastMismatch = new Date();
        
        logger.warn(`⚠️ Document count mismatch detected:`, {
          mongodb: mongoCount,
          opensearch: opensearchCount,
          difference: difference,
          mongodbHigher: mongoCount > opensearchCount
        });

        // Log detailed information about the mismatch
        await this.logDetailedMismatchInfo(mongoCount, opensearchCount);

        // Auto-sync if enabled and threshold exceeded
        if (this.autoSyncEnabled && difference > this.autoSyncThreshold) {
          await this.triggerAutoSync(difference, mongoCount, opensearchCount);
        }
      }

      return {
        mongodb: mongoCount,
        opensearch: opensearchCount,
        difference: difference,
        isMatch: isMatch,
        timestamp: this.stats.lastCheck,
        autoSyncTriggered: this.stats.autoSyncTriggered
      };

    } catch (error) {
      logger.error('Document count check failed:', error);
      throw error;
    }
  }

  async logDetailedMismatchInfo(mongoCount, opensearchCount) {
    try {
      // Get sample documents from MongoDB
      const db = this.mongodbClient.db(config.mongodb.database);
      const collection = db.collection(config.mongodb.collection);
      
      const sampleDocs = await collection.find({}).limit(5).toArray();
      const sampleIds = sampleDocs.map(doc => doc._id.toString());

      // Check if sample documents exist in OpenSearch
      const opensearchExists = await Promise.all(
        sampleIds.map(async (id) => {
          try {
            const response = await this.opensearchClient.exists({
              index: config.opensearch.index,
              id: id
            });
            return { id, exists: response.body };
          } catch (error) {
            return { id, exists: false, error: error.message };
          }
        })
      );

      logger.warn('Detailed mismatch analysis:', {
        sampleDocuments: sampleIds,
        opensearchExistence: opensearchExists,
        possibleCauses: [
          'Documents not yet synced (normal for recent inserts)',
          'Sync service temporarily down',
          'OpenSearch indexing issues',
          'Document deletion not synced'
        ]
      });

    } catch (error) {
      logger.error('Failed to get detailed mismatch info:', error);
    }
  }

  async triggerAutoSync(difference, mongoCount, opensearchCount) {
    try {
      logger.info(`🔄 Auto-sync triggered: difference=${difference} (threshold=${this.autoSyncThreshold})`);
      
      this.stats.autoSyncTriggered++;
      this.stats.lastAutoSync = new Date();

      // Call the sync service API to trigger full sync
      const axios = require('axios');
      const syncUrl = `http://localhost:${config.server.port || 3000}/api/sync/full-sync`;
      
      logger.info(`📡 Calling sync service: ${syncUrl}`);
      
      // Calculate timeout based on document count (minimum 2 minutes, maximum 10 minutes)
      const estimatedTimePerDoc = 0.001; // 1ms per document estimate
      const estimatedTime = Math.max(120000, Math.min(600000, difference * estimatedTimePerDoc));
      const timeout = Math.min(estimatedTime, 600000); // Cap at 10 minutes

      logger.info(`⏱️ Using timeout: ${timeout}ms for ${difference} documents`);

      const response = await axios.post(syncUrl, {
        batchSize: 1000,
        reason: 'auto-sync-triggered-by-count-monitor',
        mismatch: {
          difference: difference,
          mongodb: mongoCount,
          opensearch: opensearchCount
        }
      }, {
        timeout: timeout // Dynamic timeout based on document count
      });

      logger.info(`✅ Auto-sync completed successfully:`, {
        processed: response.data.processed,
        success: response.data.success,
        difference: difference
      });

      // Wait a bit and then verify the sync
      setTimeout(async () => {
        try {
          logger.info('🔍 Verifying auto-sync results...');
          const verificationResult = await this.performCountCheck();
          
          if (verificationResult.isMatch) {
            logger.info('✅ Auto-sync verification successful: counts now match');
          } else {
            logger.warn('⚠️ Auto-sync verification: counts still differ', {
              mongodb: verificationResult.mongodb,
              opensearch: verificationResult.opensearch,
              difference: verificationResult.difference
            });
          }
        } catch (error) {
          logger.error('Failed to verify auto-sync results:', error);
        }
      }, 30000); // Wait 30 seconds before verification

    } catch (error) {
      logger.error('❌ Auto-sync failed:', error.message);
      
      // Log additional details for debugging
      if (error.response) {
        logger.error('Sync service response:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      
      // Don't throw the error - just log it and continue
      // This prevents the count monitor from crashing the entire server
      logger.warn('⚠️ Auto-sync failed, but count monitor will continue running');
    }
  }

  async startMonitoring() {
    if (this.isRunning) {
      logger.warn('Document count monitor is already running');
      return;
    }

    try {
      await this.initialize();
      
      this.isRunning = true;
      
      // Perform initial check after startup delay (non-blocking)
      setTimeout(() => {
        this.performCountCheck().catch(error => {
          logger.error('Initial count check failed:', error);
        });
      }, config.countMonitor.startupDelayMs);
      
      // Set up interval for every 5 hours (5 * 60 * 60 * 1000 ms)
      this.checkInterval = setInterval(async () => {
        try {
          await this.performCountCheck();
        } catch (error) {
          logger.error('Scheduled count check failed:', error);
        }
      }, 5 * 60 * 60 * 1000);

      logger.info(`Document count monitor started - initial check in ${config.countMonitor.startupDelayMs / 1000}s, then every 5 hours`);
      
    } catch (error) {
      logger.error('Failed to start document count monitor:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stopMonitoring() {
    if (!this.isRunning) {
      logger.warn('Document count monitor is not running');
      return;
    }

    try {
      this.isRunning = false;
      
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }

      if (this.mongodbClient) {
        await this.mongodbClient.close();
        this.mongodbClient = null;
      }

      logger.info('Document count monitor stopped');
      
    } catch (error) {
      logger.error('Failed to stop document count monitor:', error);
    }
  }

  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      autoSyncEnabled: this.autoSyncEnabled,
      autoSyncThreshold: this.autoSyncThreshold,
      nextCheckIn: this.isRunning && this.stats.lastCheck ? 
        new Date(this.stats.lastCheck.getTime() + 5 * 60 * 60 * 1000) : null
    };
  }

  // Configuration methods
  setAutoSyncEnabled(enabled) {
    this.autoSyncEnabled = enabled;
    logger.info(`Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  setAutoSyncThreshold(threshold) {
    this.autoSyncThreshold = threshold;
    logger.info(`Auto-sync threshold set to ${threshold} documents`);
  }

  getAutoSyncConfig() {
    return {
      enabled: this.autoSyncEnabled,
      threshold: this.autoSyncThreshold,
      triggered: this.stats.autoSyncTriggered,
      lastTriggered: this.stats.lastAutoSync
    };
  }

  // Manual trigger for immediate check
  async triggerManualCheck() {
    if (!this.isRunning) {
      await this.initialize();
    }
    
    const result = await this.performCountCheck();
    
    if (!this.isRunning) {
      await this.stopMonitoring();
    }
    
    return result;
  }
}

// Create and export the monitor instance
const documentCountMonitor = new DocumentCountMonitor();

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, stopping document count monitor...');
  await documentCountMonitor.stopMonitoring();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, stopping document count monitor...');
  await documentCountMonitor.stopMonitoring();
  process.exit(0);
});

// Start monitoring if this script is run directly
if (require.main === module) {
  documentCountMonitor.startMonitoring().catch((error) => {
    logger.error('Failed to start document count monitor:', error);
    process.exit(1);
  });
}

module.exports = documentCountMonitor;

