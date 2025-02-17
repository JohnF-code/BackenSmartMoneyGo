// routes/estadisticas.js
import express from 'express';
import { getEstadisticasCobrador } from '../controllers/estadisticasController.js';
import authenticate from '../middleware/authenticate.js';

const router = express.Router();

router.get('/', authenticate, getEstadisticasCobrador);

export default router;
