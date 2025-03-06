// models/Movements.js
import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const MovementsSchema = new Schema(
  {
    type: { type: String, required: true },
    name: { type: String },
    date: { type: Number },
    movement: { type: String },
    reference: { type: String },
    amount: { type: Number },
    savingId: { type: Schema.Types.ObjectId, ref: 'Client' }
  }
);

export default mongoose.model('Movement', MovementsSchema);
