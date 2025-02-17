// models/Payment.js
import mongoose from "mongoose";
const Schema = mongoose.Schema;

const PaymentSchema = new Schema({
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
  loanId: { type: Schema.Types.ObjectId, ref: 'Loan' },
  amount: Number,
  date: { type: Date, default: Date.now },
  isPaid: { type: Boolean, default: false }, // si lo usas
});

// Índice compuesto para filtrar por createdBy, date
PaymentSchema.index({ createdBy: 1, date: 1 });
// Índice adicional por loanId (siempre filtras pagos por loanId, a veces)
PaymentSchema.index({ loanId: 1 });

export default mongoose.model('Payment', PaymentSchema);
