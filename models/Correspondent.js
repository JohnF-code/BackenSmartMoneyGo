// models/Correspondent.js
import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const CorrespondentSchema = new Schema(
  {
    name: { type: String },
    holder: { type: String, required: true },
    document: { type: String, required: true },
    contact: { type: String, required: true },
    email: { type: String, required: true },
    city: { type: String },
    direction: { type: String },
    coordinates: { type: [Number] }
  }
);

export default mongoose.model('Correspondent', CorrespondentSchema);
