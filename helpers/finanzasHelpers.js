//JohnF-code JaJaJaJa
// BackenSmartMoneyGo/finanzasHelpers/index.js

/**
 * Función para formatear una fecha en formato "YYYY-MM-DD"
 */
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parsea una fecha en formato "YYYY-MM-DD" como fecha local (sin desfase UTC)
 */
export function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Ajusta una fecha para eliminar el desfase de la zona horaria 
 * (convierte a UTC sin cambiar el día)
 */
export function adjustToUTC(date) {
  const adjusted = new Date(date);
  adjusted.setMinutes(adjusted.getMinutes() - adjusted.getTimezoneOffset());
  return adjusted;
}

/**
 * Calcula la fecha de finalización del préstamo.
 * Se cuenta la cuota del mismo día de inicio (si no es domingo) y se avanza
 * hasta cumplir el número total de cuotas.
 * Esta versión incluye el día de inicio como cuota si éste no es domingo.
 */
export function calculateEndDate(fechaInicio, numeroCuotas) {
  let fecha = new Date(fechaInicio);
  let count = 0;
  // Si el día de inicio no es domingo, se cuenta como cuota 1
  if (fecha.getDay() !== 0) {
    count++;
  }
  while (count < Number(numeroCuotas)) {
    fecha.setDate(fecha.getDate() + 1);
    if (fecha.getDay() !== 0) {
      count++;
    }
  }
  return formatLocalDate(fecha);
}

/* --------------------------
   Otras funciones de finanzas
----------------------------- */

export function calcularDiasAtraso(fechaFinalizacion, fechaPago) {
  const fechaFin = new Date(fechaFinalizacion);
  const fechaPag = new Date(fechaPago);
  const diferenciaMs = fechaPag - fechaFin;
  const diferenciaDias = diferenciaMs / (1000 * 60 * 60 * 24);
  return diferenciaDias < 0 ? 0 : Math.ceil(diferenciaDias);
}

export function agruparPagosPorCliente(pagos, prestamos) {
  return new Promise((resolve) => {
    const loans = [];
    try {
      const pagosValidos = pagos.filter((p) => p?.loanId?._id);
      prestamos.forEach((prestamo) => {
        const currentPayments = pagosValidos.filter(
          (p) => p.loanId._id.toString() === prestamo._id.toString()
        );
        loans.push({
          ...prestamo._doc,
          pagos: currentPayments,
        });
      });
      resolve(loans);
    } catch (error) {
      console.error("Error en agruparPagosPorCliente:", error);
      resolve([]);
    }
  });
}

export function formatearFecha(fecha) {
  const opciones = { year: "numeric", month: "2-digit", day: "2-digit" };
  const date = new Date(fecha);
  return date.toLocaleDateString("es-CO", opciones);
}

export function calcularMontoNoRecaudado(prestamos) {
  let montoNoRecaudadoTotal = 0;
  prestamos.forEach((prestamo) => {
    if (!prestamo.terminated) {
      const fechaInicio = new Date(prestamo.date);
      const fechaActual = new Date();
      const diasTranscurridos = (fechaActual - fechaInicio) / (1000 * 60 * 60 * 24);
      let money = prestamo.loanAmount * (1 + prestamo.interest / 100);
      const cuota = prestamo.installmentValue || 0;
      let i = 0;
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

export function calcPagosPendientesHoy(pagosAgrupados) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let pagosPendientesHoy = [];
  pagosAgrupados.forEach((prestamo) => {
    if (!prestamo.terminated) {
      let fechaPagoEsperada = new Date(prestamo.date);
      fechaPagoEsperada.setHours(0, 0, 0, 0);
      let fechaFinal = prestamo.finishDate ? new Date(prestamo.finishDate) : new Date();
      if (!prestamo.finishDate) {
        fechaFinal.setDate(fechaFinal.getDate() + 365);
      }
      fechaFinal.setHours(0, 0, 0, 0);
      fechaFinal.setDate(fechaFinal.getDate() + 1);
      const montoCuota =
        (prestamo.loanAmount + prestamo.loanAmount * (prestamo.interest / 100)) /
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
      let fechaFinal = prestamo.finishDate ? new Date(prestamo.finishDate) : new Date();
      if (!prestamo.finishDate) {
        fechaFinal.setDate(fechaFinal.getDate() + 365);
      }
      fechaFinal.setHours(0, 0, 0, 0);
      fechaFinal.setDate(fechaFinal.getDate() + 1);
      const montoCuota =
        (prestamo.loanAmount + prestamo.loanAmount * (prestamo.interest / 100)) /
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
