const config = require('../config');
const logger = require('../utils/logger');
const MongoDBService = require('./mongodb');
const OpenSearchService = require('./opensearch');
const BulkProcessor = require('./bulkProcessor');

class SyncService {
  constructor() {
    this.mongodbService = new MongoDBService();
    this.opensearchService = new OpenSearchService();
    this.bulkProcessor = new BulkProcessor(this.opensearchService);
    this.changeStream = null;
    this.isRunning = false;
    this.stats = {
      documentsProcessed: 0,
      documentsSkipped: 0,
      errors: 0,
      lastSync: null,
      startTime: null
    };
  }

  async initialize() {
    try {
      await this.mongodbService.connect();
      await this.opensearchService.initialize();
      await this.bulkProcessor.startPeriodicProcessing();
      
      logger.info('Sync service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize sync service:', error);
      throw error;
    }
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Sync service is already running');
      return;
    }

    try {
      this.isRunning = true;
      this.stats.startTime = new Date();
      
      // Start change stream
      await this.startChangeStream();
      
      logger.info('Sync service started successfully');
    } catch (error) {
      this.isRunning = false;
      logger.error('Failed to start sync service:', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      logger.warn('Sync service is not running');
      return;
    }

    try {
      this.isRunning = false;
      
      // Close change stream
      if (this.changeStream) {
        await this.changeStream.close();
        this.changeStream = null;
      }
      
      // Flush remaining documents
      await this.bulkProcessor.flush();
      
      logger.info('Sync service stopped successfully');
    } catch (error) {
      logger.error('Failed to stop sync service:', error);
      throw error;
    }
  }

  async startChangeStream() {
    try {
      this.changeStream = await this.mongodbService.getChangeStream();
      
      this.changeStream.on('change', async (change) => {
        try {
          await this.handleChange(change);
        } catch (error) {
          logger.error('Error handling change:', error);
          this.stats.errors++;
        }
      });

      this.changeStream.on('error', (error) => {
        logger.error('Change stream error:', error);
        this.stats.errors++;
        
        // Attempt to restart change stream
        setTimeout(() => {
          if (this.isRunning) {
            this.restartChangeStream();
          }
        }, 5000);
      });

      logger.info('Change stream started');
    } catch (error) {
      logger.error('Failed to start change stream:', error);
      throw error;
    }
  }

  async restartChangeStream() {
    try {
      logger.info('Restarting change stream...');
      
      if (this.changeStream) {
        await this.changeStream.close();
      }
      
      await this.startChangeStream();
      logger.info('Change stream restarted successfully');
    } catch (error) {
      logger.error('Failed to restart change stream:', error);
    }
  }

  async handleChange(change) {
    const { operationType, fullDocument, documentKey } = change;
    
    logger.debug(`Processing ${operationType} operation for document: ${documentKey._id}`);

    switch (operationType) {
      case 'insert':
      case 'update':
      case 'replace':
        if (fullDocument) {
          await this.bulkProcessor.addDocument(fullDocument, 'upsert');
          this.stats.documentsProcessed++;
        } else {
          logger.warn(`No full document available for ${operationType} operation`);
          this.stats.documentsSkipped++;
        }
        break;
        
      case 'delete':
        await this.bulkProcessor.addDocument(
          { _id: documentKey._id }, 
          'delete'
        );
        this.stats.documentsProcessed++;
        break;
        
      default:
        logger.warn(`Unhandled operation type: ${operationType}`);
        this.stats.documentsSkipped++;
    }
    
    this.stats.lastSync = new Date();
  }

  async performFullSync(options = {}) {
    try {
      logger.info('Starting full sync...');
      
      // Use smaller batch size to prevent timeouts with large documents
      const batchSize = options.batchSize || 100;
      const filter = options.filter || {};
      
      let skip = 0;
      let totalProcessed = 0;
      let totalErrors = 0;
      let totalVersionConflicts = 0;
      
      // Get total count for progress tracking
      const totalCount = await this.mongodbService.collection.countDocuments(filter);
      logger.info(`Total documents to sync: ${totalCount}`);
      
      while (true) {
        const documents = await this.mongodbService.findDocuments(filter, {
          limit: batchSize,
          skip
        });
        
        if (documents.length === 0) {
          break;
        }
        
        const batchNum = Math.floor(skip / batchSize) + 1;
        logger.info(`Processing batch ${batchNum}: ${documents.length} documents (${totalProcessed}/${totalCount})`);
        
        try {
          // Process directly to avoid queue buildup and get immediate results
          const result = await this.opensearchService.bulkIndex(documents);
          
          totalProcessed += documents.length;
          
          if (result.errors > 0) {
            totalErrors += result.errors;
          }
          
          if (result.versionConflicts > 0) {
            totalVersionConflicts += result.versionConflicts;
          }
          
          // Log progress every 10 batches or at milestones
          if (batchNum % 10 === 0 || totalProcessed === totalCount) {
            const progress = ((totalProcessed / totalCount) * 100).toFixed(2);
            logger.info(`Progress: ${progress}% (${totalProcessed}/${totalCount}), Errors: ${totalErrors}, Version Conflicts: ${totalVersionConflicts}`);
          }
          
        } catch (error) {
          logger.error(`Failed to process batch at skip ${skip}:`, error.message);
          totalErrors += documents.length;
        }
        
        skip += documents.length;
        
        // Small delay to prevent overwhelming OpenSearch
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const successRate = totalProcessed > 0 
        ? ((totalProcessed - totalErrors) / totalProcessed * 100).toFixed(2) 
        : 0;
      
      logger.info(`Full sync completed: ${totalProcessed} documents processed, ${totalErrors} errors, ${totalVersionConflicts} version conflicts, ${successRate}% success rate`);
      
      return { 
        success: true, 
        processed: totalProcessed,
        errors: totalErrors,
        versionConflicts: totalVersionConflicts,
        successRate: parseFloat(successRate)
      };
      
    } catch (error) {
      logger.error('Full sync failed:', error);
      throw error;
    }
  }

  async getStats() {
    const bulkStats = this.bulkProcessor.getStats();
    
    return {
      ...this.stats,
      bulkProcessor: bulkStats,
      isRunning: this.isRunning,
      uptime: this.stats.startTime ? 
        Date.now() - this.stats.startTime.getTime() : 0
    };
  }

  async healthCheck() {
    try {
      const mongodbHealth = await this.mongodbService.healthCheck();
      const opensearchHealth = await this.opensearchService.healthCheck();
      
      return {
        status: 'healthy',
        mongodb: mongodbHealth,
        opensearch: opensearchHealth,
        sync: {
          isRunning: this.isRunning,
          queueSize: this.bulkProcessor.queue.length
        }
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = SyncService;
