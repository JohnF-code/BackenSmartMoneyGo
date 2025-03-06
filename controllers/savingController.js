// controller/savingController.js
import Saving from '../models/Saving.js';
import User from '../models/User.js';
import Client from '../models/Client.js';
import Loan from '../models/Loan.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const getSavings = async (req, res) => {
    try {
        // Obtener id del usuario autenticado
        const { _id } = req.user.user;
    
        // Buscar al usuario autenticado
        const user = await User.findById(_id);
    
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        
        const savings = await Saving.find();

        res.json(savings);
    } catch (error) {
        console.error('Error getting savings...', error);
        res.status(500).json({ message: 'Error getting savings...' });
    }
}

export const addSaving = async (req, res) => {
    try {
        const {
            number,
            holder,
            balance,
            city,
            contact,
            password,
            coordinates
        } = req.body;

        // Encriptar contraseña
        const encryptedPassword = bcrypt.hashSync(password, 10);

        // Buscar cliente en la DB
        const isClient = await Client.findOne({ contact: number });

        const saving = new Saving({
            number,
            holder,
            balance,
            city,
            contact,
            coordinates,
            password: encryptedPassword
        });

        // Si hay una coincidencia de cliente, enlaza
        if(isClient?.contact) {
            saving.clientId = isClient._id;
        }
        
        await saving.save();

        res.status(201).json(saving);

    } catch (error) {
        console.log('Error creating savings', error);
        res.status(500).json('Error creating Savings');
    }
}

export const deleteSaving = async (req, res) => {
    try {
        await Saving.findOneAndDelete({
            _id: req.params.id
        });

        res.json({
            msg: 'Cuenta de Ahorro Eliminada Correctamente'
        });
    } catch (error) {
        console.log('Error deleting saving...', error);
        res.status(500).json('Error deleting...');
    }
}

export const loginController = async (req, res) => {
    try {
    const { number, password } = req.body;

    // Para depuración (puedes quitarlo en producción):
    console.log("Login request body:", req.body);

    // Buscar usuario por email
    const user = await Saving.findOne({ number });
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
            name: user.holder
        },
            process.env.SECRET,
        {
            expiresIn: '2h', // Ajusta el tiempo de expiración según tu necesidad
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
}

export const profile = (req, res) => {
    try {
        const { user, token } = req.user;
        console.log('profile.....', { user, token });
        res.json({ user, token });
    } catch (error) {
        console.log(error);
        res.status(500).json('Hubo un error al obtener user cuentas...');
    }
}

export const getLoanByNumber = async (req, res) => {
    try {
        // Obtener cliente con número de telefono
        const client = await Client.findOne({ contact: req.params.number });

        if(!client._id) {
            return res.status(404).json({message: 'No existe ningún cliente con este número de teléfono'});
        }
        // Si se encuentra el cliente, buscar sus prestamos
        const loans = await Loan.find({ clientId: client._id });

        console.log('Loans Obtenidos', loans);

        res.json(loans);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Hubo un error obteniendo los prestamos' });
    }
}

export const deposit = async (req, res) => {
    try {
        const { amount, operationType, ip, clientName, accountNumber } = req.body;

        res.json({ amount, operationType, ip, clientName, accountNumber });
    } catch (error) {
        console.log(error);
    }
}