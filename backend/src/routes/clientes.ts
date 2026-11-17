import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { aFechaUTC, diaArgentina } from "../lib/agenda";
import { requiereRol, requiereSesion } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { tokenDeCarnet } from "../lib/carnet";
import { suspensionVigente } from "../lib/sanciones";
import { normalizarTelefono } from "../lib/telefono";

// Clientes (dueños) y sus mascotas, para el personal de la clínica.
export const clientesRouter = Router();
export const mascotasRouter = Router();

clientesRouter.use(requiereSesion, requiereRol("VETERINARIO", "ADMIN"));
mascotasRouter.use(requiereSesion, requiereRol("VETERINARIO", "ADMIN"));

// ---------- Validaciones ----------

const textoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const esquemaCliente = z.object({
  nombre: z.string().trim().min(1, "Escribí el nombre del dueño"),
  apellido: z.string().trim().min(1, "Escribí el apellido del dueño"),
  telefono: z.string().trim().min(8, "Escribí un teléfono válido"),
  dni: textoOpcional,
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .pipe(z.email("Email inválido").nullable()),
  direccion: textoOpcional,
});

const esquemaMascota = z.object({
  nombre: z.string().trim().min(1, "Escribí el nombre de la mascota"),
  especie: z.enum(["PERRO", "GATO", "OTRO"]),
  sexo: z.enum(["MACHO", "HEMBRA"]),
  raza: textoOpcional,
  color: textoOpcional,
  // "AAAA-MM-DD" o vacío. Puede ser aproximada.
  fechaNacimiento: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null))
    .refine(
      (d) => !d || (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) <= diaArgentina(new Date())),
      "La fecha de nacimiento no es válida",
    ),
  castrado: z.boolean().default(false),
  observaciones: textoOpcional,
});

// Alta rápida en el mostrador: dueño y su primera mascota en un solo paso.
const esquemaAltaRapida = esquemaCliente.extend({ mascota: esquemaMascota.optional() });

function primerError(error: z.ZodError) {
  return error.issues[0].message;
}

// ---------- Clientes ----------

// Búsqueda por nombre, apellido, DNI, teléfono o nombre de la mascota.
clientesRouter.get("/", async (req, res) => {
  const texto = String(req.query.q ?? "").trim();
  const digitos = texto.replace(/\D/g, "");

  const filtros = texto
    ? [
        { nombre: { contains: texto } },
        { apellido: { contains: texto } },
        { dni: { contains: texto } },
        { mascotas: { some: { nombre: { contains: texto } } } },
        ...(digitos.length >= 4 ? [{ telefono: { contains: digitos.replace(/^0/, "") } }] : []),
        // "Juan Pérez" escrito completo
        ...(texto.includes(" ")
          ? [{ AND: [{ nombre: { contains: texto.split(" ")[0] } }, { apellido: { contains: texto.split(" ").slice(1).join(" ") } }] }]
          : []),
      ]
    : undefined;

  const clientes = await prisma.cliente.findMany({
    where: { clinicaId: req.usuario!.clinicaId, ...(filtros ? { OR: filtros } : {}) },
    include: { mascotas: { where: { activo: true }, orderBy: { nombre: "asc" } } },
    orderBy: texto ? [{ apellido: "asc" }, { nombre: "asc" }] : { creadoEn: "desc" },
    take: 30,
  });
  res.json(clientes);
});

clientesRouter.post("/", async (req, res) => {
  const resultado = esquemaAltaRapida.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: primerError(resultado.error) });
    return;
  }
  const { mascota, ...datos } = resultado.data;
  const telefono = normalizarTelefono(datos.telefono);
  const clinicaId = req.usuario!.clinicaId;

  // Evita duplicados: si ya existe alguien con ese teléfono, se avisa y se ofrece ir a su ficha.
  const existente = await prisma.cliente.findFirst({ where: { clinicaId, telefono } });
  if (existente) {
    res.status(409).json({
      error: `Ya existe un cliente con ese teléfono: ${existente.nombre} ${existente.apellido}`,
      clienteId: existente.id,
    });
    return;
  }

  const cliente = await prisma.cliente.create({
    data: {
      ...datos,
      telefono,
      clinicaId,
      ...(mascota ? { mascotas: { create: mascota } } : {}),
    },
    include: { mascotas: true },
  });
  res.status(201).json(cliente);
});

// Clientes que el sistema suspendió solo (canceló muchos turnos web seguidos) y el administrador todavía no revisó.
clientesRouter.get("/suspensiones", requiereRol("ADMIN"), async (req, res) => {
  const clientes = await prisma.cliente.findMany({
    where: { clinicaId: req.usuario!.clinicaId, suspensionRevisada: false, suspendidoHasta: { gt: new Date() } },
    select: { id: true, nombre: true, apellido: true, telefono: true, suspendidoHasta: true, suspensionMotivo: true },
    orderBy: { suspendidoHasta: "asc" },
  });
  res.json(clientes);
});

// Cómo viene el cliente con los turnos de los últimos 6 meses (para que la clínica decida).
async function resumenTurnos(clienteId: number) {
  const desde = new Date(Date.now() - 183 * 24 * 3600 * 1000);
  const filas = await prisma.turno.groupBy({
    by: ["estado", "canceladoPor"],
    where: { mascota: { clienteId }, fechaHoraInicio: { gte: desde } },
    _count: true,
  });
  const contar = (filtro: (f: (typeof filas)[number]) => boolean) =>
    filas.filter(filtro).reduce((total, f) => total + f._count, 0);
  return {
    atendidos: contar((f) => f.estado === "ATENDIDO"),
    ausentes: contar((f) => f.estado === "AUSENTE"),
    canceladosPorElDueno: contar((f) => f.estado === "CANCELADO" && f.canceladoPor === "DUENIO"),
  };
}

clientesRouter.get("/:id", async (req, res) => {
  const cliente = await prisma.cliente.findFirst({
    where: { id: Number(req.params.id), clinicaId: req.usuario!.clinicaId },
    include: {
      mascotas: { orderBy: [{ activo: "desc" }, { nombre: "asc" }] },
      usuario: { select: { id: true, email: true } },
    },
  });
  if (!cliente) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }
  const { maxTurnosOnline: maxTurnosOnlineClinica } = await prisma.clinica.findUniqueOrThrow({
    where: { id: cliente.clinicaId },
    select: { maxTurnosOnline: true },
  });
  res.json({
    ...cliente,
    suspendidoHasta: suspensionVigente(cliente),
    resumenTurnos: await resumenTurnos(cliente.id),
    maxTurnosOnlineClinica,
  });
});

// Solo el administrador: cuántos turnos web puede tener a la vez este cliente (null = el de la clínica).
clientesRouter.patch("/:id/limite-turnos", requiereRol("ADMIN"), async (req, res) => {
  const resultado = z
    .object({
      maxTurnosOnline: z
        .number()
        .int()
        .min(0, "El número no puede ser negativo")
        .max(30, "Como máximo, 30 turnos")
        .nullable(),
    })
    .safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: primerError(resultado.error) });
    return;
  }
  const id = Number(req.params.id);
  if (!(await prisma.cliente.findFirst({ where: { id, clinicaId: req.usuario!.clinicaId } }))) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }
  const cliente = await prisma.cliente.update({ where: { id }, data: resultado.data });
  res.json({ maxTurnosOnline: cliente.maxTurnosOnline });
});

// Solo el administrador decide: mantener la suspensión automática, levantarla o suspender a mano.
clientesRouter.patch("/:id/suspension", requiereRol("ADMIN"), async (req, res) => {
  const resultado = z.object({ accion: z.enum(["mantener", "levantar", "suspender"]) }).safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: "Acción inválida" });
    return;
  }
  const id = Number(req.params.id);
  const clinicaId = req.usuario!.clinicaId;
  const cliente = await prisma.cliente.findFirst({ where: { id, clinicaId } });
  if (!cliente) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }
  const { accion } = resultado.data;
  let datos;
  if (accion === "mantener") {
    datos = { suspensionRevisada: true };
  } else if (accion === "levantar") {
    datos = { suspendidoHasta: null, suspensionMotivo: null, suspensionRevisada: true };
  } else {
    const { diasSuspension } = await prisma.clinica.findUniqueOrThrow({
      where: { id: clinicaId },
      select: { diasSuspension: true },
    });
    datos = {
      suspendidoHasta: new Date(Date.now() + diasSuspension * 24 * 3600 * 1000),
      suspensionMotivo: "Suspendido por la clínica",
      suspensionRevisada: true,
    };
  }
  const actualizado = await prisma.cliente.update({ where: { id }, data: datos });
  res.json({ suspendidoHasta: suspensionVigente(actualizado), suspensionMotivo: actualizado.suspensionMotivo });
});

clientesRouter.put("/:id", async (req, res) => {
  const resultado = esquemaCliente.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: primerError(resultado.error) });
    return;
  }
  const id = Number(req.params.id);
  const clinicaId = req.usuario!.clinicaId;
  if (!(await prisma.cliente.findFirst({ where: { id, clinicaId } }))) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }
  const telefono = normalizarTelefono(resultado.data.telefono);
  const otro = await prisma.cliente.findFirst({ where: { clinicaId, telefono, NOT: { id } } });
  if (otro) {
    res.status(409).json({ error: `Ese teléfono ya es de ${otro.nombre} ${otro.apellido}`, clienteId: otro.id });
    return;
  }
  const cliente = await prisma.cliente.update({ where: { id }, data: { ...resultado.data, telefono } });
  res.json(cliente);
});

// Contraseña nueva para la cuenta web del dueño, si se la olvidó (lo pide llamando o por WhatsApp).
clientesRouter.patch("/:id/password", async (req, res) => {
  const resultado = z
    .object({ password: z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres") })
    .safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: primerError(resultado.error) });
    return;
  }
  const cliente = await prisma.cliente.findFirst({
    where: { id: Number(req.params.id), clinicaId: req.usuario!.clinicaId },
    select: { usuarioId: true },
  });
  if (!cliente?.usuarioId) {
    res.status(404).json({ error: "Este cliente no tiene cuenta en la web" });
    return;
  }
  await prisma.usuario.update({
    where: { id: cliente.usuarioId },
    data: { passwordHash: await bcrypt.hash(resultado.data.password, 10) },
  });
  res.json({ ok: true });
});

clientesRouter.post("/:id/mascotas", async (req, res) => {
  const resultado = esquemaMascota.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: primerError(resultado.error) });
    return;
  }
  const clienteId = Number(req.params.id);
  if (!(await prisma.cliente.findFirst({ where: { id: clienteId, clinicaId: req.usuario!.clinicaId } }))) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }
  const mascota = await prisma.mascota.create({ data: { ...resultado.data, clienteId } });
  res.status(201).json(mascota);
});

// ---------- Mascotas ----------

async function mascotaDeLaClinica(id: number, clinicaId: number) {
  return prisma.mascota.findFirst({ where: { id, cliente: { clinicaId } } });
}

// Ficha completa: datos, dueño, consultas, vacunas y desparasitaciones, y próximos turnos.
mascotasRouter.get("/:id", async (req, res) => {
  const mascota = await prisma.mascota.findFirst({
    where: { id: Number(req.params.id), cliente: { clinicaId: req.usuario!.clinicaId } },
    include: {
      cliente: true,
      consultas: {
        orderBy: { fecha: "desc" },
        include: {
          veterinario: { select: { nombre: true, apellido: true } },
          aplicaciones: { select: { id: true, tipo: true, producto: true } },
          turno: { select: { servicio: { select: { nombre: true } } } },
        },
      },
      aplicaciones: { orderBy: { fechaAplicacion: "desc" } },
      turnos: {
        // Desde el comienzo de hoy: un turno de las 10:00 se puede atender (y vincular a la consulta) a las 10:05.
        where: { fechaHoraInicio: { gte: aFechaUTC(diaArgentina(new Date()), "00:00") }, estado: { in: ["PENDIENTE", "CONFIRMADO"] } },
        orderBy: { fechaHoraInicio: "asc" },
        include: { servicio: { select: { nombre: true } } },
      },
    },
  });
  if (!mascota) {
    res.status(404).json({ error: "Mascota no encontrada" });
    return;
  }
  const { tokenCarnet: _token, ...ficha } = mascota;
  res.json(ficha);
});

mascotasRouter.put("/:id", async (req, res) => {
  const resultado = esquemaMascota.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: primerError(resultado.error) });
    return;
  }
  const id = Number(req.params.id);
  if (!(await mascotaDeLaClinica(id, req.usuario!.clinicaId))) {
    res.status(404).json({ error: "Mascota no encontrada" });
    return;
  }
  const mascota = await prisma.mascota.update({ where: { id }, data: resultado.data });
  res.json(mascota);
});

// Enlace privado del carnet de vacunación (para descargarlo o mandarlo por WhatsApp).
mascotasRouter.get("/:id/carnet", async (req, res) => {
  const id = Number(req.params.id);
  if (!(await mascotaDeLaClinica(id, req.usuario!.clinicaId))) {
    res.status(404).json({ error: "Mascota no encontrada" });
    return;
  }
  res.json({ url: `/api/publico/carnet/${await tokenDeCarnet(id)}` });
});

// No se borran: se desactivan (falleció o dejó de venir) para conservar la historia clínica.
mascotasRouter.patch("/:id/activo", async (req, res) => {
  const resultado = z.object({ activo: z.boolean() }).safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: "Falta indicar si la mascota queda activa" });
    return;
  }
  const id = Number(req.params.id);
  if (!(await mascotaDeLaClinica(id, req.usuario!.clinicaId))) {
    res.status(404).json({ error: "Mascota no encontrada" });
    return;
  }
  const mascota = await prisma.mascota.update({ where: { id }, data: { activo: resultado.data.activo } });
  res.json(mascota);
});
