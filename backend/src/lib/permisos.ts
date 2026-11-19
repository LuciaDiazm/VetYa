import type { NextFunction, Request, Response } from "express";
import type { Rol } from "@prisma/client";

// Qué puede hacer cada perfil de la clínica. Es la única lista: las rutas la usan con requierePermiso
// y el frontend tiene una copia (frontend/src/lib/permisos.ts) para mostrar solo los botones que sirven.
//
// Basado en la separación de un sistema de clínica chica (administración, veterinario y recepción):
// - ADMIN: administración de la clínica. Hace todo, también Ajustes, personal, estadísticas y anular.
// - VETERINARIO: lo clínico (consultas, vacunas, adjuntos). Ve clientes, turnos y pagos, pero no los crea.
// - RECEPCION: el mostrador (clientes, mascotas, turnos, cobros y avisos). No ve ni escribe lo clínico.
// El dueño (DUENIO) no entra al panel: tiene su propia parte (Mi cuenta).
export const PERMISOS = {
  // Clientes y mascotas
  "clientes.ver": ["ADMIN", "VETERINARIO", "RECEPCION"],
  "clientes.editar": ["ADMIN", "RECEPCION"], // crear, editar, mascotas, archivar, contraseña del dueño, unir cuenta
  "clientes.sanciones": ["ADMIN"], // suspender o levantar, límite propio de turnos web
  // Turnos
  "turnos.ver": ["ADMIN", "VETERINARIO", "RECEPCION"],
  "turnos.dar": ["ADMIN", "RECEPCION"], // dar turno, sobreturno, cambiar día u hora
  "turnos.estado": ["ADMIN", "VETERINARIO", "RECEPCION"], // llegó, atendido, no vino, cancelar
  // Historia clínica
  "clinica.ver": ["ADMIN", "VETERINARIO"], // diagnóstico, tratamiento, observaciones y adjuntos
  "clinica.escribir": ["ADMIN", "VETERINARIO"], // consultas, vacunas, adjuntos
  "vacunas.anular": ["ADMIN"],
  // Pagos
  "pagos.ver": ["ADMIN", "VETERINARIO", "RECEPCION"],
  "pagos.cobrar": ["ADMIN", "RECEPCION"],
  // Avisos por WhatsApp
  "recordatorios": ["ADMIN", "VETERINARIO", "RECEPCION"],
  // Administración
  "estadisticas": ["ADMIN"],
  "ajustes": ["ADMIN"],
  "personal": ["ADMIN"],
  "auditoria": ["ADMIN"],
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof PERMISOS;

export const PERSONAL: Rol[] = ["ADMIN", "VETERINARIO", "RECEPCION"];

export function puede(rol: Rol | undefined, permiso: Permiso): boolean {
  return !!rol && (PERMISOS[permiso] as readonly Rol[]).includes(rol);
}

// Middleware: exige la sesión (requiereSesion antes) y el permiso.
export function requierePermiso(permiso: Permiso) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!puede(req.usuario?.rol, permiso)) {
      res.status(403).json({ error: "No tenés permiso para realizar esta acción" });
      return;
    }
    next();
  };
}
