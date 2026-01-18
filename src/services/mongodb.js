const { MongoClient } = require('mongodb');
const config = require('../config');
const logger = require('../utils/logger');

class MongoDBService {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;
  }

  async connect() {
    try {
      this.client = new MongoClient(config.mongodb.uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
      });

      await this.client.connect();
      this.db = this.client.db(config.mongodb.database);
      this.collection = this.db.collection(config.mongodb.collection);
      
      logger.info('Connected to MongoDB successfully');
      return true;
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      logger.info('Disconnected from MongoDB');
    }
  }

  async getChangeStream() {
    try {
      const pipeline = [
        {
          $match: {
            $or: [
              { operationType: 'insert' },
              { operationType: 'update' },
              { operationType: 'replace' },
              { operationType: 'delete' }
            ]
          }
        }
      ];

      const changeStream = this.collection.watch(pipeline, {
        fullDocument: 'updateLookup',
        fullDocumentBeforeChange: 'whenAvailable'
      });

      logger.info('MongoDB change stream started');
      return changeStream;
    } catch (error) {
      logger.error('Failed to create change stream:', error);
      throw error;
    }
  }

  async findDocuments(filter = {}, options = {}) {
    try {
      const cursor = this.collection.find(filter, {
        ...options,
        limit: options.limit || 1000
      });
      return await cursor.toArray();
    } catch (error) {
      logger.error('Failed to find documents:', error);
      throw error;
    }
  }

  async findDocumentById(id) {
    try {
      return await this.collection.findOne({ _id: id });
    } catch (error) {
      logger.error(`Failed to find document by id ${id}:`, error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      await this.db.admin().ping();
      const stats = await this.db.stats();
      
      return {
        status: 'healthy',
        database: stats.db,
        collections: stats.collections,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize
      };
    } catch (error) {
      logger.error('MongoDB health check failed:', error);
      throw error;
    }
  }

  async getCollectionStats() {
    try {
      const count = await this.collection.countDocuments();
      
      // Use collStats command for detailed stats
      let stats = {};
      try {
        const result = await this.db.command({ collStats: config.mongodb.collection });
        stats = {
          size: result.size || 0,
          avgObjSize: result.avgObjSize || 0,
          storageSize: result.storageSize || 0,
          totalIndexSize: result.totalIndexSize || 0
        };
      } catch (err) {
        logger.warn('Could not get detailed collection stats:', err.message);
        stats = {
          size: 0,
          avgObjSize: 0,
          storageSize: 0,
          totalIndexSize: 0
        };
      }
      
      return {
        count,
        ...stats
      };
    } catch (error) {
      logger.error('Failed to get collection stats:', error);
      throw error;
    }
  }
}

module.exports = MongoDBService;
