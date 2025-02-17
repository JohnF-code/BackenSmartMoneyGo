// middleware/authenticate.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export default async (req, res, next) => {
  let token;

  // Verificamos si el token está en los encabezados de autorización
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extraemos el token
      token = req.headers.authorization.split(' ')[1];

      // Verificamos el token y decodificamos
      const decoded = jwt.verify(token, process.env.SECRET);

      // Buscamos el usuario asociado al token
      const user = await User.findById(decoded.id).select('-password');

      // Añadimos el usuario y el token al objeto de solicitud
      req.user = { user, token };

      // Continuamos con la siguiente función middleware
      return next();
    } catch (error) {
      const e = new Error('Token no válido o expirado');
      return res.status(403).json({ msg: e.message, error: error.message });
    }
  }

  if (!token) {
    const error = new Error('Token no válido o inexistente');
    return res.status(403).json({ msg: error.message });
  }

  next();
};
