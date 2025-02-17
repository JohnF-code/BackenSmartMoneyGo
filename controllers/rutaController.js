// controllers/rutaController.js
import Ruta from '../models/Ruta.js';

// Obtener todas las rutas
export const getRutas = async (req, res) => {
  try {
    const rutas = await Ruta.find();
    res.status(200).json(rutas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las rutas", error: error.message });
  }
};

// Crear una nueva ruta
export const createRuta = async (req, res) => {
  try {
    const nuevaRuta = new Ruta(req.body);
    await nuevaRuta.save();
    res.status(201).json(nuevaRuta);
  } catch (error) {
    res.status(500).json({ message: "Error al crear la ruta", error: error.message });
  }
};

// Actualizar una ruta (por ejemplo, para asignar cobradores o actualizar el nombre)
export const updateRuta = async (req, res) => {
  try {
    const rutaActualizada = await Ruta.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(rutaActualizada);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar la ruta", error: error.message });
  }
};

// Eliminar una ruta
export const deleteRuta = async (req, res) => {
  try {
    const rutaEliminada = await Ruta.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Ruta eliminada", rutaEliminada });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar la ruta", error: error.message });
  }
};
