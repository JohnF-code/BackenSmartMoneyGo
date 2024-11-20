// src/routes/financeRoutes.js
import express from 'express';
import authenticate from '../middleware/authenticate.js';
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import { io } from '../index.js';


const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    try {
        // Obtener id del usuario autenticado
        const { _id } = req.user.user;

        // Buscar al usuario autenticado
        const user = await User.findById(_id);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Obtener los retiros que fueron creados por el usuario principal o cualquiera de los que tiene acceso
        const withdrawals = await Withdrawal.find({ createdBy: { $in: user.accessTo } });
        
        res.json(withdrawals);
    } catch (error) {
        console.log(error);
        res.status(500).json(error);
    }
});


router.post('/', authenticate, async (req, res) => {
    try {
        const { _id } = req.user.user;

        const newWithdrawal = await Withdrawal.create({ ...req.body, createdBy: _id });

        // Emitir evento de WebSocket
        io.emit('withdrawalUpdated', { message: 'Nuevo retiro agregado', withdrawal: newWithdrawal });

        res.json({
            msg: 'Retiro agregado correctamente!'
        })
    } catch (error) {
        console.log(error);
        res.status(500).json(error);
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        const deletedWithdrawal = await Withdrawal.findOneAndDelete({ _id: req.params.id });

        // Emitir evento de WebSocket
        io.emit('withdrawalUpdated', { message: 'Retiro eliminado correctamente', withdrawal: deletedWithdrawal });

        res.json({
            msg: 'Retiro eliminado correctamente!',
            deletedWithdrawal
        })
    } catch (error) {
        console.log(error);
        res.status(500).json(error);
    }
});

export default router;