// routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

import User from '../models/User.js';

// Para cargar las variables de entorno (process.env.SECRET, etc.)
dotenv.config();

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Para depuración (puedes quitarlo en producción):
    console.log("Login request body:", req.body);

    // Buscar usuario por email
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ message: 'Invalid email or password' });
    }

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: 'Invalid email or password' });
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        role: user.role,
        createdBy: user.createdBy || null, // Null si es un usuario principal
      },
      process.env.SECRET,
      {
        expiresIn: '1h', // Ajusta el tiempo de expiración según tu necesidad
      }
    );

    // Retornar el usuario y el token
    res.json({ user, token });
  } catch (error) {
    console.error("Error en /login:", error);
    return res
      .status(501)
      .json({ message: 'Hubo un error al iniciar sesión.', error });
  }
});

export default router;
