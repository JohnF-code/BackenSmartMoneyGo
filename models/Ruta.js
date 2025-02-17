// models/Ruta.js
import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const RutaSchema = new Schema(
  {
    nombre: { type: String, required: true },
    descripcion: { type: String },
    // Campo opcional para definir un orden predeterminado
    ordenPredeterminado: { type: Number, default: 0 },
    // Lista de cobradores asignados a esta ruta (referencia a usuarios)
    cobradores: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

export default mongoose.model('Ruta', RutaSchema);
