#!/usr/bin/env node

const documentCountMonitor = require('./src/services/documentCountMonitor');
const logger = require('./src/utils/logger');

async function startDocumentCountMonitor() {
  try {
    logger.info('🚀 Starting Document Count Monitor as background process...');
    
    await documentCountMonitor.startMonitoring();
    
    logger.info('✅ Document Count Monitor is now running in the background');
    logger.info('📊 Monitoring MongoDB vs OpenSearch document counts every 5 hours');
    logger.info('📝 Check logs for count verification results');
    
    // Keep the process alive
    setInterval(() => {
      const stats = documentCountMonitor.getStats();
      logger.info('📈 Monitor Stats:', {
        checksPerformed: stats.checksPerformed,
        mismatchesDetected: stats.mismatchesDetected,
        lastCheck: stats.lastCheck,
        nextCheckIn: stats.nextCheckIn,
        isRunning: stats.isRunning
      });
    }, 60 * 60 * 1000); // Log stats every hour
    
  } catch (error) {
    logger.error('❌ Failed to start Document Count Monitor:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception in Document Count Monitor:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection in Document Count Monitor:', reason);
  process.exit(1);
});

// Start the monitor
startDocumentCountMonitor();

