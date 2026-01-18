const express = require('express');
const router = express.Router();

class ReconciliationRoutes {
  constructor(reconciliationService) {
    this.reconciliationService = reconciliationService;
    this.setupRoutes();
  }

  setupRoutes() {
    // Start reconciliation service
    router.post('/start', async (req, res) => {
      try {
        const intervalMs = req.body.intervalMs || 30 * 60 * 1000; // Default 30 minutes
        await this.reconciliationService.start(intervalMs);
        res.json({ 
          success: true, 
          message: 'Reconciliation service started successfully',
          intervalMs,
          intervalMinutes: intervalMs / 60000
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Stop reconciliation service
    router.post('/stop', async (req, res) => {
      try {
        await this.reconciliationService.stop();
        res.json({ 
          success: true, 
          message: 'Reconciliation service stopped successfully' 
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get reconciliation service status
    router.get('/status', async (req, res) => {
      try {
        const stats = this.reconciliationService.getStats();
        res.json({
          success: true,
          stats
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Trigger manual reconciliation check
    router.post('/check', async (req, res) => {
      try {
        const result = await this.reconciliationService.checkAndSync();
        res.json(result);
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

module.exports = ReconciliationRoutes;

