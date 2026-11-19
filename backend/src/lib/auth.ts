import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Rol } from "@prisma/client";
import { prisma } from "./prisma";

// Datos que viajan dentro del token de sesión.
export interface UsuarioToken {
  id: number;
  clinicaId: number;
  rol: Rol;
}

// Permite usar req.usuario en las rutas protegidas.
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioToken;
    }
  }
}

// La sesión viaja en una cookie que el navegador guarda y manda solo:
// - HttpOnly: ningún script de la página la puede leer (si alguna vez se cuela código malicioso, no se la lleva).
// - SameSite=Strict: otras páginas no pueden hacer pedidos con la sesión de la persona.
// - Secure (en internet): solo viaja por HTTPS.
export const COOKIE_SESION = "vetya_sesion";

const DIA_MS = 24 * 60 * 60 * 1000;

function secreto(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("Falta JWT_SECRET en el archivo .env");
  return s;
}

// La sesión se renueva cada vez que entran, así que mientras usen el sistema no vuelve a pedir la contraseña.
// Dueños: 6 meses (pueden pasar meses entre visitas). Personal: 30 días (se cierra sola si una compu deja de usarse).
function diasDeSesion(rol: Rol) {
  return rol === "DUENIO" ? 180 : 30;
}

export function firmarToken(usuario: UsuarioToken): string {
  const { id, clinicaId, rol } = usuario;
  return jwt.sign({ id, clinicaId, rol }, secreto(), { expiresIn: `${diasDeSesion(rol)}d` });
}

// Abre (o renueva) la sesión en este navegador.
export function iniciarSesion(req: Request, res: Response, usuario: UsuarioToken) {
  res.cookie(COOKIE_SESION, firmarToken(usuario), {
    httpOnly: true,
    sameSite: "strict",
    secure: req.secure || process.env.NODE_ENV === "production",
    path: "/",
    maxAge: diasDeSesion(usuario.rol) * DIA_MS,
  });
}

export function cerrarSesion(req: Request, res: Response) {
  res.clearCookie(COOKIE_SESION, {
    httpOnly: true,
    sameSite: "strict",
    secure: req.secure || process.env.NODE_ENV === "production",
    path: "/",
  });
}

// Lee la cookie sin librerías extra.
function leerCookie(req: Request, nombre: string): string | null {
  const todas = req.headers.cookie;
  if (!todas) return null;
  for (const parte of todas.split(";")) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i).trim() === nombre) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return null;
}

type Lectura = { usuario: UsuarioToken } | { error: string } | null;

// Busca la sesión en la cookie (o en "Authorization: Bearer", que usan las pruebas automáticas)
// y la valida contra la base: si la cuenta se desactivó o cambió la contraseña, deja de valer enseguida.
export async function leerSesion(req: Request): Promise<Lectura> {
  const encabezado = req.headers.authorization;
  const token = leerCookie(req, COOKIE_SESION) ?? (encabezado?.startsWith("Bearer ") ? encabezado.slice(7) : null);
  if (!token) return null;
  let datos: UsuarioToken & { iat?: number };
  try {
    datos = jwt.verify(token, secreto()) as UsuarioToken & { iat?: number };
  } catch {
    return { error: "La sesión expiró. Volvé a iniciar sesión" };
  }
  const usuario = await prisma.usuario.findUnique({
    where: { id: datos.id },
    select: { activo: true, rol: true, clinicaId: true, sesionesDesde: true },
  });
  if (!usuario || !usuario.activo) return { error: "Tu cuenta no está activa. Consultá con la clínica" };
  if (usuario.sesionesDesde && (datos.iat ?? 0) < Math.floor(usuario.sesionesDesde.getTime() / 1000)) {
    return { error: "Se cambió la contraseña. Volvé a iniciar sesión" };
  }
  // El rol sale de la base, no del token: si la administración lo cambia, vale desde el próximo pedido.
  return { usuario: { id: datos.id, clinicaId: usuario.clinicaId, rol: usuario.rol } };
}

// Middleware: exige una sesión válida.
export async function requiereSesion(req: Request, res: Response, next: NextFunction) {
  const lectura = await leerSesion(req);
  if (!lectura || "error" in lectura) {
    if (lectura) cerrarSesion(req, res);
    res.status(401).json({ error: lectura?.error ?? "Tenés que iniciar sesión" });
    return;
  }
  req.usuario = lectura.usuario;
  next();
}

// Middleware: si hay sesión la carga; si no, sigue igual (para lo que puede ser público, como una foto).
export async function sesionOpcional(req: Request, _res: Response, next: NextFunction) {
  const lectura = await leerSesion(req);
  if (lectura && "usuario" in lectura) req.usuario = lectura.usuario;
  next();
}

// Middleware: además de la sesión, exige que el usuario tenga alguno de los roles indicados.
// Uso: router.get("/ruta", requiereSesion, requiereRol("ADMIN"), handler)
export function requiereRol(...roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      res.status(403).json({ error: "No tenés permiso para realizar esta acción" });
      return;
    }
    next();
  };
}

// Contra pedidos desde otras páginas (CSRF): todo lo que cambia datos tiene que venir de la propia web.
// La cookie SameSite=Strict ya lo impide en los navegadores actuales; esto es una segunda barrera.
export function mismoOrigen(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origen = req.headers.origin;
  if (!origen) return next(); // pedidos sin navegador (pruebas, herramientas)
  const permitidos = [process.env.FRONTEND_URL ?? "http://localhost:5173", `${req.protocol}://${req.get("host")}`];
  if (!permitidos.includes(origen)) {
    res.status(403).json({ error: "Pedido no permitido" });
    return;
  }
  next();
}
