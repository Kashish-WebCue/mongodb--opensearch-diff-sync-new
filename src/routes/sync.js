const express = require('express');
const router = express.Router();

class SyncRoutes {
  constructor(syncService) {
    this.syncService = syncService;
    this.setupRoutes();
  }

  setupRoutes() {
    // Start sync
    router.post('/start', async (req, res) => {
      try {
        await this.syncService.start();
        res.json({ 
          success: true, 
          message: 'Sync service started successfully' 
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Stop sync
    router.post('/stop', async (req, res) => {
      try {
        await this.syncService.stop();
        res.json({ 
          success: true, 
          message: 'Sync service stopped successfully' 
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get sync status
    router.get('/status', async (req, res) => {
      try {
        const stats = await this.syncService.getStats();
        res.json({
          isRunning: this.syncService.isRunning,
          stats
        });
      } catch (error) {
        res.status(500).json({
          error: error.message
        });
      }
    });

    // Trigger full sync
    router.post('/full-sync', async (req, res) => {
      try {
        const options = req.body || {};
        const result = await this.syncService.performFullSync(options);
        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Flush pending documents
    router.post('/flush', async (req, res) => {
      try {
        await this.syncService.bulkProcessor.flush();
        res.json({ 
          success: true, 
          message: 'Pending documents flushed successfully' 
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }

  getRouter() {
    return router;
  }
}

module.exports = SyncRoutes;
