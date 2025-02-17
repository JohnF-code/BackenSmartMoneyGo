// routes/rutas.js
import express from 'express';
import { getRutas, createRuta, updateRuta, deleteRuta } from '../controllers/rutaController.js';
import authenticate from '../middleware/authenticate.js';

const router = express.Router();

// Todas las rutas están protegidas con JWT
router.get('/', authenticate, getRutas);
router.post('/', authenticate, createRuta);
router.patch('/:id', authenticate, updateRuta);
router.delete('/:id', authenticate, deleteRuta);

export default router;
