// server.js
import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

dotenv.config({ path: 'variables.env' });

const app = express();

console.log(process.env.MONGO_URI);

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Maneja solicitudes OPTIONS para solicitudes preflight
// app.options('*', cors());

// Database connection
mongoose.connect(process.env.MONGO_URI, {
  useUnifiedTopology: true
});

// Check connection
mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB');
}).on('error', (error) => {
  console.log('Connection error:', error);
});

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import clientRoutes from './routes/clients.js';
import loanRoutes from './routes/loans.js';
import paymentRoutes from './routes/payment.js';
import financeRoutes from './routes/finances.js';
import billsRoutes from './routes/bills.js';
import withDrawalsRoutes from './routes/withdrawals.js';

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/finances', financeRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/withdrawals', withDrawalsRoutes)

// Start the server
// Create server and socket.io instance
const server = app.listen(process.env.PORT || 5000, () => {
  console.log(`Server is running on port ${process.env.PORT || 5000}`);
});

// Crear una instancia de Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // Asegúrate de ajustar la configuración de CORS si es necesario
  }
});

// Exportamos `io` para que pueda ser utilizado en otros archivos
export { io };
