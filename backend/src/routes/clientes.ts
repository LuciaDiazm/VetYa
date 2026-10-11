import { Router } from "express";
import { z } from "zod";
import { requiereRol, requiereSesion } from "../lib/auth";
import { prisma } from "../lib/prisma";
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
    .refine((d) => !d || (!Number.isNaN(d.getTime()) && d <= new Date()), "La fecha de nacimiento no es válida"),
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
  res.json(cliente);
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
        include: { veterinario: { select: { nombre: true, apellido: true } } },
      },
      aplicaciones: { orderBy: { fechaAplicacion: "desc" } },
      turnos: {
        where: { fechaHoraInicio: { gte: new Date() }, estado: { in: ["PENDIENTE", "CONFIRMADO"] } },
        orderBy: { fechaHoraInicio: "asc" },
        include: { servicio: { select: { nombre: true } } },
      },
    },
  });
  if (!mascota) {
    res.status(404).json({ error: "Mascota no encontrada" });
    return;
  }
  res.json(mascota);
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
