import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { aFechaUTC, diaArgentina, esFechaValida, sumarDias } from "../lib/agenda";
import { requiereRol, requiereSesion } from "../lib/auth";
import { registrarCambio } from "../lib/auditoria";
import { PERSONAL, requierePermiso } from "../lib/permisos";
import { prisma } from "../lib/prisma";

// Presupuestos para cirugías, limpiezas dentales o tratamientos largos (en la clínica; en la web no se cobra nada).
// Se le manda al dueño por WhatsApp. Si acepta, deja una seña (un pago a cuenta del presupuesto) y el día del turno
// se cobra solo lo que falta. Nunca se borran: si no va, se anulan con el motivo.
export const presupuestosRouter = Router();
// Todo el personal los ve; hacerlos y anularlos es de quien cobra (administración y recepción).
presupuestosRouter.use(requiereSesion, requiereRol(...PERSONAL), requierePermiso("pagos.ver"));

const DIAS_VALIDEZ = 15;
const persona = { select: { id: true, nombre: true, apellido: true } };
export const conDatosPresupuesto = {
  cliente: { select: { id: true, nombre: true, apellido: true, telefono: true } },
  mascota: { select: { id: true, nombre: true } },
  servicio: { select: { id: true, nombre: true } },
  items: { orderBy: { orden: "asc" } },
  pagos: {
    where: { anulado: false },
    select: { id: true, monto: true, medio: true, fecha: true, turnoId: true, concepto: true },
    orderBy: { fecha: "asc" },
  },
  creadoPor: persona,
  anuladoPor: persona,
} satisfies Prisma.PresupuestoInclude;

type PresupuestoConDatos = Prisma.PresupuestoGetPayload<{ include: typeof conDatosPresupuesto }>;

const centavos = (n: number) => Math.round(n * 100) / 100;

// Lo pagado y lo que falta no se guardan: salen de sus pagos no anulados.
// "Usado" = ya se cobró el turno con este presupuesto (no se vuelve a ofrecer al cobrar otro turno).
export function aJsonPresupuesto(p: PresupuestoConDatos) {
  const total = Number(p.total);
  const pagado = centavos(p.pagos.reduce((s, x) => s + Number(x.monto), 0));
  return {
    ...p,
    total,
    items: p.items.map((i) => ({ ...i, monto: Number(i.monto) })),
    pagos: p.pagos.map((x) => ({ ...x, monto: Number(x.monto) })),
    pagado,
    falta: Math.max(0, centavos(total - pagado)),
    usado: p.pagos.some((x) => x.turnoId !== null),
  };
}

presupuestosRouter.get("/", async (req, res) => {
  const clienteId = Number(req.query.clienteId) || 0;
  const presupuestos = await prisma.presupuesto.findMany({
    where: { clinicaId: req.usuario!.clinicaId, clienteId },
    include: conDatosPresupuesto,
    orderBy: { creadoEn: "desc" },
    take: 30,
  });
  res.json(presupuestos.map(aJsonPresupuesto));
});

// Servicios con su precio, para armar el presupuesto con un toque (el precio nunca va a la web pública).
presupuestosRouter.get("/servicios", async (req, res) => {
  const servicios = await prisma.servicio.findMany({
    where: { clinicaId: req.usuario!.clinicaId, activo: true },
    select: { id: true, nombre: true, categoria: true, precioReferencia: true },
    orderBy: { nombre: "asc" },
  });
  res.json(servicios.map((s) => ({ ...s, precioReferencia: s.precioReferencia === null ? null : Number(s.precioReferencia) })));
});

presupuestosRouter.get("/:id", async (req, res) => {
  const p = await prisma.presupuesto.findFirst({
    where: { id: Number(req.params.id) || 0, clinicaId: req.usuario!.clinicaId },
    include: conDatosPresupuesto,
  });
  if (!p) {
    res.status(404).json({ error: "Presupuesto no encontrado" });
    return;
  }
  res.json(aJsonPresupuesto(p));
});

const esquemaPresupuesto = z.object({
  clienteId: z.number().int().positive(),
  mascotaId: z.number().int().positive().optional(),
  servicioId: z.number().int().positive().optional(),
  titulo: z.string().trim().max(120, "El título es muy largo").optional(),
  items: z
    .array(
      z.object({
        descripcion: z.string().trim().min(1, "Escribí qué incluye cada renglón").max(160, "Un renglón es muy largo"),
        monto: z.number().min(0, "El monto no puede ser negativo").max(10_000_000, "Revisá el monto"),
      }),
    )
    .min(1, "Agregá al menos un renglón")
    .max(15, "Son demasiados renglones"),
  validoHasta: z.string().optional(),
  nota: z.string().trim().max(500, "La nota es muy larga").optional(),
});

presupuestosRouter.post("/", requierePermiso("pagos.cobrar"), async (req, res) => {
  const datos = esquemaPresupuesto.safeParse(req.body);
  if (!datos.success) {
    res.status(400).json({ error: datos.error.issues[0].message });
    return;
  }
  const d = datos.data;
  const clinicaId = req.usuario!.clinicaId;
  const cliente = await prisma.cliente.findFirst({ where: { id: d.clienteId, clinicaId } });
  if (!cliente) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }
  if (d.mascotaId && !(await prisma.mascota.findFirst({ where: { id: d.mascotaId, clienteId: cliente.id } }))) {
    res.status(400).json({ error: "Esa mascota no es de este cliente" });
    return;
  }
  const servicio = d.servicioId ? await prisma.servicio.findFirst({ where: { id: d.servicioId, clinicaId } }) : null;
  if (d.servicioId && !servicio) {
    res.status(400).json({ error: "Servicio no encontrado" });
    return;
  }
  const hoy = diaArgentina(new Date());
  const validoHasta = d.validoHasta ?? sumarDias(hoy, DIAS_VALIDEZ);
  if (!esFechaValida(validoHasta) || validoHasta < hoy) {
    res.status(400).json({ error: "La fecha de validez tiene que ser de hoy en adelante" });
    return;
  }
  const items = d.items.map((i, orden) => ({ descripcion: i.descripcion, monto: centavos(i.monto), orden }));
  const total = centavos(items.reduce((s, i) => s + i.monto, 0));
  if (total <= 0) {
    res.status(400).json({ error: "El total tiene que ser mayor a cero" });
    return;
  }
  const creado = await prisma.presupuesto.create({
    data: {
      clinicaId,
      clienteId: cliente.id,
      mascotaId: d.mascotaId ?? null,
      servicioId: servicio?.id ?? null,
      titulo: d.titulo || servicio?.nombre || items[0].descripcion,
      total,
      validoHasta: aFechaUTC(validoHasta, "00:00"),
      nota: d.nota || null,
      creadoPorId: req.usuario!.id,
      items: { create: items },
    },
    include: conDatosPresupuesto,
  });
  res.status(201).json(aJsonPresupuesto(creado));
});

// Anular: si no va. Si ya dejó plata a cuenta, primero se anulan (o se devuelven) esos cobros.
const esquemaAnular = z.object({
  motivo: z.string().trim().min(3, "Escribí por qué se anula").max(190, "El motivo es muy largo"),
});

presupuestosRouter.patch("/:id/anular", requierePermiso("pagos.cobrar"), async (req, res) => {
  const datos = esquemaAnular.safeParse(req.body);
  if (!datos.success) {
    res.status(400).json({ error: datos.error.issues[0].message });
    return;
  }
  const p = await prisma.presupuesto.findFirst({
    where: { id: Number(req.params.id) || 0, clinicaId: req.usuario!.clinicaId },
    include: conDatosPresupuesto,
  });
  if (!p) {
    res.status(404).json({ error: "Presupuesto no encontrado" });
    return;
  }
  if (p.estado === "ANULADO") {
    res.status(400).json({ error: "Ese presupuesto ya está anulado" });
    return;
  }
  if (p.pagos.length > 0) {
    res.status(409).json({
      error: "Tiene cobros a cuenta. Si se le devuelve la seña, anulá primero esos cobros en Pagos y después el presupuesto",
    });
    return;
  }
  const anulado = await prisma.presupuesto.update({
    where: { id: p.id },
    data: { estado: "ANULADO", anuladoEn: new Date(), anuladoPorId: req.usuario!.id, motivoAnulacion: datos.data.motivo },
    include: conDatosPresupuesto,
  });
  await registrarCambio(req, {
    accion: "presupuesto.anular",
    entidad: "presupuesto",
    entidadId: p.id,
    resumen: `Anuló el presupuesto N.º ${p.id} (${p.titulo}, $ ${Number(p.total).toLocaleString("es-AR")}): ${datos.data.motivo}`,
  });
  res.json(aJsonPresupuesto(anulado));
});
