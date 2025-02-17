// routes/upload.js
import express from 'express';
import { upload, uploadPDF } from '../controllers/uploadController.js';
import authenticate from '../middleware/authenticate.js';

const router = express.Router();

// Endpoint para subir un archivo PDF (campo "pdf")
// El middleware "authenticate" protege este endpoint
router.post('/', authenticate, upload.single('pdf'), uploadPDF);

export default router;
