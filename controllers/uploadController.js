// controllers/uploadController.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Definir la carpeta de subida
const uploadDir = path.join(__dirname, '../uploads');

// Verificar que la carpeta exista; si no, crearla
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de almacenamiento con multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Crear un nombre único para el archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

export const upload = multer({ storage });

// Controlador para subir el PDF
export const uploadPDF = (req, res) => {
  try {
    // Utiliza la variable de entorno BASE_URL o usa el valor por defecto
    const baseUrl = process.env.BASE_URL || "http://localhost:5000";
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
    res.status(200).json({ url: fileUrl });
  } catch (error) {
    console.error("Error en uploadPDF:", error);
    res.status(500).json({ message: "Error al subir el archivo" });
  }
};
