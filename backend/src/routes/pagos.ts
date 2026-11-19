import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { aFechaUTC, diaArgentina, esFechaValida, sumarDias } from "../lib/agenda";
import { requiereRol, requiereSesion } from "../lib/auth";
import { CANTIDAD_COLUMNAS_PAGOS, escribirInformePagos } from "../lib/informe";
import { prisma } from "../lib/prisma";

// Registro de pagos en la clínica (en la web no se paga nada).
// Un turno atendido queda "Por cobrar" solo, con el precio del servicio ya puesto. Se cobra con un toque,
// eligiendo el medio. Los pagos nunca se borran: si hubo un error se anulan y queda quién y por qué.
export const pagosRouter = Router();
pagosRouter.use(requiereSesion, requiereRol("VETERINARIO", "ADMIN"));

const MEDIOS = ["EFECTIVO", "TRANSFERENCIA", "DEBITO", "CREDITO", "SIN_CARGO"] as const;
const MAX_DIAS = 400;
const DIAS_POR_COBRAR_SIN_FECHA = 30; // si la clínica no tiene "pagos desde", se mira el último mes

class ErrorPago extends Error {
  constructor(
    public estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

const persona = { select: { id: true, nombre: true, apellido: true } };
const conDatos = {
  cliente: { select: { id: true, nombre: true, apellido: true, telefono: true } },
  turno: { select: { id: true, fechaHoraInicio: true, mascota: { select: { id: true, nombre: true } } } },
  registradoPor: persona,
  anuladoPor: persona,
} satisfies Prisma.PagoInclude;

type PagoConDatos = Prisma.PagoGetPayload<{ include: typeof conDatos }>;

// El monto viaja como número (en la base es decimal, para no perder centavos al sumar).
function aJson(p: PagoConDatos) {
  return { ...p, monto: Number(p.monto) };
}

function totalesDe(pagos: { monto: Prisma.Decimal | number; medio: string; anulado: boolean }[]) {
  const porMedio: Record<string, number> = { EFECTIVO: 0, TRANSFERENCIA: 0, DEBITO: 0, CREDITO: 0, SIN_CARGO: 0 };
  let total = 0;
  let cantidad = 0;
  for (const p of pagos) {
    if (p.anulado) continue;
    const monto = Number(p.monto);
    porMedio[p.medio] += monto;
    total += monto;
    cantidad++;
  }
  return { total, cantidad, porMedio };
}

// Turnos atendidos que todavía no tienen un pago (ni uno "sin cargo"). Opcional: de un solo cliente.
async function turnosPorCobrar(clinicaId: number, clienteId?: number) {
  const clinica = await prisma.clinica.findUniqueOrThrow({ where: { id: clinicaId }, select: { pagosDesde: true } });
  const desde = clinica.pagosDesde ?? new Date(Date.now() - DIAS_POR_COBRAR_SIN_FECHA * 24 * 3600 * 1000);
  const turnos = await prisma.turno.findMany({
    where: {
      clinicaId,
      estado: "ATENDIDO",
      fechaHoraInicio: { gte: desde },
      pagos: { none: { anulado: false } },
      ...(clienteId ? { mascota: { clienteId } } : {}),
    },
    select: {
      id: true,
      fechaHoraInicio: true,
      servicio: { select: { id: true, nombre: true, precioReferencia: true } },
      veterinario: persona,
      mascota: {
        select: { id: true, nombre: true, cliente: { select: { id: true, nombre: true, apellido: true, telefono: true } } },
      },
    },
    orderBy: { fechaHoraInicio: "desc" },
  });
  return turnos.map((t) => ({
    ...t,
    servicio: { ...t.servicio, precioReferencia: t.servicio.precioReferencia === null ? null : Number(t.servicio.precioReferencia) },
  }));
}

pagosRouter.get("/por-cobrar", async (req, res) => {
  const clienteId = Number(req.query.clienteId) || undefined;
  res.json(await turnosPorCobrar(req.usuario!.clinicaId, clienteId));
});

// Para la pantalla "Hoy": lo cobrado hoy por medio y cuánto queda por cobrar.
pagosRouter.get("/resumen-hoy", async (req, res) => {
  const clinicaId = req.usuario!.clinicaId;
  const hoy = diaArgentina(new Date());
  const [pagos, porCobrar] = await Promise.all([
    prisma.pago.findMany({
      where: { clinicaId, fecha: { gte: aFechaUTC(hoy, "00:00"), lt: aFechaUTC(sumarDias(hoy, 1), "00:00") } },
      select: { monto: true, medio: true, anulado: true },
    }),
    turnosPorCobrar(clinicaId),
  ]);
  res.json({
    ...totalesDe(pagos),
    porCobrar: porCobrar.length,
    // Lo que se puede estimar (los servicios sin precio no suman)
    montoPorCobrar: porCobrar.reduce((s, t) => s + (t.servicio.precioReferencia ?? 0), 0),
  });
});

// Listado: entre dos fechas (por defecto, hoy), o todos los de un cliente (para su ficha).
pagosRouter.get("/", async (req, res) => {
  const clinicaId = req.usuario!.clinicaId;
  const clienteId = Number(req.query.clienteId) || undefined;
  const where: Prisma.PagoWhereInput = { clinicaId };
  if (clienteId) {
    where.clienteId = clienteId;
  } else {
    const hoy = diaArgentina(new Date());
    const desde = esFechaValida(req.query.desde) ? req.query.desde : hoy;
    const hasta = esFechaValida(req.query.hasta) ? req.query.hasta : desde;
    const dias = Math.round((Date.parse(hasta) - Date.parse(desde)) / (24 * 3600 * 1000)) + 1;
    if (hasta < desde || dias > MAX_DIAS) {
      res.status(400).json({ error: "Revisá las fechas: Hasta tiene que ser igual o posterior a Desde" });
      return;
    }
    where.fecha = { gte: aFechaUTC(desde, "00:00"), lt: aFechaUTC(sumarDias(hasta, 1), "00:00") };
  }
  const pagos = await prisma.pago.findMany({
    where,
    include: conDatos,
    orderBy: { fecha: "desc" },
    ...(clienteId ? { take: 100 } : {}),
  });
  res.json({ pagos: pagos.map(aJson), ...totalesDe(pagos) });
});

const esquemaPago = z
  .object({
    turnoId: z.number().int().positive().optional(),
    clienteId: z.number().int().positive().optional(),
    monto: z.number().min(0, "El monto no puede ser negativo").max(10_000_000, "Revisá el monto"),
    medio: z.enum(MEDIOS, "Elegí cómo pagó"),
    concepto: z.string().trim().max(120, "El concepto es muy largo").optional(),
    nota: z.string().trim().max(190, "La nota es muy larga").optional(),
  })
  .refine((d) => d.medio === "SIN_CARGO" || d.monto > 0, { message: "Escribí el monto", path: ["monto"] })
  .refine((d) => d.turnoId || d.concepto, { message: "Escribí qué se cobró", path: ["concepto"] });

pagosRouter.post("/", async (req, res) => {
  const datos = esquemaPago.safeParse(req.body);
  if (!datos.success) {
    res.status(400).json({ error: datos.error.issues[0].message });
    return;
  }
  const d = datos.data;
  const clinicaId = req.usuario!.clinicaId;
  const monto = d.medio === "SIN_CARGO" ? 0 : Math.round(d.monto * 100) / 100;
  try {
    const pago = await prisma.$transaction(async (tx) => {
      let clienteId: number | null = null;
      let concepto = d.concepto ?? "";
      if (d.turnoId) {
        // Se traba el turno mientras se cobra: si tocan "Cobrar" dos veces (o en dos compus), cobra una sola.
        await tx.$queryRaw`SELECT id_turno FROM turno WHERE id_turno = ${d.turnoId} FOR UPDATE`;
        const turno = await tx.turno.findFirst({
          where: { id: d.turnoId, clinicaId },
          select: {
            estado: true,
            servicio: { select: { nombre: true } },
            mascota: { select: { nombre: true, clienteId: true } },
          },
        });
        if (!turno) throw new ErrorPago(404, "Turno no encontrado");
        if (turno.estado === "CANCELADO") throw new ErrorPago(400, "Ese turno está cancelado");
        if (await tx.pago.findFirst({ where: { turnoId: d.turnoId, anulado: false } })) {
          throw new ErrorPago(409, "Ese turno ya está cobrado");
        }
        clienteId = turno.mascota.clienteId;
        concepto = concepto || `${turno.servicio.nombre} · ${turno.mascota.nombre}`;
      } else if (d.clienteId) {
        if (!(await tx.cliente.findFirst({ where: { id: d.clienteId, clinicaId } }))) {
          throw new ErrorPago(404, "Cliente no encontrado");
        }
        clienteId = d.clienteId;
      }
      return tx.pago.create({
        data: {
          clinicaId,
          clienteId,
          turnoId: d.turnoId ?? null,
          monto,
          medio: d.medio,
          concepto,
          nota: d.nota || null,
          registradoPorId: req.usuario!.id,
        },
        include: conDatos,
      });
    });
    res.status(201).json(aJson(pago));
  } catch (err) {
    if (err instanceof ErrorPago) {
      res.status(err.estado).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// Anular: el administrador, siempre; el veterinario, solo un pago suyo de hoy (para corregir un error al toque).
const esquemaAnular = z.object({
  motivo: z.string().trim().min(3, "Escribí por qué se anula").max(190, "El motivo es muy largo"),
});

pagosRouter.patch("/:id/anular", async (req, res) => {
  const datos = esquemaAnular.safeParse(req.body);
  if (!datos.success) {
    res.status(400).json({ error: datos.error.issues[0].message });
    return;
  }
  const pago = await prisma.pago.findFirst({ where: { id: Number(req.params.id), clinicaId: req.usuario!.clinicaId } });
  if (!pago) {
    res.status(404).json({ error: "Pago no encontrado" });
    return;
  }
  if (pago.anulado) {
    res.status(400).json({ error: "Ese pago ya está anulado" });
    return;
  }
  const esAdmin = req.usuario!.rol === "ADMIN";
  const esSuyoDeHoy = pago.registradoPorId === req.usuario!.id && diaArgentina(pago.fecha) === diaArgentina(new Date());
  if (!esAdmin && !esSuyoDeHoy) {
    res.status(403).json({ error: "Solo la veterinaria o el veterinario a cargo puede anular este pago" });
    return;
  }
  const anulado = await prisma.pago.update({
    where: { id: pago.id },
    data: { anulado: true, anuladoEn: new Date(), anuladoPorId: req.usuario!.id, motivoAnulacion: datos.data.motivo },
    include: conDatos,
  });
  res.json(aJson(anulado));
});

// El informe en PDF. Como en el de turnos, la pantalla manda las filas ya escritas como se ven.
const esquemaInforme = z.object({
  subtitulo: z.string().max(300),
  resumen: z.string().max(400),
  filas: z.array(z.array(z.string().max(200)).length(CANTIDAD_COLUMNAS_PAGOS)).max(5000),
});

pagosRouter.post("/informe.pdf", async (req, res) => {
  const datos = esquemaInforme.safeParse(req.body);
  if (!datos.success) {
    res.status(400).json({ error: "No se pudo armar el PDF con esos datos" });
    return;
  }
  const clinica = await prisma.clinica.findUniqueOrThrow({ where: { id: req.usuario!.clinicaId } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="informe-de-pagos.pdf"');
  res.setHeader("Cache-Control", "no-store");
  escribirInformePagos(datos.data, clinica, res);
});

// Un pago, para su comprobante (se imprime o se manda por WhatsApp).
pagosRouter.get("/:id", async (req, res) => {
  const pago = await prisma.pago.findFirst({
    where: { id: Number(req.params.id) || 0, clinicaId: req.usuario!.clinicaId },
    include: conDatos,
  });
  if (!pago) {
    res.status(404).json({ error: "Pago no encontrado" });
    return;
  }
  res.json(aJson(pago));
});
