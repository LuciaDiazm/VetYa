import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { firmarToken, requiereSesion } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { normalizarTelefono } from "../lib/telefono";

export const authRouter = Router();

// Por ahora el sistema atiende a una sola clínica.
const CLINICA_ID = 1;

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(1, "Ingresá tu nombre"),
  apellido: z.string().trim().min(1, "Ingresá tu apellido"),
  email: z.email("Email inválido").trim().toLowerCase(),
  telefono: z.string().trim().min(8, "Teléfono inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

const esquemaLogin = z.object({
  email: z.email("Email inválido").trim().toLowerCase(),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

// Datos del usuario que se pueden mostrar en el frontend (nunca el hash de la contraseña).
const camposPublicos = {
  id: true,
  nombre: true,
  apellido: true,
  email: true,
  telefono: true,
  rol: true,
} as const;

// Registro de dueños de mascotas. El personal de la clínica lo crea el administrador.
authRouter.post("/registro", async (req, res) => {
  const resultado = esquemaRegistro.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const datos = resultado.data;
  const telefono = normalizarTelefono(datos.telefono);

  const existente = await prisma.usuario.findUnique({ where: { email: datos.email } });
  if (existente) {
    res.status(409).json({ error: "Ya existe una cuenta con ese email" });
    return;
  }

  const usuario = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.usuario.create({
      data: {
        clinicaId: CLINICA_ID,
        nombre: datos.nombre,
        apellido: datos.apellido,
        email: datos.email,
        telefono,
        passwordHash: await bcrypt.hash(datos.password, 10),
        rol: "DUENIO",
      },
      select: camposPublicos,
    });

    // Regla de negocio 6: si la clínica ya lo tenía cargado como cliente
    // (mismo teléfono o email, sin cuenta), se vinculan y aparecen sus mascotas.
    const clienteExistente = await tx.cliente.findFirst({
      where: {
        clinicaId: CLINICA_ID,
        usuarioId: null,
        OR: [{ telefono }, { email: datos.email }],
      },
    });

    if (clienteExistente) {
      await tx.cliente.update({
        where: { id: clienteExistente.id },
        data: { usuarioId: nuevo.id, email: clienteExistente.email ?? datos.email },
      });
    } else {
      await tx.cliente.create({
        data: {
          clinicaId: CLINICA_ID,
          usuarioId: nuevo.id,
          nombre: datos.nombre,
          apellido: datos.apellido,
          telefono,
          email: datos.email,
        },
      });
    }

    return nuevo;
  });

  const token = firmarToken({ id: usuario.id, clinicaId: CLINICA_ID, rol: usuario.rol });
  res.status(201).json({ token, usuario });
});

authRouter.post("/login", async (req, res) => {
  const resultado = esquemaLogin.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const { email, password } = resultado.data;

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  // Mismo mensaje si no existe o si la contraseña es incorrecta, para no revelar qué emails están registrados.
  if (!usuario || !usuario.activo || !(await bcrypt.compare(password, usuario.passwordHash))) {
    res.status(401).json({ error: "Email o contraseña incorrectos" });
    return;
  }

  const token = firmarToken({ id: usuario.id, clinicaId: usuario.clinicaId, rol: usuario.rol });
  const { passwordHash: _, ...usuarioPublico } = usuario;
  res.json({ token, usuario: usuarioPublico });
});

// Devuelve los datos del usuario que tiene la sesión iniciada.
authRouter.get("/yo", requiereSesion, async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario!.id },
    select: camposPublicos,
  });
  if (!usuario) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  res.json(usuario);
});
