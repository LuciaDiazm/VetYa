import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { nombre } from "../lib/textos";
import { requiereSesion } from "../lib/auth";
import { registrarCambio } from "../lib/auditoria";
import { PERSONAL, requierePermiso } from "../lib/permisos";
import { prisma } from "../lib/prisma";
import { guardarArchivo, idDeUrl, subirFoto, urlArchivo } from "../lib/subidas";
import { normalizarTelefono } from "../lib/telefono";

// Gestión del personal de la clínica. Solo para administradores.
export const usuariosRouter = Router();

usuariosRouter.use(requiereSesion, requierePermiso("personal"));

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

const NOMBRE_ROL = { ADMIN: "Administración", VETERINARIO: "Veterinaria/o", RECEPCION: "Recepción", DUENIO: "Dueño" } as const;
const nombreDe = (u: { nombre: string; apellido: string }) => `${u.nombre} ${u.apellido}`;

const esquemaPersonal = z.object({
  nombre: nombre("Ingresá el nombre"),
  apellido: nombre("Ingresá el apellido"),
  email: z.email("Email inválido").trim().toLowerCase(),
  telefono: z.string().trim().optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  rol: z.enum(["ADMIN", "VETERINARIO", "RECEPCION"]),
});

// Lista del personal (administración, veterinarios y recepción).
usuariosRouter.get("/", async (req, res) => {
  const usuarios = await prisma.usuario.findMany({
    where: { clinicaId: req.usuario!.clinicaId, rol: { in: PERSONAL } },
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
  await registrarCambio(req, {
    accion: "personal.crear",
    entidad: "usuario",
    entidadId: usuario.id,
    resumen: `Creó la cuenta de ${nombreDe(usuario)} (${NOMBRE_ROL[usuario.rol]})`,
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
    where: { id, clinicaId: req.usuario!.clinicaId, rol: { in: PERSONAL } },
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
  await registrarCambio(req, {
    accion: activo ? "personal.activar" : "personal.desactivar",
    entidad: "usuario",
    entidadId: id,
    resumen: `${activo ? "Activó" : "Desactivó"} la cuenta de ${nombreDe(actualizado)}`,
  });
  res.json(actualizado);
});

function delPersonal(id: number, clinicaId: number) {
  return prisma.usuario.findFirst({ where: { id, clinicaId, rol: { in: PERSONAL } } });
}

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((t) => t || null);

const esquemaEdicion = z.object({
  nombre: nombre("Ingresá el nombre"),
  apellido: nombre("Ingresá el apellido"),
  email: z.email("Email inválido").trim().toLowerCase(),
  telefono: opcional(40),
  rol: z.enum(["ADMIN", "VETERINARIO", "RECEPCION"]),
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
  const anterior = await delPersonal(id, req.usuario!.clinicaId);
  if (!anterior) {
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
  if (anterior.rol !== usuario.rol) {
    await registrarCambio(req, {
      accion: "personal.rol",
      entidad: "usuario",
      entidadId: id,
      resumen: `Cambió el perfil de ${nombreDe(usuario)}: de ${NOMBRE_ROL[anterior.rol]} a ${NOMBRE_ROL[usuario.rol]}`,
      antes: { rol: anterior.rol },
      despues: { rol: usuario.rol },
    });
  }
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
  const persona = await delPersonal(id, req.usuario!.clinicaId);
  if (!persona) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  // Las sesiones abiertas con la contraseña vieja se cierran.
  await prisma.usuario.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(resultado.data.password, 10), sesionesDesde: new Date() },
  });
  await registrarCambio(req, {
    accion: "personal.contrasena",
    entidad: "usuario",
    entidadId: id,
    resumen: `Le dio una contraseña nueva a ${nombreDe(persona)}`,
  });
  res.json({ ok: true });
});

// Foto para la web. Se guarda en la base (no se pierde si el servidor se reinicia) y reemplaza la anterior.
usuariosRouter.post("/:id/foto", subirFoto.single("foto"), async (req, res) => {
  const id = Number(req.params.id);
  if (!req.file) {
    res.status(400).json({ error: "Elegí una foto (JPG, PNG o WEBP)" });
    return;
  }
  const usuario = await delPersonal(id, req.usuario!.clinicaId);
  if (!usuario) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  const archivo = await guardarArchivo(req, req.file, { publico: true, soloImagen: true });
  if (!archivo) {
    res.status(400).json({ error: "El archivo no es una foto válida" });
    return;
  }
  const actualizado = await prisma.usuario.update({
    where: { id },
    data: { fotoUrl: urlArchivo(archivo.id) },
    select: camposPublicos,
  });
  await borrarFotoAnterior(usuario.fotoUrl);
  res.json(actualizado);
});

usuariosRouter.delete("/:id/foto", async (req, res) => {
  const id = Number(req.params.id);
  const usuario = await delPersonal(id, req.usuario!.clinicaId);
  if (!usuario) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  const actualizado = await prisma.usuario.update({ where: { id }, data: { fotoUrl: null }, select: camposPublicos });
  await borrarFotoAnterior(usuario.fotoUrl);
  res.json(actualizado);
});

// Las fotos de ejemplo (/fotos/...) son parte de la web y no se tocan.
async function borrarFotoAnterior(url: string | null) {
  const anterior = idDeUrl(url);
  if (anterior) await prisma.archivo.delete({ where: { id: anterior } }).catch(() => {});
}
