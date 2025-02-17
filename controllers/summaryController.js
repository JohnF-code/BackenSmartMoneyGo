// controllers/summaryController.js
import moment from 'moment';
import { io } from '../index.js'; 
import Loan from '../models/Loan.js';
import Payment from '../models/Payment.js';
import Client from '../models/Client.js';
import Finance from '../models/Finance.js';
import Bill from '../models/Bill.js';
import Withdrawal from '../models/Withdrawal.js';

// Helpers
import {
  agruparPagosPorCliente,
  calcPagosPendientesHoy,
  calcPagosPendientesManana,
  calclMonthPayments,
  monthCreatedLoans,
  calcPostPayments,
  calcularMontoNoRecaudado,
  agruparPagosPorMes,
  contarImpagosPorMes,
} from '../helpers/finanzasHelpers.js';

export const getSummary = async (req, res) => {
  try {
    const user = req.user?.user;
    if (!user) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    const userAccessList = user?.accessTo || [ user._id ];

    // FILTRO base => { createdBy: { $in: userAccessList } }
    const filter = { createdBy: { $in: userAccessList } };

    /* 
     * 1) TRAEMOS Loans, Payments (con proyección), 
     *    y LUEGO HACEMOS agregaciones para capital, etc.
     */

    // A) Loans con proyección (solo traemos campos que necesitamos):
    const allLoans = await Loan.find(
      filter,
      // Proyección:
      "loanAmount interest installments balance installmentValue date finishDate terminated clientId"
    ).populate(
      "clientId", // Populate con proyección de Client 
      "name document" // Ejemplo: solo name y document
    );

    // B) Payments con proyección (solo amount, date, loanId):
    const allPayments = await Payment.find(
      filter,
      // Proyección:
      "loanId amount date isPaid"
    ).populate(
      // Populate loanId, si necesitas clientId dentro:
      "loanId", 
      "clientId"
    );

    // C) Aggregation para capital (Finance):
    const [capitalAgg] = await Finance.aggregate([
      { $match: { createdBy: { $in: userAccessList } } },
      { $group: { _id: null, total: { $sum: "$capital" } } }
    ]);
    const totalCapital = capitalAgg?.total || 0;

    // D) Aggregation para “préstamos entregados” (Loan.loanAmount):
    const [prestamosAgg] = await Loan.aggregate([
      { $match: { createdBy: { $in: userAccessList } } },
      { $group: { _id: null, total: { $sum: "$loanAmount" } } }
    ]);
    const totalPrestamos = prestamosAgg?.total || 0;

    // E) Aggregation Bills:
    const [billsAgg] = await Bill.aggregate([
      { $match: { createdBy: { $in: userAccessList } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalBills = billsAgg?.total || 0;

    // F) Aggregation Withdrawals:
    const [withdAgg] = await Withdrawal.aggregate([
      { $match: { createdBy: { $in: userAccessList } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalWithdrawals = withdAgg?.total || 0;

    // G) Aggregation totalPayments:
    const [paymentsAgg] = await Payment.aggregate([
      { $match: { createdBy: { $in: userAccessList } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalPayments = paymentsAgg?.total || 0;

    /* 
     * 2) Para “pendientes de hoy/mañana” se necesita la lógica 
     *    de agruparPagosPorCliente (HELPER).
     *    No podemos usar un aggregator simple. 
     */
    const pagosAgrupados = await agruparPagosPorCliente(allPayments, allLoans);

    // A) calcPagosPendientesHoy
    const pendientesHoyArray = calcPagosPendientesHoy(pagosAgrupados);
    const pendingPaymentsToday = pendientesHoyArray.reduce(
      (acc, p) => acc + (p.montoPendiente || 0),
      0
    );

    // B) calcPagosPendientesManana
    const pendientesMananaArray = calcPagosPendientesManana(pagosAgrupados);
    const pendingPaymentsTomorrow = pendientesMananaArray.reduce(
      (acc, p) => acc + (p.montoPendiente || 0),
      0
    );

    /* 
     * 3) Pagos HOY => en lugar de agrupar en aggregator, 
     *    es simple filtrar: 
     */
    const startOfToday = moment().startOf("day").toDate();
    const endOfToday   = moment().endOf("day").toDate();

    // Filtrar array allPayments (ya lo tenemos en memoria)
    const paymentsTodayDetails = allPayments.filter((p) => {
      const f = new Date(p.date);
      return f >= startOfToday && f <= endOfToday;
    });
    const totalPaymentsToday = paymentsTodayDetails.reduce(
      (acc, p) => acc + (p.amount || 0),
      0
    );
    const todayPaymentsCount = paymentsTodayDetails.length;

    /* 
     * 4) Clients y Loans de HOY / AYER:
     *    Aquí sí podemos usar la proyección, 
     *    pero no pasa nada si no la usas.
     */
    const [clientsTodayList, loansTodayList, loansYesterdayList] = await Promise.all([
      Client.find({
        createdBy: { $in: userAccessList },
        date: { $gte: startOfToday, $lte: endOfToday },
      }, "name document date"), // Proyección opcional

      Loan.find({
        createdBy: { $in: userAccessList },
        date: { $gte: startOfToday, $lte: endOfToday },
      }, "loanAmount date"), // Proyección opcional

      Loan.find({
        createdBy: { $in: userAccessList },
        date: {
          $gte: moment().subtract(1, "day").startOf("day").toDate(),
          $lte: moment().subtract(1, "day").endOf("day").toDate(),
        },
      }, "loanAmount date")
    ]);

    const createdClientsTodayCount = clientsTodayList.length;
    const createdLoansTodayCount   = loansTodayList.length;
    const createdLoansYesterdayCount = loansYesterdayList.length;

    /* 
     * 5) Cálculos del mes => recaudado, préstamos creados,
     *    impagos, pagos registrados => 
     *    Mantenemos la lógica:
     */
    const monthRecaudado        = calclMonthPayments(allPayments);
    const monthLoansCreated     = monthCreatedLoans(allLoans);
    const monthImpagos          = calcularMontoNoRecaudado(pagosAgrupados);
    const monthPagosRegistrados = calcPostPayments(allPayments);

    /* 
     * 6) Gráficas => pagosPorMes, impagos => 
     */
    const pagosPorMes = agruparPagosPorMes(allPayments);
    const impagos     = contarImpagosPorMes(pagosAgrupados);

    /* 
     * 7) SALDO CAJA => con data ya calculada por aggregator:
     */
    const saldoCaja = totalCapital - totalPrestamos + totalPayments - totalBills - totalWithdrawals;

    // 8) Construir summary
    const summary = {
      pendingPaymentsToday,
      pendingPaymentsTodayDetails: pendientesHoyArray,
      pendingPaymentsTomorrow,
      pendingPaymentsTomorrowDetails: pendientesMananaArray,

      totalPaymentsToday,
      todayPaymentsCount,

      createdClientsTodayCount,
      createdLoansTodayCount,
      createdLoansYesterdayCount,

      saldoCaja,

      monthRecaudado,
      monthLoansCreated,
      monthImpagos,
      monthPagosRegistrados,

      pagosPorMes,
      impagos,

      paymentsTodayDetails,
      clientsTodayList,
      loansTodayList,
      loansYesterdayList,
    };

    // Emitimos por Socket.IO
    io.emit("summaryUpdated", summary);

    res.json(summary);
  } catch (error) {
    console.error("Error getSummary con optimizaciones:", error);
    res.status(500).json({ message: "Error al obtener el resumen" });
  }
};
