// routes/payments.js
import express from 'express';
import Payment from '../models/Payment.js';
import Loan from '../models/Loan.js';
import authenticate from '../middleware/authenticate.js';
import User from '../models/User.js';
import { io } from '../index.js'; // Importar la instancia de io correctamente
import Clients from '../models/Client.js';

const router = express.Router();

// Obtener todos los pagos
router.get('/', authenticate, async (req, res) => {
  try {
    const { _id } = req.user.user; // Obtener el id del usuario autenticado

    // Buscar al usuario
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const { loanId } = req.query; // Obtener el loanId desde la consulta

    // Validación de loanId
    if (loanId && !/^[0-9a-fA-F]{24}$/.test(loanId)) {
      return res.status(400).json({ message: 'loanId no es válido.' });
    }

    const filter = { createdBy: { $in: user.accessTo } }; // Filtrar por los pagos asociados al usuario
    if (loanId) filter.loanId = loanId;

    // Obtener pagos y asociar los detalles de los préstamos y clientes
    const payments = await Payment.find(filter).populate('clientId').populate('loanId');
    
    // Verifica si se obtuvieron pagos
    if (!payments.length) {
      return res.status(204).send(); // No Content
    }

    res.status(200).json(payments); // Regresar los pagos
  } catch (error) {
    console.error('Error al obtener pagos:', error);
    res.status(500).json({ message: 'Error al obtener pagos.' });
  }
});

// Registrar un nuevo pago
router.post('/', authenticate, async (req, res) => {
  try {
    const { _id } = req.user.user;
    const { balance, loanId, clientId, amount } = req.body;

    // Validar datos de la solicitud
    if (!loanId || !clientId || !amount) {
      return res.status(400).json({ message: "Datos incompletos para el pago." });
    }

    // Registrar pago
    const payment = new Payment({ ...req.body, createdBy: _id });
    await payment.save();

    // Actualizar el balance del préstamo
    const updatedBalance = balance - payment.amount;
    const updatedLoan = await Loan.findByIdAndUpdate(
      loanId,
      { balance: updatedBalance, terminated: updatedBalance <= 1000 },
      { new: true }
    ).populate('clientId', 'name');

    console.log(updatedLoan);
    const { installmentValue } = updatedLoan;

    // Coutas actuales = balance / installmentValue
    // Cuotas restantes = totalCuotas - cuotasActuales
    const cuotasActuales = updatedLoan.balance / updatedLoan.installmentValue;
    const cuotasRestantes = updatedLoan.installments - cuotasActuales;

    // Si le faltan 8 cuotas o menos, entonces añadir a favoritos
    if(cuotasRestantes <= 8 ) {
      await Clients.findOneAndUpdate( { _id: clientId }, { favorite: true } );
    }

    // Emitir el evento de actualización de pago usando Socket.IO
    io.emit('paymentUpdated', {
      updatedLoan,
      message: updatedBalance <= 1000
        ? `Préstamo del cliente ${updatedLoan.clientId.name} finalizado.`
        : 'Pago registrado con éxito.'
    });

    res.status(201).json({
      payment,
      updatedLoan,
      msg: 'Pago registrado con éxito!'
    });
  } catch (error) {
    console.error('Error al registrar el pago:', error);
    res.status(500).json({ message: 'Error al registrar el pago.' });
  }
});

// Eliminar un pago
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Pago no encontrado.' });
    }

    // Actualizar el balance del préstamo
    const loan = await Loan.findById(payment.loanId);
    if (loan) {
      loan.balance += payment.amount;
      loan.terminated = false;
      await loan.save();
    }

    // Emitir evento de eliminación de pago usando Socket.IO
    io.emit('paymentUpdated', {
      loan,
      message: 'Pago eliminado correctamente.'
    });

    res.status(200).json({ message: 'Pago eliminado correctamente.', payment, loan });
  } catch (error) {
    console.error('Error al eliminar el pago:', error);
    res.status(500).json({ message: 'Error al eliminar el pago.' });
  }
});

export default router;
