import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Rol } from "@prisma/client";

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

function secreto(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("Falta JWT_SECRET en el archivo .env");
  return s;
}

// La sesión se renueva cada vez que entran, así que mientras usen el sistema no vuelve a pedir la contraseña.
// Dueños: 6 meses (pueden pasar meses entre visitas). Personal: 30 días (se cierra sola si una compu deja de usarse).
export function firmarToken(usuario: UsuarioToken): string {
  const { id, clinicaId, rol } = usuario;
  return jwt.sign({ id, clinicaId, rol }, secreto(), { expiresIn: rol === "DUENIO" ? "180d" : "30d" });
}

// Middleware: exige un token válido en el encabezado "Authorization: Bearer <token>".
export function requiereSesion(req: Request, res: Response, next: NextFunction) {
  const encabezado = req.headers.authorization;
  if (!encabezado?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Tenés que iniciar sesión" });
    return;
  }
  try {
    const datos = jwt.verify(encabezado.slice(7), secreto()) as UsuarioToken;
    req.usuario = { id: datos.id, clinicaId: datos.clinicaId, rol: datos.rol };
    next();
  } catch {
    res.status(401).json({ error: "La sesión expiró. Volvé a iniciar sesión" });
  }
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
