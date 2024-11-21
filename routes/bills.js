// src/routes/financeRoutes.js
import express from 'express';
import authenticate from '../middleware/authenticate.js';
import Bill from '../models/Bill.js';
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
        const bills = await Bill.find({ createdBy: { $in: user.accessTo } });
        
        res.json(bills);
    } catch (error) {
        console.log(error);
        res.status(500).json(error);
    }
});


router.post('/', authenticate, async (req, res) => {
    try {
        const { _id } = req.user.user;

        // Crear un nuevo gasto
        const newBill = await Bill.create({ ...req.body, createdBy: _id });

        // Emitir el nuevo gasto a través del socket
        io.emit('billUpdated', { message: 'Nuevo Gasto agregado', bill: newBill });

        res.json({
            msg: 'Gasto agregado correctamente!',
            bill: newBill
        });
    } catch (error) {
        console.log(error);
        res.status(500).json(error);
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        const deletedBill = await Bill.findOneAndDelete({ _id: req.params.id });

        if (!deletedBill) {
            return res.status(404).json({ msg: 'Gasto no encontrado' });
        }

        // Emitir el evento al WebSocket con el ID del gasto eliminado
        io.emit('billDeleted', { message: 'Gasto eliminado', billId: req.params.id });

        res.json({
            msg: 'Gasto eliminado correctamente!',
            deletedBill
        });
    } catch (error) {
        console.log(error);
        res.status(500).json(error);
    }
});

export default router;