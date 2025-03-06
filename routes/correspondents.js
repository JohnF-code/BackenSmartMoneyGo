// routes/clients.js
import express from 'express';
const router = express.Router();
import authenticate from '../middleware/authenticate.js';
import Correspondent from '../models/Correspondent.js';

// Get all clients
router.get('/', authenticate, async (req, res) => {
  try {
    // Obtener los clientes que fueron creados por el usuario principal o cualquiera a los que tiene acceso
    const correspondents = await Correspondent.find({});

    res.json(correspondents);
  } catch (error) {
    console.log(error);
    res.status(500).send('Hubo un error');
  }
});

// Add new client
router.post('/', authenticate, async (req, res) => {
  try {
    const correspondent = new Correspondent(req.body);
    await correspondent.save();

    res.status(201).json(correspondent);
  } catch (error) {
    console.log(error.error);
    res.status(500).send('Hubo un error');
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Correspondent.findOneAndDelete({ _id: req.params.id });

    res.json({
      msg: 'Cliente Eliminado correctamente'
    });
  } catch (error) {
    console.log(error);
    res.status(500).json('Error deleting Correspondent...');
  }
});

export default router;