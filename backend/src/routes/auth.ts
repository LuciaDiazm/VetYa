import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { cerrarSesion, iniciarSesion, requiereSesion } from "../lib/auth";
import { borrarIntentos, MINUTO, minutosBloqueado, sumarIntento } from "../lib/limites";
import { prisma } from "../lib/prisma";
import { normalizarTelefono } from "../lib/telefono";

export const authRouter = Router();

// Por ahora el sistema atiende a una sola clínica.
const CLINICA_ID = 1;

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(1, "Ingresá tu nombre"),
  apellido: z.string().trim().min(1, "Ingresá tu apellido"),
  email: z.string().trim().toLowerCase().pipe(z.email("Email inválido")),
  telefono: z.string().trim().min(8, "Teléfono inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

const esquemaCambioClave = z.object({
  actual: z.string().min(1, "Escribí tu contraseña actual"),
  nueva: z.string().min(8, "La contraseña nueva tiene que tener al menos 8 caracteres").max(100),
});

// Límites de intentos: 5 contraseñas mal en 15 minutos (por email y conexión, para que nadie
// pueda bloquearle la cuenta a otro), 20 en total por conexión y 5 cuentas nuevas por hora.
const MAX_FALLOS = 5;
const MAX_FALLOS_CONEXION = 20;
const MAX_REGISTROS = 5;
const VENTANA_FALLOS = 15 * MINUTO;
const VENTANA_REGISTROS = 60 * MINUTO;

function avisoBloqueo(minutos: number) {
  return `Probaste muchas veces. Esperá ${minutos} ${minutos === 1 ? "minuto" : "minutos"} o pedile a la clínica que te dé una contraseña nueva.`;
}

const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Email inválido")),
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

  const claveRegistro = `registro:${req.ip}`;
  const espera = minutosBloqueado(claveRegistro, MAX_REGISTROS);
  if (espera) {
    res.status(429).json({ error: `Se crearon muchas cuentas desde esta conexión. Probá de nuevo en ${espera} minutos.` });
    return;
  }
  sumarIntento(claveRegistro, VENTANA_REGISTROS);

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

    // Regla de negocio 6: si la clínica ya lo tenía cargado como cliente (sin cuenta), se vinculan
    // y aparecen sus mascotas. Tienen que coincidir el teléfono Y el email: con uno solo, alguien
    // que supiera el teléfono de otra persona podría ver sus mascotas. Si no coinciden los dos,
    // se crea una ficha nueva y la clínica la une desde la ficha del cliente ("Unir cuenta").
    const clienteExistente = await tx.cliente.findFirst({
      where: { clinicaId: CLINICA_ID, usuarioId: null, telefono, email: datos.email },
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

  iniciarSesion(req, res, { id: usuario.id, clinicaId: CLINICA_ID, rol: usuario.rol });
  res.status(201).json({ usuario });
});

authRouter.post("/login", async (req, res) => {
  const resultado = esquemaLogin.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const { email, password } = resultado.data;

  const claveFallos = `login:${req.ip}:${email}`;
  const claveConexion = `login:${req.ip}`;
  const espera = Math.max(
    minutosBloqueado(claveFallos, MAX_FALLOS),
    minutosBloqueado(claveConexion, MAX_FALLOS_CONEXION),
  );
  if (espera) {
    res.status(429).json({ error: avisoBloqueo(espera) });
    return;
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  // Mismo mensaje si no existe o si la contraseña es incorrecta, para no revelar qué emails están registrados.
  if (!usuario || !usuario.activo || !(await bcrypt.compare(password, usuario.passwordHash))) {
    sumarIntento(claveFallos, VENTANA_FALLOS);
    sumarIntento(claveConexion, VENTANA_FALLOS);
    res.status(401).json({ error: "Email o contraseña incorrectos" });
    return;
  }
  borrarIntentos(claveFallos);

  iniciarSesion(req, res, { id: usuario.id, clinicaId: usuario.clinicaId, rol: usuario.rol });
  const { passwordHash: _, sesionesDesde: __, ...usuarioPublico } = usuario;
  res.json({ usuario: usuarioPublico });
});

// Cerrar sesión: borra la cookie de este navegador.
authRouter.post("/salir", (req, res) => {
  cerrarSesion(req, res);
  res.json({ ok: true });
});

// Devuelve los datos del usuario que tiene la sesión iniciada.
// También renueva la sesión: mientras entren de vez en cuando, nunca tienen que volver a poner la contraseña.
authRouter.get("/yo", requiereSesion, async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario!.id },
    select: { ...camposPublicos, activo: true, clinicaId: true },
  });
  if (!usuario || !usuario.activo) {
    res.status(401).json({ error: "Tenés que iniciar sesión" });
    return;
  }
  const { activo: _, clinicaId, ...publico } = usuario;
  iniciarSesion(req, res, { id: usuario.id, clinicaId, rol: usuario.rol });
  res.json(publico);
});

// Cambiar mi contraseña (dueños y personal). Pide la actual, para que nadie la cambie
// si encuentra la sesión abierta en una compu ajena. Cierra las otras sesiones abiertas.
authRouter.post("/cambiar-password", requiereSesion, async (req, res) => {
  const resultado = esquemaCambioClave.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const { actual, nueva } = resultado.data;
  const clave = `cambio-clave:${req.usuario!.id}`;
  const espera = minutosBloqueado(clave, MAX_FALLOS);
  if (espera) {
    res.status(429).json({ error: avisoBloqueo(espera) });
    return;
  }
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: req.usuario!.id } });
  if (!(await bcrypt.compare(actual, usuario.passwordHash))) {
    sumarIntento(clave, VENTANA_FALLOS);
    res.status(400).json({ error: "La contraseña actual no es correcta" });
    return;
  }
  if (actual === nueva) {
    res.status(400).json({ error: "La contraseña nueva tiene que ser distinta de la actual" });
    return;
  }
  borrarIntentos(clave);
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { passwordHash: await bcrypt.hash(nueva, 10), sesionesDesde: new Date() },
  });
  // Sesión nueva para esta compu; las demás se cierran solas.
  iniciarSesion(req, res, { id: usuario.id, clinicaId: usuario.clinicaId, rol: usuario.rol });
  res.json({ ok: true });
});
