import { Router } from "express";
import { z } from "zod";
import { aFechaUTC, diaArgentina, esFechaValida, sumarDias } from "../lib/agenda";
import { requiereRol, requiereSesion } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { CANTIDAD_COLUMNAS, escribirInforme } from "../lib/informe";

// Estadísticas de la clínica para un período (fechas en hora argentina, ambas inclusive).
export const estadisticasRouter = Router();
estadisticasRouter.use(requiereSesion, requiereRol("VETERINARIO", "ADMIN"));

const MAX_DIAS = 400;
const DIAS_PARA_VOLVER = 30; // un aviso "recupera" al cliente si saca turno dentro de este plazo

function diasEntre(desde: string, hasta: string) {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / (24 * 3600 * 1000)) + 1;
}

// Números principales de un período, para compararlos con el período anterior.
async function resumen(clinicaId: number, inicio: Date, fin: Date) {
  const [porEstado, clientesNuevos, consultas, cobrado] = await Promise.all([
    prisma.turno.groupBy({
      by: ["estado"],
      where: { clinicaId, fechaHoraInicio: { gte: inicio, lt: fin } },
      _count: true,
    }),
    prisma.cliente.count({ where: { clinicaId, creadoEn: { gte: inicio, lt: fin } } }),
    prisma.consulta.count({ where: { mascota: { cliente: { clinicaId } }, fecha: { gte: inicio, lt: fin } } }),
    prisma.pago.aggregate({ where: { clinicaId, anulado: false, fecha: { gte: inicio, lt: fin } }, _sum: { monto: true } }),
  ]);
  const cuenta = (estado: string) => porEstado.find((e) => e.estado === estado)?._count ?? 0;
  const atendidos = cuenta("ATENDIDO");
  const ausentes = cuenta("AUSENTE");
  return {
    turnos: porEstado.reduce((t, e) => t + (e.estado === "CANCELADO" ? 0 : e._count), 0),
    atendidos,
    ausentes,
    cancelados: cuenta("CANCELADO"),
    // Ausentismo sobre los turnos que ya se resolvieron (vino o no vino).
    ausentismo: atendidos + ausentes > 0 ? ausentes / (atendidos + ausentes) : null,
    clientesNuevos,
    consultas,
    ingresos: Number(cobrado._sum.monto ?? 0),
  };
}

// Lee "desde" y "hasta" de la dirección (por defecto, este mes). Devuelve null si el período no sirve.
function leerPeriodo(query: Record<string, unknown>) {
  const hoy = diaArgentina(new Date());
  const desde = esFechaValida(query.desde) ? query.desde : `${hoy.slice(0, 8)}01`;
  const hasta = esFechaValida(query.hasta) ? query.hasta : hoy;
  if (hasta < desde || diasEntre(desde, hasta) > MAX_DIAS) return null;
  return { desde, hasta };
}

// Informe: todos los turnos del período, con lo necesario para listarlos, filtrarlos e imprimirlos.
estadisticasRouter.get("/turnos", async (req, res) => {
  const periodo = leerPeriodo(req.query);
  if (!periodo) {
    res.status(400).json({ error: "Período inválido" });
    return;
  }
  const turnos = await prisma.turno.findMany({
    where: {
      clinicaId: req.usuario!.clinicaId,
      fechaHoraInicio: { gte: aFechaUTC(periodo.desde, "00:00"), lt: aFechaUTC(sumarDias(periodo.hasta, 1), "00:00") },
    },
    select: {
      id: true,
      fechaHoraInicio: true,
      estado: true,
      origen: true,
      servicio: { select: { id: true, nombre: true } },
      veterinario: { select: { id: true, nombre: true, apellido: true } },
      mascota: { select: { nombre: true, cliente: { select: { nombre: true, apellido: true } } } },
    },
    orderBy: { fechaHoraInicio: "asc" },
  });
  res.json(turnos);
});

// El mismo informe en PDF. La pantalla manda las filas ya filtradas y escritas como se ven,
// así el papel muestra exactamente lo mismo que el panel.
const esquemaInforme = z.object({
  subtitulo: z.string().max(300),
  totales: z.array(z.object({ texto: z.string().max(40), valor: z.number().int().min(0) })).max(10),
  filas: z.array(z.array(z.string().max(200)).length(CANTIDAD_COLUMNAS)).max(5000),
});

estadisticasRouter.post("/informe.pdf", async (req, res) => {
  const datos = esquemaInforme.safeParse(req.body);
  if (!datos.success) {
    res.status(400).json({ error: "No se pudo armar el PDF con esos datos" });
    return;
  }
  const clinica = await prisma.clinica.findUniqueOrThrow({ where: { id: req.usuario!.clinicaId } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="informe-de-turnos.pdf"');
  res.setHeader("Cache-Control", "no-store");
  escribirInforme(datos.data, clinica, res);
});

estadisticasRouter.get("/", async (req, res) => {
  const periodo = leerPeriodo(req.query);
  if (!periodo) {
    res.status(400).json({ error: "Período inválido" });
    return;
  }
  const { desde, hasta } = periodo;
  const clinicaId = req.usuario!.clinicaId;
  const inicio = aFechaUTC(desde, "00:00");
  const fin = aFechaUTC(sumarDias(hasta, 1), "00:00");

  // Período anterior de la misma duración, para comparar.
  const largo = diasEntre(desde, hasta);
  const inicioAnterior = aFechaUTC(sumarDias(desde, -largo), "00:00");

  const [actual, anterior, turnos, recordatorios, pagos] = await Promise.all([
    resumen(clinicaId, inicio, fin),
    resumen(clinicaId, inicioAnterior, inicio),
    prisma.turno.findMany({
      where: { clinicaId, fechaHoraInicio: { gte: inicio, lt: fin }, estado: { not: "CANCELADO" } },
      select: { fechaHoraInicio: true, origen: true, servicio: { select: { nombre: true } } },
    }),
    prisma.recordatorio.findMany({
      where: { cliente: { clinicaId }, enviadoEn: { gte: inicio, lt: fin } },
      select: {
        tipo: true,
        enviadoEn: true,
        cliente: {
          select: {
            mascotas: {
              select: {
                turnos: { where: { estado: { not: "CANCELADO" } }, select: { creadoEn: true } },
              },
            },
          },
        },
      },
    }),
    prisma.pago.findMany({
      where: { clinicaId, anulado: false, fecha: { gte: inicio, lt: fin } },
      select: { monto: true, medio: true, turno: { select: { servicio: { select: { nombre: true } } } } },
    }),
  ]);

  // Ingresos por medio de pago y por servicio (lo cobrado sin turno va en "Otros cobros").
  const ingresosPorMedio = { EFECTIVO: 0, TRANSFERENCIA: 0, DEBITO: 0, CREDITO: 0 };
  const ingresosPorServicio = new Map<string, number>();
  for (const p of pagos) {
    if (p.medio === "SIN_CARGO") continue;
    const monto = Number(p.monto);
    ingresosPorMedio[p.medio] += monto;
    const nombre = p.turno?.servicio.nombre ?? "Otros cobros";
    ingresosPorServicio.set(nombre, (ingresosPorServicio.get(nombre) ?? 0) + monto);
  }

  // Turnos por día (la pantalla los agrupa por semana o mes según el largo del período).
  const porDia = new Map<string, number>();
  const porDiaSemana = [0, 0, 0, 0, 0, 0, 0]; // 0 = domingo
  const porServicio = new Map<string, number>();
  const porOrigen = { ONLINE: 0, TELEFONO: 0, MOSTRADOR: 0 };
  for (const t of turnos) {
    const dia = diaArgentina(t.fechaHoraInicio);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    porDiaSemana[new Date(`${dia}T12:00:00Z`).getUTCDay()]++;
    porServicio.set(t.servicio.nombre, (porServicio.get(t.servicio.nombre) ?? 0) + 1);
    porOrigen[t.origen]++;
  }

  // Avisos enviados y cuántos terminaron en un turno nuevo dentro de los 30 días siguientes.
  const avisos = { TURNO: 0, VACUNA: 0, DESPARASITACION: 0, RECUPERO: 0, CARNET: 0 };
  let avisosQueVolvieron = 0;
  let recuperados = 0;
  for (const r of recordatorios) {
    avisos[r.tipo]++;
    if (r.tipo === "TURNO" || r.tipo === "CARNET") continue;
    const limite = r.enviadoEn.getTime() + DIAS_PARA_VOLVER * 24 * 3600 * 1000;
    const volvio = r.cliente.mascotas.some((m) =>
      m.turnos.some((t) => t.creadoEn >= r.enviadoEn && t.creadoEn.getTime() <= limite),
    );
    if (volvio) {
      avisosQueVolvieron++;
      if (r.tipo === "RECUPERO") recuperados++;
    }
  }

  res.json({
    desde,
    hasta,
    actual,
    anterior,
    porDia: [...porDia].map(([fecha, total]) => ({ fecha, total })).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    porDiaSemana,
    porServicio: [...porServicio]
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total),
    porOrigen,
    avisos,
    avisosQueVolvieron,
    recuperados,
    ingresosPorMedio,
    ingresosPorServicio: [...ingresosPorServicio]
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total),
  });
});
