// JohnF-code Jajajaja
// /routes/loans.js

import express from 'express';
import Loan from '../models/Loan.js';
import authenticate from '../middleware/authenticate.js';
import Clients from '../models/Client.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { io } from '../index.js';
import { calculateEndDate } from '../helpers/finanzasHelpers.js';

const router = express.Router();

// GET all Loans (permite filtrar por ruta)
router.get('/', authenticate, async (req, res) => {
  try {
    const { _id } = req.user.user;
    const user = await User.findById(_id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    
    let query = { createdBy: { $in: user.accessTo } };
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
    const {
      loanAmount,
      interest,
      installments,
      date,
      clientId,
      description,
      ruta,
      ubicarDespuesDe,
      finishDate
    } = req.body;

    // Eliminar Cliente de Favoritos
    await Clients.findOneAndUpdate({ _id: clientId }, { favorite: false });

    // Nuevo préstamo
    const newLoan = new Loan({
      createdBy: _id,
      clientId,
      loanAmount,
      interest,
      installments,
      date,
      description,
      ruta: ruta || null,
      orden: 0 // valor temporal
    });

    let newOrder = 0;
    if (ubicarDespuesDe) {
      // Ubicar después de un préstamo específico
      const prevLoan = await Loan.findById(ubicarDespuesDe);
      if (prevLoan) {
        newOrder = prevLoan.orden + 1;
        // Actualizamos los préstamos en la misma ruta con orden >= newOrder
        await Loan.updateMany(
          { ruta: ruta, orden: { $gte: newOrder } },
          { $inc: { orden: 1 } }
        );
      }
    } else if (ruta) {
      // Insertamos al final de la ruta si no se especifica 'ubicarDespuesDe'
      const lastLoan = await Loan.findOne({ ruta: ruta }).sort({ orden: -1 });
      newOrder = lastLoan ? lastLoan.orden + 1 : 0;
    }
    newLoan.orden = newOrder;

    if (!finishDate) {
      const finishStr = calculateEndDate(newLoan.date, installments);
      newLoan.finishDate = new Date(finishStr);
    } else {
      newLoan.finishDate = finishDate;
    }

    const capitalConInteres = newLoan.loanAmount * (1 + newLoan.interest / 100);
    newLoan.balance = capitalConInteres;
    newLoan.installmentValue = capitalConInteres / (installments || 1);

    await newLoan.save();
    io.emit('loanUpdated', { message: 'Préstamo creado correctamente', loan: newLoan });
    res.status(201).json(newLoan);
  } catch (error) {
    console.log(error);
    res.status(500).send('Hubo un error');
  }
});

// PUT => Reordenar préstamos (nuevo endpoint para drag & drop)
// Se espera en el body: { loanOrder: [{ id: "loanId1", orden: newOrder1 }, ...] }
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
    loan.balance = newBalance;

    const updatedPrestamo = await loan.save();

    io.emit('loanUpdated', { message: 'Préstamo actualizado correctamente', updatedPrestamo });
    res.json({ message: 'Préstamo actualizado correctamente', updatedPrestamo });
  } catch (error) {
    console.log(error);
    res.status(500).send('Hubo un error');
  }
});

export default router;
