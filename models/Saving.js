// models/Saving.js
import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const SavingSchema = new Schema(
  {
    number: { type: String, required: true },
    holder: { type: String },
    balance: { type: Number, default: 0 },
    city: { type: String },
    contact: { type: String },
    performance: { type: Number },
    coordinates: { type: [Number] },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
    password: { type: String, required: true }
  }
);

export default mongoose.model('Saving', SavingSchema);
