const express = require('express');
const router = express.Router();

class CountMonitorRoutes {
  constructor(documentCountMonitor) {
    this.documentCountMonitor = documentCountMonitor;
    this.setupRoutes();
  }

  setupRoutes() {
    // Start count monitoring
    router.post('/start', async (req, res) => {
      try {
        await this.documentCountMonitor.startMonitoring();
        res.json({ 
          success: true, 
          message: 'Document count monitor started successfully' 
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Stop count monitoring
    router.post('/stop', async (req, res) => {
      try {
        await this.documentCountMonitor.stopMonitoring();
        res.json({ 
          success: true, 
          message: 'Document count monitor stopped successfully' 
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get monitor status
    router.get('/status', async (req, res) => {
      try {
        const stats = this.documentCountMonitor.getStats();
        res.json({
          isRunning: this.documentCountMonitor.isRunning,
          stats
        });
      } catch (error) {
        res.status(500).json({
          error: error.message
        });
      }
    });

    // Trigger manual count check
    router.post('/check', async (req, res) => {
      try {
        const result = await this.documentCountMonitor.triggerManualCheck();
        res.json({
          success: true,
          result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get count statistics
    router.get('/stats', async (req, res) => {
      try {
        const stats = this.documentCountMonitor.getStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({
          error: error.message
        });
      }
    });

    // Auto-sync configuration endpoints
    router.get('/auto-sync/config', async (req, res) => {
      try {
        const config = this.documentCountMonitor.getAutoSyncConfig();
        res.json(config);
      } catch (error) {
        res.status(500).json({
          error: error.message
        });
      }
    });

    router.post('/auto-sync/enable', async (req, res) => {
      try {
        const { enabled } = req.body;
        this.documentCountMonitor.setAutoSyncEnabled(enabled);
        res.json({
          success: true,
          message: `Auto-sync ${enabled ? 'enabled' : 'disabled'}`,
          config: this.documentCountMonitor.getAutoSyncConfig()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    router.post('/auto-sync/threshold', async (req, res) => {
      try {
        const { threshold } = req.body;
        if (typeof threshold !== 'number' || threshold < 0) {
          return res.status(400).json({
            success: false,
            error: 'Threshold must be a positive number'
          });
        }
        this.documentCountMonitor.setAutoSyncThreshold(threshold);
        res.json({
          success: true,
          message: `Auto-sync threshold set to ${threshold} documents`,
          config: this.documentCountMonitor.getAutoSyncConfig()
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

module.exports = CountMonitorRoutes;
