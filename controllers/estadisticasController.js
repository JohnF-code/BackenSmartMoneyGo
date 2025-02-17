// controllers/estadisticasController.js
import Loan from '../models/Loan.js';
import Payment from '../models/Payment.js';

// Obtener estadísticas de cobranza por cobrador
export const getEstadisticasCobrador = async (req, res) => {
  try {
    const { cobradorId } = req.query;
    // Ejemplo: sumar montos pagados y saldo pendiente de préstamos asignados a rutas que el cobrador gestiona
    // Nota: Este ejemplo depende de cómo hayas estructurado los modelos y la asignación de rutas a cobradores.
    const loans = await Loan.find({ ruta: { $in: req.user.user.rutasAsignadas } });
    
    // Calcular totales
    const totalCobrado = loans.reduce((acc, loan) => {
      // Suponiendo que cada préstamo tenga un campo "loanAmount" y "balance"
      return acc + (loan.loanAmount - loan.balance);
    }, 0);
    
    const totalPendiente = loans.reduce((acc, loan) => acc + loan.balance, 0);

    res.status(200).json({
      totalCobrado,
      totalPendiente,
      cantidadPrestamos: loans.length
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener estadísticas", error: error.message });
  }
};
