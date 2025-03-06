import express from 'express';
import bcrypt from 'bcryptjs';

const router = express.Router();
import User from "../models/User.js";
import authenticate from '../middleware/authenticate.js';

// Crear sub-usuario
router.post('/subuser', authenticate, async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Encriptar password
        const encryptedPassword = bcrypt.hashSync(password, 10);

        const mainUser = await User.findById(req.user.user._id); // Usuario principal (admin) que está creando el sub-usuario
        
        // Verificar que el rol del sub-usuario sea válido
        if (!mainUser || mainUser.role !== 'administrador') {
            return res.status(403).json({ message: "No tienes permisos para crear usuarios" });
        }

        // Crear nuevo sub-usuario
        const newSubUser = await mainUser.addSubUser({
            name,
            email,
            password: encryptedPassword,
            role
        });

        res.status(201).json({ message: 'Sub-usuario creado exitosamente', subUser: newSubUser });
    } catch (error) {
        console.error(error);
        res.status(p).json(error);
    }
});

router.post('/register', async (req, res) => {

    try {
        const { name, email, role, password } = req.body;

        const encryptedPassword = bcrypt.hashSync(password, 10);

        const newUser = {
            name,
            email,
            password: encryptedPassword,
            role
        }

        const user = await User.create(newUser);

        const toSend = {
            status: 'success',
            data: user
        }

        res.status(200).json(toSend);
    } catch (error) {
        console.log('ERROR - REGISTER ENDPOINT');
        console.log(error);

        const toSend = {
            status: 'error',
            error
        };

        res.status(500).json(toSend);
    }
});

router.get('/profile', authenticate, (req, res) => {
  try {
    const { user } = req.user;
    console.log({ user, token: req.user.token });
    res.json({ user, token: req.user.token });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Hubo un error al obtener perfil...' })
  }
})

router.get('/', authenticate, async (req, res) => {
    try {
        const { _id } = req.user.user;
        const users = await User.find({ createdBy: _id });
        res.json(users);
    } catch (error) {
        console.log(error)
    }
});

router.delete('/admin/:id', authenticate, async (req, res) => {
    
    try {
        const { id } = req.params;
        await User.findOneAndDelete({ _id: id });
        res.json({
            msg: 'Usuario Eliminado correctamente'
        });
    } catch (error) {
        console.log(error)
    }
});

export default router;