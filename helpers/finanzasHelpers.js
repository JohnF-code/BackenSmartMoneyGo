//--------------------------------------------
// LOGICA FUNCIONES QUE SE PROCESABAN ANTES EN EL FRONTEND
// AHORA EN BACKEND
//--------------------------------------------
export function calculateEndDate(fechaInicio, numeroCuotas) {
  let fecha = new Date(fechaInicio);
  let cuotasRestantes = numeroCuotas;

  while (cuotasRestantes > 0) {
    fecha.setDate(fecha.getDate() + 1);
    if (fecha.getDay() !== 0) {
      // Excluir domingos
      cuotasRestantes--;
    }
  }
  return fecha.toISOString().split("T")[0];
}

export function calcularDiasAtraso(fechaFinalizacion, fechaPago) {
  const fechaFin = new Date(fechaFinalizacion);
  const fechaPag = new Date(fechaPago);
  const diferenciaMs = fechaPag - fechaFin;
  const diferenciaDias = diferenciaMs / (1000 * 60 * 60 * 24);
  return diferenciaDias < 0 ? 0 : Math.ceil(diferenciaDias);
}

/**
 * agruparPagosPorCliente:
 * Recibe un array de pagos (Payments) y un array de préstamos (Loans),
 * retorna un array de “préstamos” con un nuevo campo “pagos” con los Payments correspondientes.
 */
export function agruparPagosPorCliente(pagos, prestamos) {
  return new Promise((resolve) => {
    const loans = [];
    try {
      // Filtrar solo los pagos que tengan un loanId válido
      const pagosValidos = pagos.filter((p) => p?.loanId?._id);

      prestamos.forEach((prestamo) => {
        const currentPayments = pagosValidos.filter(
          (p) => p.loanId._id.toString() === prestamo._id.toString()
        );
        loans.push({
          ...prestamo._doc, // ._doc para obtener solo datos sin métodos
          pagos: currentPayments,
        });
      });
      resolve(loans);
    } catch (error) {
      console.error("Error en agruparPagosPorCliente:", error);
      resolve([]); // Devuelve array vacío si algo falla
    }
  });
}

/**
 * calcularMontoNoRecaudado:
 * Mide cuánto dinero NO se ha recaudado teniendo en cuenta un “escenario teórico”
 * de cuota diaria vs. lo que realmente debería haberse pagado hasta hoy.
 */
export function calcularMontoNoRecaudado(pagosAgrupados) {
  let montoNoRecaudadoTotal = 0;
  pagosAgrupados.forEach((prestamo) => {
    if (!prestamo.terminated) {
      const fechaInicio = new Date(prestamo.date);
      const fechaActual = new Date();
      const diasTranscurridos =
        (fechaActual - fechaInicio) / (1000 * 60 * 60 * 24);

      let i = 0;
      // Monto total (capital + interés)
      let money =
        prestamo.loanAmount + prestamo.loanAmount * (prestamo.interest / 100);
      // Cuota diaria:
      let cuota = prestamo.installmentValue || 0;

      while (i < diasTranscurridos) {
        money -= cuota;
        i++;
      }
      if (prestamo.balance > money) {
        montoNoRecaudadoTotal += prestamo.balance - money;
      }
    }
  });
  return montoNoRecaudadoTotal;
}

/**
 * calcPagosPendientesHoy: 
 * Retorna un array con objetos { cliente, montoPendiente, fechaEsperada }
 * de aquellos préstamos que HOY tienen que pagar su cuota y no lo han hecho.
 */
export function calcPagosPendientesHoy(pagosAgrupados) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let pagosPendientesHoy = [];

  pagosAgrupados.forEach((prestamo) => {
    if (!prestamo.terminated) {
      // Fecha de inicio
      let fechaPagoEsperada = new Date(prestamo.date);
      fechaPagoEsperada.setHours(0, 0, 0, 0);

      // finishDate fallback
      let fechaFinal = prestamo.finishDate
        ? new Date(prestamo.finishDate)
        : new Date();
      if (!prestamo.finishDate) {
        fechaFinal.setDate(fechaFinal.getDate() + 365);
      }
      fechaFinal.setHours(0, 0, 0, 0);
      fechaFinal.setDate(fechaFinal.getDate() + 1);

      const montoCuota =
        (prestamo.loanAmount +
          prestamo.loanAmount * (prestamo.interest / 100)) /
        (prestamo.installments || 1);

      // Acumular pagos realizados por fecha
      const pagosRealizadosPorFecha = prestamo.pagos.reduce((mapa, pago) => {
        const fPago = new Date(pago.date);
        fPago.setHours(0, 0, 0, 0);
        const key = fPago.toDateString();
        mapa[key] = (mapa[key] || 0) + (pago.amount || 0);
        return mapa;
      }, {});

      while (fechaPagoEsperada <= fechaFinal) {
        // Omitir domingos
        if (fechaPagoEsperada.getDay() !== 0) {
          const fechaClave = fechaPagoEsperada.toDateString();
          const totalPagado = pagosRealizadosPorFecha[fechaClave] || 0;

          if (
            fechaPagoEsperada.toDateString() === hoy.toDateString() &&
            totalPagado < montoCuota
          ) {
            pagosPendientesHoy.push({
              cliente: prestamo.clientId,
              montoPendiente: montoCuota - totalPagado,
              fechaEsperada: new Date(fechaPagoEsperada),
            });
          }
        }
        fechaPagoEsperada.setDate(fechaPagoEsperada.getDate() + 1);
      }
    }
  });
  return pagosPendientesHoy;
}

/**
 * calcPagosPendientesManana:
 * Igual que “calcPagosPendientesHoy” pero para MAÑANA.
 */
export function calcPagosPendientesManana(pagosAgrupados) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);

  let pagosPendientesManana = [];

  pagosAgrupados.forEach((prestamo) => {
    if (!prestamo.terminated) {
      let fechaPagoEsperada = new Date(prestamo.date);
      fechaPagoEsperada.setHours(0, 0, 0, 0);

      let fechaFinal = prestamo.finishDate
        ? new Date(prestamo.finishDate)
        : new Date();
      if (!prestamo.finishDate) {
        fechaFinal.setDate(fechaFinal.getDate() + 365);
      }
      fechaFinal.setHours(0, 0, 0, 0);
      fechaFinal.setDate(fechaFinal.getDate() + 1);

      const montoCuota =
        (prestamo.loanAmount +
          prestamo.loanAmount * (prestamo.interest / 100)) /
        (prestamo.installments || 1);

      const pagosRealizadosPorFecha = prestamo.pagos.reduce((mapa, pago) => {
        const fPago = new Date(pago.date);
        fPago.setHours(0, 0, 0, 0);
        const key = fPago.toDateString();
        mapa[key] = (mapa[key] || 0) + (pago.amount || 0);
        return mapa;
      }, {});

      while (fechaPagoEsperada <= fechaFinal) {
        if (fechaPagoEsperada.getDay() !== 0) {
          const fechaClave = fechaPagoEsperada.toDateString();
          const totalPagado = pagosRealizadosPorFecha[fechaClave] || 0;

          if (
            fechaPagoEsperada.toDateString() === manana.toDateString() &&
            totalPagado < montoCuota
          ) {
            pagosPendientesManana.push({
              cliente: prestamo.clientId,
              montoPendiente: montoCuota - totalPagado,
              fechaEsperada: new Date(fechaPagoEsperada),
            });
          }
        }
        fechaPagoEsperada.setDate(fechaPagoEsperada.getDate() + 1);
      }
    }
  });

  return pagosPendientesManana;
}

/**
 * monthCreatedLoans => cuántos préstamos se crearon en el mes actual
 */
export function monthCreatedLoans(loans) {
  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const añoActual = hoy.getFullYear();
  let count = 0;
  loans.forEach((loan) => {
    const f = new Date(loan.date);
    if (f.getMonth() === mesActual && f.getFullYear() === añoActual) {
      count++;
    }
  });
  return count;
}

/**
 * calclMonthPayments => suma total de pagos en el mes actual
 */
export function calclMonthPayments(pagos) {
  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const añoActual = hoy.getFullYear();
  let total = 0;
  pagos.forEach((pago) => {
    const fPago = new Date(pago.date);
    if (fPago.getMonth() === mesActual && fPago.getFullYear() === añoActual) {
      total += pago.amount || 0;
    }
  });
  return total;
}

/**
 * calcPostPayments => cuántos pagos se registraron en el mes actual
 */
export function calcPostPayments(pagos) {
  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const añoActual = hoy.getFullYear();
  let count = 0;
  pagos.forEach((p) => {
    const fPago = new Date(p.date);
    if (fPago.getMonth() === mesActual && fPago.getFullYear() === añoActual) {
      count++;
    }
  });
  return count;
}

/**
 * agruparPagosPorMes => Para la gráfica, agrupa todos los Payment
 * por “año-mes” y suma su “amount”.
 */
export function agruparPagosPorMes(pagos) {
  const pagosPorMes = {};
  pagos.forEach((p) => {
    const f = new Date(p.date);
    const mes = f.getMonth() + 1;
    const año = f.getFullYear();
    const key = `${año}-${mes}`;
    if (!pagosPorMes[key]) {
      pagosPorMes[key] = { year: año, month: mes, total: 0 };
    }
    pagosPorMes[key].total += p.amount || 0;
  });
  return Object.values(pagosPorMes);
}

/**
 * contarImpagosPorMes => ejemplo para la gráfica de “impagos”
 * usando la misma lógica de “fechasDePago”
 */
function obtenerFechasDePago(prestamo) {
  const fechas = [];
  let fechaActual = new Date(prestamo.date);
  const cuotaDiaria = prestamo.installmentValue || 0;
  for (let i = 0; i < (prestamo.installments || 0); i++) {
    if (fechaActual.getDay() !== 0) {
      fechas.push({ date: new Date(fechaActual), amount: cuotaDiaria });
    } else {
      i--;
    }
    fechaActual.setDate(fechaActual.getDate() + 1);
  }
  return fechas;
}
export function contarImpagosPorMes(pagosAgrupados) {
  const impagosPorMes = {};
  pagosAgrupados.forEach((prestamo) => {
    const fechasDePago = obtenerFechasDePago(prestamo);
    const pagosRegistrados = prestamo.pagos.map((p) => new Date(p.date));

    fechasDePago.forEach((fechaEsperada) => {
      const mes = fechaEsperada.date.getMonth() + 1;
      const año = fechaEsperada.date.getFullYear();
      const key = `${año}-${mes}`;

      const pagoEncontrado = pagosRegistrados.some((fPago) => {
        return (
          fPago.getFullYear() === año &&
          fPago.getMonth() === fechaEsperada.date.getMonth() &&
          fPago.getDate() === fechaEsperada.date.getDate()
        );
      });

      if (!pagoEncontrado && !prestamo.terminated) {
        if (!impagosPorMes[key]) {
          impagosPorMes[key] = { year: año, month: mes, total: 0 };
        }
        impagosPorMes[key].total += fechaEsperada.amount;
      }
    });
  });
  return Object.values(impagosPorMes);
}
