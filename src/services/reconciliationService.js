const config = require('../config');
const logger = require('../utils/logger');

class ReconciliationService {
  constructor(mongodbService, opensearchService) {
    this.mongodbService = mongodbService;
    this.opensearchService = opensearchService;
    this.isRunning = false;
    this.intervalId = null;
    this.stats = {
      lastCheck: null,
      lastSync: null,
      totalChecks: 0,
      totalSyncs: 0,
      documentsSynced: 0,
      errors: 0
    };
  }

  async start(intervalMs = 30 * 60 * 1000) { // Default: 30 minutes
    if (this.isRunning) {
      logger.warn('Reconciliation service is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting reconciliation service with ${intervalMs}ms interval (${intervalMs / 60000} minutes)`);

    // Run immediately on start
    await this.checkAndSync();

    // Then run periodically
    this.intervalId = setInterval(async () => {
      await this.checkAndSync();
    }, intervalMs);
  }

  async stop() {
    if (!this.isRunning) {
      logger.warn('Reconciliation service is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('Reconciliation service stopped');
  }

  async checkAndSync() {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('🔍 Starting reconciliation check...');
      this.stats.totalChecks++;
      this.stats.lastCheck = new Date();

      // Get document counts
      const mongoCount = await this.mongodbService.collection.countDocuments();
      const osStats = await this.opensearchService.getIndexStats();
      const osCount = osStats.docs_count;

      const difference = mongoCount - osCount;

      logger.info(`📊 Count comparison - MongoDB: ${mongoCount}, OpenSearch: ${osCount}, Difference: ${difference}`);

      if (difference === 0) {
        logger.info('✅ Counts match! No reconciliation needed.');
        return { 
          success: true, 
          inSync: true, 
          mongoCount, 
          opensearchCount: osCount,
          difference: 0,
          synced: 0 
        };
      }

      if (difference > 0) {
        logger.info(`⚠️  MongoDB has ${difference} more documents. Finding and syncing missing documents...`);
        const result = await this.syncMissingDocuments();
        return result;
      } else {
        logger.warn(`⚠️  OpenSearch has ${Math.abs(difference)} more documents than MongoDB (orphaned documents)`);
        logger.info('Consider cleaning up orphaned documents from OpenSearch');
        return {
          success: true,
          inSync: false,
          mongoCount,
          opensearchCount: osCount,
          difference,
          synced: 0,
          orphanedDocs: Math.abs(difference)
        };
      }

    } catch (error) {
      this.stats.errors++;
      logger.error('❌ Reconciliation check failed:', error);
      return { success: false, error: error.message };
    }
  }

  async syncMissingDocuments() {
    try {
      logger.info('🔄 Identifying missing documents...');

      // Get all MongoDB document IDs
      const mongoIds = await this.mongodbService.collection
        .find({}, { projection: { _id: 1 } })
        .toArray();
      
      const mongoIdSet = new Set(mongoIds.map(doc => doc._id.toString()));
      logger.info(`Found ${mongoIdSet.size} documents in MongoDB`);

      // Get all OpenSearch document IDs in batches
      const osIdSet = await this.getAllOpenSearchIds();
      logger.info(`Found ${osIdSet.size} documents in OpenSearch`);

      // Find missing IDs
      const missingIds = [];
      for (const id of mongoIdSet) {
        if (!osIdSet.has(id)) {
          missingIds.push(id);
        }
      }

      logger.info(`📝 Found ${missingIds.length} missing documents in OpenSearch`);

      if (missingIds.length === 0) {
        logger.info('✅ All MongoDB documents exist in OpenSearch');
        return {
          success: true,
          inSync: true,
          synced: 0,
          missingCount: 0
        };
      }

      // Sync missing documents in batches
      const synced = await this.syncDocumentsByIds(missingIds);

      this.stats.totalSyncs++;
      this.stats.lastSync = new Date();
      this.stats.documentsSynced += synced;

      logger.info(`✅ Reconciliation complete! Synced ${synced} missing documents`);

      return {
        success: true,
        inSync: true,
        synced,
        missingCount: missingIds.length
      };

    } catch (error) {
      logger.error('❌ Failed to sync missing documents:', error);
      throw error;
    }
  }

  async getAllOpenSearchIds() {
    const ids = new Set();
    const batchSize = 1000;
    let searchAfter = null;

    try {
      while (true) {
        const searchParams = {
          index: this.opensearchService.indexName,
          body: {
            size: batchSize,
            _source: false,
            query: { match_all: {} },
            sort: [{ _id: 'asc' }]
          }
        };

        if (searchAfter) {
          searchParams.body.search_after = searchAfter;
        }

        const response = await this.opensearchService.client.search(searchParams);
        const hits = response.body.hits.hits;

        if (hits.length === 0) {
          break;
        }

        hits.forEach(hit => ids.add(hit._id));

        // Get the last sort value for pagination
        searchAfter = hits[hits.length - 1].sort;

        logger.debug(`Fetched ${ids.size} OpenSearch document IDs...`);
      }

      return ids;

    } catch (error) {
      logger.error('Failed to fetch OpenSearch IDs:', error);
      throw error;
    }
  }

  async syncDocumentsByIds(ids) {
    const batchSize = 100;
    let synced = 0;

    logger.info(`Starting to sync ${ids.length} documents in batches of ${batchSize}...`);

    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      
      try {
        // Convert string IDs back to ObjectId for MongoDB query
        const { ObjectId } = require('mongodb');
        const objectIds = batchIds.map(id => {
          try {
            return new ObjectId(id);
          } catch (e) {
            return id; // If conversion fails, use as is
          }
        });

        // Fetch documents from MongoDB
        const documents = await this.mongodbService.collection
          .find({ _id: { $in: objectIds } })
          .toArray();

        if (documents.length > 0) {
          // Sync to OpenSearch
          const result = await this.opensearchService.bulkIndex(documents);
          synced += documents.length;

          const batchNum = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(ids.length / batchSize);
          logger.info(`Synced batch ${batchNum}/${totalBatches}: ${documents.length} documents (Total: ${synced}/${ids.length})`);

          if (result.errors > 0) {
            logger.warn(`Batch had ${result.errors} errors`);
          }
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        logger.error(`Failed to sync batch starting at index ${i}:`, error.message);
      }
    }

    return synced;
  }

  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      nextCheck: this.intervalId ? 'scheduled' : 'not scheduled'
    };
  }
}

module.exports = ReconciliationService;

