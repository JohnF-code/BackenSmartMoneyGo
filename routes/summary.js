// routes/summary.js
import express from 'express';
import { getSummary } from '../controllers/summaryController.js';
import authenticate from '../middleware/authenticate.js';

const router = express.Router();

// GET /api/summary
router.get('/', authenticate, getSummary);

export default router;
