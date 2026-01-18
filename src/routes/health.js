const express = require('express');
const router = express.Router();

class HealthRoutes {
  constructor(syncService) {
    this.syncService = syncService;
    this.setupRoutes();
  }

  setupRoutes() {
    // Basic health check
    router.get('/health', async (req, res) => {
      try {
        const health = await this.syncService.healthCheck();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: error.message
        });
      }
    });

    // Detailed health check
    router.get('/health/detailed', async (req, res) => {
      try {
        const health = await this.syncService.healthCheck();
        const stats = await this.syncService.getStats();
        
        res.json({
          ...health,
          stats
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: error.message
        });
      }
    });

    // Readiness check
    router.get('/ready', async (req, res) => {
      try {
        const health = await this.syncService.healthCheck();
        
        if (health.status === 'healthy' && this.syncService.isRunning) {
          res.status(200).json({ status: 'ready' });
        } else {
          res.status(503).json({ status: 'not ready' });
        }
      } catch (error) {
        res.status(503).json({
          status: 'not ready',
          error: error.message
        });
      }
    });

    // Liveness check
    router.get('/live', (req, res) => {
      res.status(200).json({ status: 'alive' });
    });

    // Stats endpoint
    router.get('/stats', async (req, res) => {
      try {
        const stats = await this.syncService.getStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({
          error: error.message
        });
      }
    });
  }

  getRouter() {
    return router;
  }
}

module.exports = HealthRoutes;
