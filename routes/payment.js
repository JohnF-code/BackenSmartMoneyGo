// routes/payments.js
import express from 'express';
const router = express.Router();
import Payment from '../models/Payment.js';
import Loan from '../models/Loan.js';
import authenticate from '../middleware/authenticate.js';
import User from '../models/User.js';
import { io } from '../index.js';  // Importar la instancia de io correctamente

// Get all payments
router.get('/', authenticate, async (req, res) => {
   // Obtener id del usuario autenticado
    const { _id } = req.user.user;

    // Buscar al usuario autenticado
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Obtener los pagos que fueron creados por el usuario principal o cualquiera a los que tiene acceso
  const payments = await Payment.find({
    createdBy: { $in: user.accessTo }
  }).populate('clientId').populate('loanId');

  res.json(payments);
});

// Delete Payment
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // Eliminar pago
    const deletedPayment = await Payment.findOneAndDelete({ _id: req.params.id });
    
    // Econtrar prestamo al que pertenece el pago
    const { loanId } = deletedPayment;
    const loan = await Loan.findOne({ _id: loanId });

    // Actualizar balance
    const updatedLoan = await Loan.findOneAndUpdate({ _id: loanId }, { balance: loan.balance + deletedPayment.amount, terminated: false });

    // Emitir evento de eliminación de pago
    io.emit('paymentUpdated', { updatedLoan, message: 'Pago eliminado correctamente!' });

    res.json({
      msg: 'Pago eliminado correctamente',
      deletedPayment,
      updatedLoan
    })
  } catch (error) {
    console.log(error);
  }
});

// Add new payment
router.post('/', authenticate, async (req, res) => {
  try {
    const { _id } = req.user.user;
    const { balance, loanId, clientId } = req.body;

    // Registrar pago
    const payment = new Payment({...req.body, createdBy: _id});
    await payment.save();

    console.log(payment);

    // Actualizar Cantidad
    const updatedBalance = balance - payment.amount;

    const updatedLoan = await Loan.findOneAndUpdate({ _id: loanId }, { balance: updatedBalance });

    // Verificar si la deuda del cliente ya ha terminado
    if (updatedBalance <= 1000) {
      const terminatedLoan = await Loan.findOneAndUpdate({ _id: loanId, clientId }, {
        terminated: true
      }).populate('clientId');
      //  Mandar respuesta al frontend

      // Emitir evento con los datos actualizados
      io.emit('paymentUpdated', { terminatedLoan, message: `El préstamo del cliente ${terminatedLoan.clientId.name} ha terminado.` });

      res.status(201).json({
        terminatedLoan,
        msg: `Felicidades, el usuario ${terminatedLoan?.clientId?.name || ''} ha culminado con su prestamo`
      });
      return;
    }

    // Emitir evento con los datos actualizados
    io.emit('paymentUpdated', { updatedLoan, message: 'Pago registrado con éxito!' });

    //  Mandar respuesta al frontend
    res.status(201).json({
      updatedLoan,
      msg: 'Pago registrado con exito!'
    });
  } catch (error) {
    console.log(error);
  }
});

// Other routes for update and delete can be added here...

export default router;