import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { aFechaUTC, diaArgentina, esFechaValida, sumarDias } from "../lib/agenda";
import { requiereRol, requiereSesion } from "../lib/auth";
import { registrarCambio } from "../lib/auditoria";
import { PERSONAL, requierePermiso } from "../lib/permisos";
import { CANTIDAD_COLUMNAS_PAGOS, escribirInformePagos } from "../lib/informe";
import { prisma } from "../lib/prisma";
import { bloquearAgenda } from "../lib/sanciones";

// Registro de pagos en la clínica (en la web no se paga nada).
// Un turno atendido queda "Por cobrar" solo, con el precio del servicio ya puesto. Se cobra con un toque,
// eligiendo el medio. Los pagos nunca se borran: si hubo un error se anulan y queda quién y por qué.
export const pagosRouter = Router();
// Todo el personal ve la caja; cobrar es de administración y recepción.
pagosRouter.use(requiereSesion, requiereRol(...PERSONAL), requierePermiso("pagos.ver"));

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
  presupuesto: { select: { id: true, titulo: true } },
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
      servicio: { select: { id: true, nombre: true, precioReferencia: true, categoria: true } },
      veterinario: persona,
      mascota: {
        select: { id: true, nombre: true, cliente: { select: { id: true, nombre: true, apellido: true, telefono: true } } },
      },
    },
    orderBy: { fechaHoraInicio: "desc" },
  });
  // Si la mascota tiene un presupuesto vigente para ese servicio (o, si no dice servicio, para una cirugía),
  // al cobrar el turno se descuenta lo que ya pagó a cuenta (la seña).
  const presupuestos = await prisma.presupuesto.findMany({
    where: {
      clinicaId,
      estado: "VIGENTE",
      mascotaId: { in: [...new Set(turnos.map((t) => t.mascota.id))] },
      pagos: { none: { anulado: false, turnoId: { not: null } } },
    },
    select: { id: true, titulo: true, total: true, mascotaId: true, servicioId: true, pagos: { where: { anulado: false }, select: { monto: true } } },
    orderBy: { creadoEn: "asc" },
  });
  return turnos.map(({ servicio: { categoria, ...servicio }, ...t }) => {
    const p = presupuestos.find(
      (x) => x.mascotaId === t.mascota.id && (x.servicioId ? x.servicioId === servicio.id : categoria === "CIRUGIA"),
    );
    const pagado = p ? p.pagos.reduce((s, x) => s + Number(x.monto), 0) : 0;
    return {
      ...t,
      servicio: { ...servicio, precioReferencia: servicio.precioReferencia === null ? null : Number(servicio.precioReferencia) },
      presupuesto: p
        ? { id: p.id, titulo: p.titulo, total: Number(p.total), pagado, falta: Math.max(0, Math.round((Number(p.total) - pagado) * 100) / 100) }
        : null,
    };
  });
}

pagosRouter.get("/por-cobrar", async (req, res) => {
  const clienteId = Number(req.query.clienteId) || undefined;
  res.json(await turnosPorCobrar(req.usuario!.clinicaId, clienteId));
});

// Para la pantalla "Hoy": lo cobrado hoy por medio y cuánto queda por cobrar.
pagosRouter.get("/resumen-hoy", async (req, res) => {
  const clinicaId = req.usuario!.clinicaId;
  const hoy = diaArgentina(new Date());
  const [pagos, porCobrar, cierre] = await Promise.all([
    prisma.pago.findMany({
      where: { clinicaId, fecha: { gte: aFechaUTC(hoy, "00:00"), lt: aFechaUTC(sumarDias(hoy, 1), "00:00") } },
      select: { monto: true, medio: true, anulado: true },
    }),
    turnosPorCobrar(clinicaId),
    cierreVigente(prisma, clinicaId, hoy),
  ]);
  res.json({
    ...totalesDe(pagos),
    cerradaEn: cierre?.cerradoEn ?? null,
    porCobrar: porCobrar.length,
    // Lo que se puede estimar (los servicios sin precio no suman)
    montoPorCobrar: porCobrar.reduce((s, t) => s + (t.presupuesto ? t.presupuesto.falta : (t.servicio.precioReferencia ?? 0)), 0),
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
    presupuestoId: z.number().int().positive().optional(),
    monto: z.number().min(0, "El monto no puede ser negativo").max(10_000_000, "Revisá el monto"),
    medio: z.enum(MEDIOS, "Elegí cómo pagó"),
    concepto: z.string().trim().max(120, "El concepto es muy largo").optional(),
    nota: z.string().trim().max(190, "La nota es muy larga").optional(),
  })
  .refine((d) => d.medio === "SIN_CARGO" || d.monto > 0, { message: "Escribí el monto", path: ["monto"] })
  .refine((d) => d.turnoId || d.presupuestoId || d.concepto, { message: "Escribí qué se cobró", path: ["concepto"] });

pagosRouter.post("/", requierePermiso("pagos.cobrar"), async (req, res) => {
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
      // Si la caja de hoy se está cerrando, espera; si ya está cerrada, no se cobra.
      await bloquearAgenda(tx, clinicaId);
      if (await cierreVigente(tx, clinicaId, diaArgentina(new Date()))) {
        throw new ErrorPago(409, "La caja de hoy ya está cerrada. Para cobrar, la administración la tiene que reabrir");
      }
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
      if (d.presupuestoId) {
        // Seña o pago a cuenta. Se traba el presupuesto para que dos cobros a la vez no pasen el total.
        await tx.$queryRaw`SELECT id_presupuesto FROM presupuesto WHERE id_presupuesto = ${d.presupuestoId} FOR UPDATE`;
        const p = await tx.presupuesto.findFirst({
          where: { id: d.presupuestoId, clinicaId },
          select: { titulo: true, total: true, estado: true, clienteId: true, mascota: { select: { nombre: true } }, pagos: { where: { anulado: false }, select: { monto: true, turnoId: true } } },
        });
        if (!p) throw new ErrorPago(404, "Presupuesto no encontrado");
        if (p.estado === "ANULADO") throw new ErrorPago(400, "Ese presupuesto está anulado");
        if (clienteId !== null && clienteId !== p.clienteId) throw new ErrorPago(400, "Ese presupuesto es de otro cliente");
        if (d.turnoId && p.pagos.some((x) => x.turnoId !== null)) {
          throw new ErrorPago(409, "Ese presupuesto ya se usó para cobrar otro turno");
        }
        const pagado = p.pagos.reduce((s, x) => s + Number(x.monto), 0);
        const falta = Math.round((Number(p.total) - pagado) * 100) / 100;
        if (monto > falta + 0.001) {
          throw new ErrorPago(400, falta > 0 ? `Del presupuesto falta pagar $ ${falta.toLocaleString("es-AR")}` : "El presupuesto ya está pagado");
        }
        clienteId = p.clienteId;
        const deQuien = p.mascota ? `${p.titulo} · ${p.mascota.nombre}` : p.titulo;
        if (!d.turnoId && !d.concepto) {
          const tipo = pagado === 0 ? (monto >= falta ? "Pago total" : "Seña") : monto >= falta ? "Resto" : "A cuenta";
          concepto = `${tipo} · ${deQuien}`;
        }
      }
      return tx.pago.create({
        data: {
          clinicaId,
          clienteId,
          turnoId: d.turnoId ?? null,
          presupuestoId: d.presupuestoId ?? null,
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

// ---------- Cierre de caja ----------
// Al terminar el día, quien cobra cuenta el efectivo. VetYa calcula cuánto debería haber
// (el cambio con el que se abrió + lo cobrado en efectivo) y muestra si sobra o falta.
// Con la caja cerrada no se cobra ni se anula nada de ese día; la administración la puede reabrir con motivo.

const fechaDia = (dia: string) => new Date(`${dia}T00:00:00.000Z`);

function cierreVigente(db: Prisma.TransactionClient | typeof prisma, clinicaId: number, dia: string) {
  return db.cierreCaja.findFirst({
    where: { clinicaId, dia: fechaDia(dia), reabiertoEn: null },
    include: { cerradoPor: persona },
  });
}

const conPersonas = { cerradoPor: persona, reabiertoPor: persona } satisfies Prisma.CierreCajaInclude;

function cierreAJson(c: Prisma.CierreCajaGetPayload<{ include: { cerradoPor: typeof persona } }>) {
  return {
    ...c,
    dia: c.dia.toISOString().slice(0, 10),
    cambioInicial: Number(c.cambioInicial),
    efectivoCobrado: Number(c.efectivoCobrado),
    transferencia: Number(c.transferencia),
    debito: Number(c.debito),
    credito: Number(c.credito),
    totalCobrado: Number(c.totalCobrado),
    efectivoContado: Number(c.efectivoContado),
    diferencia: Number(c.diferencia),
  };
}

async function cobrosDelDia(db: Prisma.TransactionClient | typeof prisma, clinicaId: number, dia: string) {
  const pagos = await db.pago.findMany({
    where: { clinicaId, fecha: { gte: aFechaUTC(dia, "00:00"), lt: aFechaUTC(sumarDias(dia, 1), "00:00") } },
    select: { monto: true, medio: true, anulado: true },
  });
  return totalesDe(pagos);
}

// Lo que hace falta para cerrar hoy: los cobros del día, si ya se cerró y los últimos cierres.
pagosRouter.get("/cierre", async (req, res) => {
  const clinicaId = req.usuario!.clinicaId;
  const hoy = diaArgentina(new Date());
  const [totales, cierre, porCobrar, historial] = await Promise.all([
    cobrosDelDia(prisma, clinicaId, hoy),
    cierreVigente(prisma, clinicaId, hoy),
    turnosPorCobrar(clinicaId),
    prisma.cierreCaja.findMany({
      where: { clinicaId },
      include: conPersonas,
      orderBy: { cerradoEn: "desc" },
      take: 10,
    }),
  ]);
  // El cambio para dar vuelto suele ser el mismo todos los días: se propone el del último cierre.
  const ultimo = historial.find((c) => !c.reabiertoEn);
  res.json({
    dia: hoy,
    ...totales,
    porCobrar: porCobrar.filter((t) => diaArgentina(t.fechaHoraInicio) === hoy).length,
    cambioSugerido: ultimo ? Number(ultimo.cambioInicial) : 0,
    cierre: cierre ? cierreAJson(cierre) : null,
    historial: historial.map(cierreAJson),
  });
});

const esquemaCierre = z.object({
  cambioInicial: z.number().min(0, "El cambio no puede ser negativo").max(10_000_000, "Revisá el cambio"),
  efectivoContado: z.number().min(0, "Lo contado no puede ser negativo").max(10_000_000, "Revisá lo contado"),
  nota: z.string().trim().max(300, "La nota es muy larga").optional(),
});

pagosRouter.post("/cierre", requierePermiso("pagos.cobrar"), async (req, res) => {
  const datos = esquemaCierre.safeParse(req.body);
  if (!datos.success) {
    res.status(400).json({ error: datos.error.issues[0].message });
    return;
  }
  const clinicaId = req.usuario!.clinicaId;
  const hoy = diaArgentina(new Date());
  const redondear = (n: number) => Math.round(n * 100) / 100;
  const cambioInicial = redondear(datos.data.cambioInicial);
  const efectivoContado = redondear(datos.data.efectivoContado);
  try {
    const cierre = await prisma.$transaction(async (tx) => {
      // Se traba la caja: mientras se cierra no entra ningún cobro, y dos cierres a la vez no pasan.
      await bloquearAgenda(tx, clinicaId);
      if (await cierreVigente(tx, clinicaId, hoy)) throw new ErrorPago(409, "La caja de hoy ya está cerrada");
      const t = await cobrosDelDia(tx, clinicaId, hoy);
      const diferencia = redondear(efectivoContado - (cambioInicial + t.porMedio.EFECTIVO));
      if (diferencia !== 0 && !datos.data.nota) {
        throw new ErrorPago(400, "Lo contado no coincide: escribí qué pasó en la nota");
      }
      return tx.cierreCaja.create({
        data: {
          clinicaId,
          dia: fechaDia(hoy),
          cambioInicial,
          efectivoCobrado: t.porMedio.EFECTIVO,
          transferencia: t.porMedio.TRANSFERENCIA,
          debito: t.porMedio.DEBITO,
          credito: t.porMedio.CREDITO,
          totalCobrado: t.total,
          cantidadCobros: t.cantidad,
          efectivoContado,
          diferencia,
          nota: datos.data.nota || null,
          cerradoPorId: req.usuario!.id,
        },
        include: { cerradoPor: persona },
      });
    });
    res.status(201).json(cierreAJson(cierre));
  } catch (err) {
    if (err instanceof ErrorPago) {
      res.status(err.estado).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// Reabrir: solo la administración, con motivo (queda en el Registro de cambios). Después se vuelve a cerrar.
pagosRouter.patch("/cierre/:id/reabrir", requierePermiso("ajustes"), async (req, res) => {
  const datos = esquemaAnular.safeParse(req.body);
  if (!datos.success) {
    res.status(400).json({ error: datos.error.issues[0].message.replace("se anula", "se reabre") });
    return;
  }
  const cierre = await prisma.cierreCaja.findFirst({ where: { id: Number(req.params.id), clinicaId: req.usuario!.clinicaId } });
  if (!cierre) {
    res.status(404).json({ error: "Cierre no encontrado" });
    return;
  }
  if (cierre.reabiertoEn) {
    res.status(400).json({ error: "Esa caja ya está reabierta" });
    return;
  }
  await prisma.cierreCaja.update({
    where: { id: cierre.id },
    data: { reabiertoEn: new Date(), reabiertoPorId: req.usuario!.id, motivoReapertura: datos.data.motivo },
  });
  await registrarCambio(req, {
    accion: "caja.reabrir",
    entidad: "cierre_caja",
    entidadId: cierre.id,
    resumen: `Reabrió la caja del ${cierre.dia.toISOString().slice(0, 10).split("-").reverse().join("/")}: ${datos.data.motivo}`,
  });
  res.json({ ok: true });
});

// Anular: la administración, siempre; quien cobró, solo un pago suyo de hoy (para corregir un error al toque).
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
  if (await cierreVigente(prisma, req.usuario!.clinicaId, diaArgentina(pago.fecha))) {
    res.status(409).json({ error: "La caja de ese día está cerrada. Para anular, la administración la tiene que reabrir" });
    return;
  }
  const esAdmin = req.usuario!.rol === "ADMIN";
  const esSuyoDeHoy = pago.registradoPorId === req.usuario!.id && diaArgentina(pago.fecha) === diaArgentina(new Date());
  if (!esAdmin && !esSuyoDeHoy) {
    res.status(403).json({ error: "Solo podés anular un cobro tuyo de hoy. Pedíselo a la administración" });
    return;
  }
  const anulado = await prisma.pago.update({
    where: { id: pago.id },
    data: { anulado: true, anuladoEn: new Date(), anuladoPorId: req.usuario!.id, motivoAnulacion: datos.data.motivo },
    include: conDatos,
  });
  await registrarCambio(req, {
    accion: "pago.anular",
    entidad: "pago",
    entidadId: pago.id,
    resumen: `Anuló el cobro N.º ${pago.id} ($ ${Number(pago.monto).toLocaleString("es-AR")}): ${datos.data.motivo}`,
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
