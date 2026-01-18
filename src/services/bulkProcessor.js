const config = require('../config');
const logger = require('../utils/logger');

class BulkProcessor {
  constructor(opensearchService) {
    this.opensearchService = opensearchService;
    this.batchSize = config.sync.batchSize;
    this.batchSizeBytes = config.sync.batchSizeBytes;
    this.concurrency = config.sync.concurrency;
    this.queue = [];
    this.processing = false;
    this.stats = {
      processed: 0,
      errors: 0,
      lastProcessed: null
    };
  }

  async addDocument(document, operation = 'upsert') {
    this.queue.push({ document, operation });
    
    // Process if queue reaches batch size
    if (this.queue.length >= this.batchSize) {
      await this.processBatch();
    }
  }

  async addDocuments(documents, operation = 'upsert') {
    for (const doc of documents) {
      this.queue.push({ document: doc, operation });
    }
    
    // Process if queue reaches batch size
    if (this.queue.length >= this.batchSize) {
      await this.processBatch();
    }
  }

  async processBatch() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);
    
    try {
      await this.processBatchWithRetry(batch);
      this.stats.processed += batch.length;
      this.stats.lastProcessed = new Date();
      
      logger.info(`Processed batch of ${batch.length} documents`);
    } catch (error) {
      this.stats.errors += batch.length;
      logger.error(`Failed to process batch of ${batch.length} documents:`, error);
      
      // Re-queue failed documents for retry
      this.queue.unshift(...batch);
    } finally {
      this.processing = false;
    }
  }

  async processBatchWithRetry(batch, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const documents = batch
          .filter(item => item.operation !== 'delete')
          .map(item => item.document);
        
        const deleteIds = batch
          .filter(item => item.operation === 'delete')
          .map(item => item.document._id.toString());

        // Process upserts
        if (documents.length > 0) {
          await this.opensearchService.bulkIndex(documents);
        }

        // Process deletes
        for (const docId of deleteIds) {
          await this.opensearchService.deleteDocument(docId);
        }

        return; // Success
      } catch (error) {
        lastError = error;
        logger.warn(`Batch processing attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  async flush() {
    while (this.queue.length > 0) {
      await this.processBatch();
    }
  }

  async startPeriodicProcessing() {
    setInterval(async () => {
      if (this.queue.length > 0) {
        await this.processBatch();
      }
    }, config.sync.intervalMs);
    
    logger.info('Started periodic batch processing');
  }

  getStats() {
    return {
      ...this.stats,
      queueSize: this.queue.length,
      processing: this.processing
    };
  }

  // Utility method to estimate document size in bytes
  estimateDocumentSize(document) {
    return Buffer.byteLength(JSON.stringify(document), 'utf8');
  }

  // Method to split large documents into smaller batches
  splitLargeBatch(documents) {
    const batches = [];
    let currentBatch = [];
    let currentBatchSize = 0;

    for (const doc of documents) {
      const docSize = this.estimateDocumentSize(doc);
      
      if (currentBatchSize + docSize > this.batchSizeBytes || 
          currentBatch.length >= this.batchSize) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentBatchSize = 0;
        }
      }
      
      currentBatch.push(doc);
      currentBatchSize += docSize;
    }
    
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    
    return batches;
  }
}

module.exports = BulkProcessor;
