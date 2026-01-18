const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./utils/logger');
const SyncService = require('./services/syncService');
const ReconciliationService = require('./services/reconciliationService');
const HealthRoutes = require('./routes/health');
const SyncRoutes = require('./routes/sync');
const CountMonitorRoutes = require('./routes/countMonitor');
const ReconciliationRoutes = require('./routes/reconciliation');
const documentCountMonitor = require('./services/documentCountMonitor');

class Server {
  constructor() {
    this.app = express();
    this.syncService = new SyncService();
    this.reconciliationService = null; // Initialize after syncService starts
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true
    }));
    
    // Compression
    this.app.use(compression());
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use('/api/', limiter);
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Health routes
    const healthRoutes = new HealthRoutes(this.syncService);
    this.app.use('/api/health', healthRoutes.getRouter());
    
    // Sync routes
    const syncRoutes = new SyncRoutes(this.syncService);
    this.app.use('/api/sync', syncRoutes.getRouter());
    
    // Count monitor routes
    const countMonitorRoutes = new CountMonitorRoutes(documentCountMonitor);
    this.app.use('/api/count-monitor', countMonitorRoutes.getRouter());
    
    // Reconciliation routes (will be initialized after services start)
    this.app.use('/api/reconciliation', (req, res, next) => {
      if (!this.reconciliationService) {
        return res.status(503).json({
          error: 'Reconciliation service not initialized yet',
          message: 'Please wait for services to start'
        });
      }
      next();
    });
    
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'OpenSearch Diff Sync',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/api/health',
          sync: '/api/sync',
          countMonitor: '/api/count-monitor',
          reconciliation: '/api/reconciliation'
        }
      });
    });
    
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl
      });
    });
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error:', error);
      
      res.status(500).json({
        error: 'Internal server error',
        message: config.server.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    });
    
    // Graceful shutdown handlers
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    
    // Unhandled promise rejection
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    // Uncaught exception
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  async start() {
    try {
      // Initialize sync service
      await this.syncService.initialize();
      
      // Initialize reconciliation service
      this.reconciliationService = new ReconciliationService(
        this.syncService.mongodbService,
        this.syncService.opensearchService
      );
      
      // Add reconciliation routes now that service is initialized
      const reconciliationRoutes = new ReconciliationRoutes(this.reconciliationService);
      this.app.use('/api/reconciliation', reconciliationRoutes.getRouter());
      
      // Start the server
      this.server = this.app.listen(config.server.port, () => {
        logger.info(`Server running on port ${config.server.port}`);
        logger.info(`Environment: ${config.server.nodeEnv}`);
      });
      
      // Start sync service if enabled
      if (config.sync.enabled) {
        await this.syncService.start();
        logger.info('Sync service started automatically');
      }
      
      // Start count monitor automatically if enabled
      if (config.countMonitor.enabled) {
        // Configure count monitor settings
        documentCountMonitor.setAutoSyncEnabled(config.countMonitor.autoSyncEnabled);
        documentCountMonitor.setAutoSyncThreshold(config.countMonitor.autoSyncThreshold);
        
        await documentCountMonitor.startMonitoring();
        logger.info('Document count monitor started automatically');
      } else {
        logger.info('Document count monitor disabled by configuration');
      }
      
      // Start reconciliation service automatically if enabled
      if (config.reconciliation.enabled) {
        // Start after a delay to let other services stabilize
        setTimeout(async () => {
          try {
            await this.reconciliationService.start(config.reconciliation.checkIntervalMs);
            logger.info(`Reconciliation service started automatically (checks every ${config.reconciliation.checkIntervalMs / 60000} minutes)`);
          } catch (error) {
            logger.error('Failed to start reconciliation service:', error);
          }
        }, config.reconciliation.startupDelayMs);
      } else {
        logger.info('Reconciliation service disabled by configuration');
      }
      
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async gracefulShutdown(signal) {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    try {
      // Stop accepting new connections
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
      }
      
      // Stop sync service
      await this.syncService.stop();
      
      // Stop count monitor
      await documentCountMonitor.stopMonitoring();
      
      // Stop reconciliation service
      if (this.reconciliationService) {
        await this.reconciliationService.stop();
      }
      
      // Close MongoDB connection
      await this.syncService.mongodbService.disconnect();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
      
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new Server();
server.start().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

module.exports = Server;
