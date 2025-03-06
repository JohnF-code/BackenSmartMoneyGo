// JohnF-code Jajajaja
// /BackenSmartMoneyGo/routes/loans.js

import express from 'express';
import Loan from '../models/Loan.js';
import authenticate from '../middleware/authenticate.js';
import Clients from '../models/Client.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { io } from '../index.js';
import { calculateEndDate, parseLocalDate, adjustToUTC } from '../helpers/finanzasHelpers.js';

const router = express.Router();

// GET all Loans (filtrado por ruta)
router.get('/', authenticate, async (req, res) => {
  try {
    const { _id } = req.user.user;
    const user = await User.findById(_id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    
    // Filtrar préstamos creados por el usuario actual o cuyos createdBy estén en user.accessTo
    let query = { $or: [{ createdBy: _id }, { createdBy: { $in: user.accessTo } }] };
    if (req.query.ruta) {
      query.ruta = req.query.ruta;
    }
    const loans = await Loan.find(query).populate('clientId').populate('ruta');
    res.json(loans);
  } catch (error) {
    console.log(error);
    res.status(500).send('Hubo un error');
  }
});

// GET Loans by Client
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const { _id } = req.user.user;
    const user = await User.findById(_id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    
    const loans = await Loan.find({
      clientId: id,
      createdBy: { $in: user.accessTo }
    }).populate('clientId').populate('ruta');
    res.json(loans);
  } catch (error) {
    console.log(error);
    res.status(500).send('Hubo un error');
  }
});

// POST => Crear un nuevo préstamo
router.post('/', authenticate, async (req, res) => {
  try {
    const { _id } = req.user.user;
    let {
      loanAmount,
      interest,
      installments,
      date, // Se envía un string ISO que incluye fecha y hora
      clientId,
      description,
      ruta,
      ubicarDespuesDe,
      finishDate,       // Opcional, enviado desde el frontend
      installmentValue, // Opcional, enviado desde el frontend
      usarValoresCalculados
    } = req.body;
    
    // Convertir a números
    loanAmount = Number(loanAmount);
    interest = Number(interest);
    installments = Number(installments);
    if (installmentValue) installmentValue = Number(installmentValue);
    
    // Actualizar cliente (quitar de favoritos)
    await Clients.findOneAndUpdate({ _id: clientId }, { favorite: false });
    
    // Usar new Date(date) para parsear la fecha completa (con hora)
    const localStartDate = new Date(date);
    
    const newLoan = new Loan({
      createdBy: _id,
      clientId,
      loanAmount,
      interest,
      installments,
      date: localStartDate,
      description,
      ruta: ruta || null,
      orden: 0
    });
    
    // Determinar finishDate: usar el enviado o calcularlo
    let finalFinishDate;
    if (usarValoresCalculados && finishDate) {
      finalFinishDate = new Date(finishDate);
    } else {
      const computedFinish = calculateEndDate(date, installments);
      finalFinishDate = new Date(computedFinish);
    }
    newLoan.finishDate = finalFinishDate;
    
    // Calcular installmentValue: usar el enviado o recalcularlo
    if (usarValoresCalculados && installmentValue) {
      newLoan.installmentValue = installmentValue;
    } else {
      newLoan.installmentValue = (loanAmount * (1 + interest / 100)) / (installments || 1);
    }
    // Calcular el balance como: installmentValue * installments
    newLoan.balance = newLoan.installmentValue * installments;
    
    // Reordenamiento
    let newOrder = 0;
    if (ubicarDespuesDe) {
      const prevLoan = await Loan.findById(ubicarDespuesDe);
      if (prevLoan) {
        newOrder = prevLoan.orden + 1;
        await Loan.updateMany(
          { ruta: ruta, orden: { $gte: newOrder } },
          { $inc: { orden: 1 } }
        );
      }
    } else if (ruta) {
      const lastLoan = await Loan.findOne({ ruta: ruta }).sort({ orden: -1 });
      newOrder = lastLoan ? lastLoan.orden + 1 : 0;
    }
    newLoan.orden = newOrder;
    
    await newLoan.save();
    io.emit('loanUpdated', { message: 'Préstamo creado correctamente', loan: newLoan });
    res.status(201).json(newLoan);
  } catch (error) {
    console.log(error);
    res.status(500).send('Hubo un error');
  }
});

// PUT => Reordenar préstamos
router.put('/reorder', authenticate, async (req, res) => {
  try {
    const { loanOrder } = req.body;
    if (!Array.isArray(loanOrder)) {
      return res.status(400).json({ message: 'loanOrder debe ser un arreglo' });
    }
    for (const item of loanOrder) {
      await Loan.findByIdAndUpdate(item.id, { orden: item.orden });
    }
    io.emit('loanUpdated', { message: 'Orden de préstamos actualizado correctamente' });
    res.json({ message: 'Orden de préstamos actualizado correctamente' });
  } catch (error) {
    console.log(error);
    res.status(500).send('Hubo un error');
  }
});

// DELETE => Eliminar préstamo
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const deletedLoan = await Loan.findOneAndDelete({ _id: req.params.id });
    const deletedPayments = await Payment.deleteMany({ loanId: req.params.id });
    io.emit('loanUpdated', { message: 'Préstamo eliminado correctamente', deletedLoan, deletedPayments });
    res.json({ msg: 'Préstamo eliminado correctamente', deletedLoan, deletedPayments });
  } catch (error) {
    console.log(error);
    res.status(500).json(error);
  }
});

// PUT => Actualizar préstamo
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      description,
      loanAmount,
      interest,
      installments,
      date,
      clientId,
      ruta,
      ubicarDespuesDe
    } = req.body;
    
    const loan = await Loan.findById(id);
    if (!loan) return res.status(404).json({ message: 'Préstamo no encontrado' });
    
    const payments = await Payment.find({ loanId: id });
    const totalPayments = payments.reduce((total, p) => total + p.amount, 0);
    
    let newBalance = loan.balance;
    let newInstallmentValue = loan.installmentValue;
    if (
      loanAmount !== loan.loanAmount ||
      interest !== loan.interest ||
      installments !== loan.installments
    ) {
      const capitalConInteres = loanAmount * (1 + interest / 100);
      newBalance = capitalConInteres - totalPayments;
      newInstallmentValue = capitalConInteres / (installments || 1);
    }
    
    let newOrder;
    if (ruta && String(loan.ruta) !== String(ruta)) {
      await Loan.updateMany(
        { ruta: loan.ruta, orden: { $gt: loan.orden } },
        { $inc: { orden: -1 } }
      );
      if (ubicarDespuesDe) {
        const prevLoan = await Loan.findById(ubicarDespuesDe);
        if (prevLoan) {
          newOrder = prevLoan.orden + 1;
          await Loan.updateMany(
            { ruta: ruta, orden: { $gte: newOrder } },
            { $inc: { orden: 1 } }
          );
        } else {
          newOrder = 0;
        }
      } else {
        const lastLoan = await Loan.findOne({ ruta: ruta }).sort({ orden: -1 });
        newOrder = lastLoan ? lastLoan.orden + 1 : 0;
      }
    } else if (ubicarDespuesDe) {
      const prevLoan = await Loan.findById(ubicarDespuesDe);
      if (prevLoan) {
        newOrder = prevLoan.orden + 1;
        if (newOrder > loan.orden) {
          await Loan.updateMany(
            { ruta: loan.ruta, orden: { $gt: loan.orden, $lte: newOrder } },
            { $inc: { orden: -1 } }
          );
        } else if (newOrder < loan.orden) {
          await Loan.updateMany(
            { ruta: loan.ruta, orden: { $gte: newOrder, $lt: loan.orden } },
            { $inc: { orden: 1 } }
          );
        }
      } else {
        newOrder = loan.orden;
      }
    } else {
      newOrder = loan.orden;
    }
    
    loan.description = description;
    loan.loanAmount = loanAmount;
    loan.interest = interest;
    loan.installments = installments;
    loan.date = date;
    loan.clientId = clientId;
    loan.ruta = ruta;
    loan.orden = newOrder;
    loan.installmentValue = newInstallmentValue;
    loan.balance = newInstallmentValue * installments;
    
    const updatedPrestamo = await loan.save();
    
    io.emit('loanUpdated', { message: 'Préstamo actualizado correctamente', updatedPrestamo });
    res.json({ message: 'Préstamo actualizado correctamente', updatedPrestamo });
  } catch (error) {
    console.log(error);
    res.status(500).send('Hubo un error');
  }
});

// POST => Registrar un pago para un préstamo.
router.post('/:id/payment', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    let { amount } = req.body;
    amount = Number(amount);
    if (amount <= 0) {
      return res.status(400).json({ message: 'El monto del pago debe ser mayor que cero' });
    }
    const loan = await Loan.findById(id);
    if (!loan) return res.status(404).json({ message: 'Préstamo no encontrado' });
    
    loan.balance = loan.balance - amount;
    if (loan.balance < 0) loan.balance = 0;
    
    const newPayment = new Payment({
      loanId: id,
      amount,
      date: new Date()
    });
    await newPayment.save();
    
    loan.pagos.push(newPayment);
    
    await loan.save();
    io.emit('loanUpdated', { message: 'Pago registrado correctamente', loan });
    res.status(200).json({ message: 'Pago registrado correctamente', loan, payment: newPayment });
  } catch (error) {
    console.log(error);
    res.status(500).send('Hubo un error al registrar el pago');
  }
});

export default router;
