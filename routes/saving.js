// src/routes/saving.js
import express from 'express';
import { addSaving, getSavings, deleteSaving, loginController, profile, getLoanByNumber, deposit } from '../controllers/savingController.js';
import authenticate from '../middleware/authenticate.js';
import savingauth from '../middleware/savingauth.js';


const router = express.Router();

router.get('/', authenticate, getSavings);
router.post('/', addSaving);
router.delete('/:id', authenticate, deleteSaving);
router.post('/login', loginController);
router.post('/deposit', savingauth, deposit);
router.get('/profile', savingauth, profile);
router.get('/loans/:number', savingauth, getLoanByNumber);


export default router;