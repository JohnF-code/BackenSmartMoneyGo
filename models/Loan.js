// models/Loan.js
import mongoose from "mongoose";
const { Schema, model } = mongoose;

const LoanSchema = new Schema({
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
  loanAmount: { type: Number, required: true },
  interest: { type: Number, required: true },
  installments: { type: Number, required: true },
  balance: { type: Number, required: true },
  installmentValue: { type: Number, required: true },
  description: { type: String },
  date: { type: Date, default: Date.now },
  finishDate: { type: Date },
  terminated: { type: Boolean, default: false },
  // Ruta a la que pertenece el préstamo
  ruta: { type: Schema.Types.ObjectId, ref: 'Ruta' },
  // Orden dentro de la ruta (para reordenar)
  orden: { type: Number, default: 0 }
});

// Índice compuesto para filtrar por createdBy y date
LoanSchema.index({ createdBy: 1, date: 1 });

// Se elimina el índice en "name" ya que no existe en este esquema
// LoanSchema.index({ name: 'text' });

const Loan = model('Loan', LoanSchema);
export default Loan;
