import express from 'express';

const router = express.Router();

// GET /api/health
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'IPL Auction Arena API',
    version: '1.0.0',
    message: 'Server is running healthy'
  });
});

export default router;
