// routes/clients.js
import express from 'express';
const router = express.Router();
import Loan from '../models/Loan.js';
import authenticate from '../middleware/authenticate.js';
import Clients from '../models/Client.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { io } from '../index.js';

// Get all Loans
router.get('/', authenticate, async (req, res) => {
  try {
    // Obtener id del usuario autenticado
    const { _id } = req.user.user;

    // Buscar al usuario autenticado
    const user = await User.findById(_id);

    // Obtener los prestamos que fueron creados por el usuario principal o cualquiera a los que tiene acceso
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Obtener los prestamos que fueron creados por el usuario principal o cualquiera a los que tiene acceso
    const loans = await Loan.find({
      createdBy: { $in: user.accessTo }
    }).populate('clientId');

    res.json(loans);
  } catch (error) {
    console.log(error);
    res.status(500).send('Hubo un error');
  }
});

// Get Loans By client
router.get('/:id', authenticate, async (req, res) => {
  
  const { id } = req.params;
  try {
    // Obtener id del usuario autenticado
    const { _id } = req.user.user;

    // Buscar al usuario autenticado
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Obtener el prestamo que fue creado por el usuario principal o cualquiera a los que tiene acceso
    const loans = await Loan.find({
      clientId: id,
      createdBy: { $in: user.accessTo }
    }).populate('clientId');
  
    res.json(loans);
  } catch (error) {
    console.log(error);
    res.status(500).send('Hubo un error');
  }
});

// Add new loan
router.post('/', authenticate, async (req, res) => {
  try {
    const { _id } = req.user.user;
    const loan = new Loan({...req.body, createdBy: _id });
    await loan.save();

    // Emitir evento
    io.emit('loanUpdated', { message: 'Préstamo creado correctamente', loan });

    res.status(201).json(loan);
  } catch (error) {
    console.log(error.error);
    res.status(500).send('Hubo un error');
  }
});

// Delete loan...
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Loan.findOneAndDelete({ _id: req.params.id });

    const deletedPayments = await Payment.deleteMany({ loanId: req.params.id });
    console.log(deletedPayments);
    
    // Emitir evento 
    io.emit('loanUpdated', { message: 'Préstamo eliminado correctamente', deletedPayments });


    res.json({
      msg: 'Prestamo Eliminado correctamente',
      deletedPayments
    });
  } catch (error) {
    console.log(error);
    res.status(500).json(error);
  }
});

// Update Loan...
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const {
      description,
      loanAmount,
      interest,
      installments,
      date,
      clientId
    } = req.body;

    const loan = await Loan.findOne({ _id: id });

    if (!loan) {
      // No se encontro el prestamo
      return res.status(404).json({ message: 'Préstamo no encontrado' });
    }

    // Entonces modificar también el saldo y número de cuotas
    const payments = await Payment.find({ loanId: id });

    let newBalance = loan.balance;
    let newInstallmentValue = loan.installmentValue;


    // Calcular el todal de pagos realizados
    const totalPayments = payments.reduce((total, pago) => total + pago.amount, 0);

    // Verificar si editaron el monto del prestamo
    if (loanAmount !== loan.loanAmount || interest !== loan.interest || installments !== loan.installments) {

      // Calcular el nuevo saldo (balance), asumiendo que el balance se basa en el nuevo loanAmount
      const capitalConInteres = loanAmount * (1 + interest / 100);  // Ajuste del préstamo con el nuevo interés
      newBalance = capitalConInteres - totalPayments; // Resta de los pagos ya realizados

      // Recalcular el valor de la cuota (installmentValue)
      newInstallmentValue = capitalConInteres / installments;
    }

    // Actualizar el préstamo con los nuevos valores
    const updatedPrestamo = await Loan.findByIdAndUpdate(
      id,
      {
        description,
        loanAmount,
        interest,
        installments, // Mantener el número de cuotas si no se modificó
        date,
        clientId,
        installmentValue: newInstallmentValue, // Nuevo valor de la cuota
        balance: newBalance // Actualizamos el balance con el nuevo cálculo
      }
    );

    // Emitir evento 
    io.emit('loanUpdated', { message: 'Préstamo actualizado correctamente', updatedPrestamo });

    res.json({ message: 'Préstamo actualizado correctamente', updatedPrestamo });

  } catch (error) {
    console.log(error);
    res.status(500).send('Hubo un error');
  }
})

export default router;