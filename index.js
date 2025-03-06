/**
 * index.js
 */
import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: 'variables.env' });

const app = express();

// Middlewares
app.use(bodyParser.json());
app.use(cors());

// Conexión a la DB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.log('Connection error:', error);
  });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar rutas
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import clientRoutes from './routes/clients.js';
import loanRoutes from './routes/loans.js';
import paymentRoutes from './routes/payment.js';
import financeRoutes from './routes/finances.js';
import billsRoutes from './routes/bills.js';
import withdrawalsRoutes from './routes/withdrawals.js';
import summaryRoutes from './routes/summary.js';
import uploadRoutes from './routes/upload.js';
import rutasRoutes from './routes/rutas.js';
import estadisticasRoutes from './routes/estadisticas.js';
import savingRoutes from './routes/saving.js';
import correspondentRoutes from './routes/correspondents.js';

// Usar rutas con prefijo "/api"
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/finances', financeRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/withdrawals', withdrawalsRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/routes', rutasRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/savings', savingRoutes);
app.use('/api/correspondents', correspondentRoutes);

// Servir archivos estáticos desde la carpeta "uploads"
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Arrancar servidor
const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

export { io };
