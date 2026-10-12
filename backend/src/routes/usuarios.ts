import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { requiereRol, requiereSesion } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { borrarArchivoSubido, subirFotoEquipo, urlFotoEquipo } from "../lib/subidas";
import { normalizarTelefono } from "../lib/telefono";

// Gestión del personal de la clínica. Solo para administradores.
export const usuariosRouter = Router();

usuariosRouter.use(requiereSesion, requiereRol("ADMIN"));

const camposPublicos = {
  id: true,
  nombre: true,
  apellido: true,
  email: true,
  telefono: true,
  rol: true,
  activo: true,
  creadoEn: true,
  visibleEnWeb: true,
  matricula: true,
  especialidad: true,
  presentacion: true,
  fotoUrl: true,
} as const;

const esquemaPersonal = z.object({
  nombre: z.string().trim().min(1, "Ingresá el nombre"),
  apellido: z.string().trim().min(1, "Ingresá el apellido"),
  email: z.email("Email inválido").trim().toLowerCase(),
  telefono: z.string().trim().optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  rol: z.enum(["VETERINARIO", "ADMIN"]),
});

// Lista del personal (veterinarios y administradores).
usuariosRouter.get("/", async (req, res) => {
  const usuarios = await prisma.usuario.findMany({
    where: { clinicaId: req.usuario!.clinicaId, rol: { in: ["VETERINARIO", "ADMIN"] } },
    select: camposPublicos,
    orderBy: { apellido: "asc" },
  });
  res.json(usuarios);
});

usuariosRouter.post("/", async (req, res) => {
  const resultado = esquemaPersonal.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const datos = resultado.data;

  if (await prisma.usuario.findUnique({ where: { email: datos.email } })) {
    res.status(409).json({ error: "Ya existe una cuenta con ese email" });
    return;
  }

  const usuario = await prisma.usuario.create({
    data: {
      clinicaId: req.usuario!.clinicaId,
      nombre: datos.nombre,
      apellido: datos.apellido,
      email: datos.email,
      telefono: datos.telefono ? normalizarTelefono(datos.telefono) : null,
      passwordHash: await bcrypt.hash(datos.password, 10),
      rol: datos.rol,
    },
    select: camposPublicos,
  });
  res.status(201).json(usuario);
});

// Activa o desactiva un usuario. No se borran, para conservar el historial (regla de negocio 7).
usuariosRouter.patch("/:id/activo", async (req, res) => {
  const id = Number(req.params.id);
  const resultado = z.object({ activo: z.boolean() }).safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: "Falta indicar si el usuario queda activo" });
    return;
  }
  const { activo } = resultado.data;

  if (id === req.usuario!.id && !activo) {
    res.status(400).json({ error: "No podés desactivar tu propia cuenta" });
    return;
  }

  const usuario = await prisma.usuario.findFirst({
    where: { id, clinicaId: req.usuario!.clinicaId, rol: { in: ["VETERINARIO", "ADMIN"] } },
  });
  if (!usuario) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  const actualizado = await prisma.usuario.update({
    where: { id },
    data: { activo },
    select: camposPublicos,
  });
  res.json(actualizado);
});

function delPersonal(id: number, clinicaId: number) {
  return prisma.usuario.findFirst({ where: { id, clinicaId, rol: { in: ["VETERINARIO", "ADMIN"] } } });
}

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((t) => t || null);

const esquemaEdicion = z.object({
  nombre: z.string().trim().min(1, "Ingresá el nombre"),
  apellido: z.string().trim().min(1, "Ingresá el apellido"),
  email: z.email("Email inválido").trim().toLowerCase(),
  telefono: opcional(40),
  rol: z.enum(["VETERINARIO", "ADMIN"]),
  // Perfil para la sección "Nuestro equipo" de la web
  visibleEnWeb: z.boolean(),
  matricula: opcional(60),
  especialidad: opcional(120),
  presentacion: opcional(600),
});

usuariosRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const resultado = esquemaEdicion.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const datos = resultado.data;
  if (!(await delPersonal(id, req.usuario!.clinicaId))) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  if (id === req.usuario!.id && datos.rol !== "ADMIN") {
    res.status(400).json({ error: "No podés quitarte el permiso de administración a vos misma/o" });
    return;
  }
  const otro = await prisma.usuario.findUnique({ where: { email: datos.email } });
  if (otro && otro.id !== id) {
    res.status(409).json({ error: "Ya existe una cuenta con ese email" });
    return;
  }
  const usuario = await prisma.usuario.update({
    where: { id },
    data: { ...datos, telefono: datos.telefono ? normalizarTelefono(datos.telefono) : null },
    select: camposPublicos,
  });
  res.json(usuario);
});

// Contraseña nueva (por ejemplo, si alguien se la olvidó).
usuariosRouter.patch("/:id/password", async (req, res) => {
  const id = Number(req.params.id);
  const resultado = z
    .object({ password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres") })
    .safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  if (!(await delPersonal(id, req.usuario!.clinicaId))) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  await prisma.usuario.update({ where: { id }, data: { passwordHash: await bcrypt.hash(resultado.data.password, 10) } });
  res.json({ ok: true });
});

// Foto para la web. Reemplaza la anterior.
usuariosRouter.post("/:id/foto", subirFotoEquipo.single("foto"), async (req, res) => {
  const id = Number(req.params.id);
  const archivo = req.file;
  if (!archivo) {
    res.status(400).json({ error: "Elegí una foto (JPG, PNG o WEBP)" });
    return;
  }
  const usuario = await delPersonal(id, req.usuario!.clinicaId);
  if (!usuario) {
    borrarArchivoSubido(urlFotoEquipo(archivo.filename));
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  if (usuario.fotoUrl) borrarArchivoSubido(usuario.fotoUrl);
  const actualizado = await prisma.usuario.update({
    where: { id },
    data: { fotoUrl: urlFotoEquipo(archivo.filename) },
    select: camposPublicos,
  });
  res.json(actualizado);
});

usuariosRouter.delete("/:id/foto", async (req, res) => {
  const id = Number(req.params.id);
  const usuario = await delPersonal(id, req.usuario!.clinicaId);
  if (!usuario) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  if (usuario.fotoUrl) borrarArchivoSubido(usuario.fotoUrl);
  res.json(await prisma.usuario.update({ where: { id }, data: { fotoUrl: null }, select: camposPublicos }));
});
