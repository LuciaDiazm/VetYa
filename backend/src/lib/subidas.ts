import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ErrorRequestHandler } from "express";
import multer from "multer";

// Carpeta donde se guardan las fotos que sube la clínica.
// Se sirve como /uploads/... (ver app.ts) y no se versiona en Git.
export const CARPETA_SUBIDAS = path.resolve(__dirname, "../../uploads");
const CARPETA_EQUIPO = path.join(CARPETA_SUBIDAS, "equipo");
fs.mkdirSync(CARPETA_EQUIPO, { recursive: true });

const EXTENSIONES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// Foto de perfil del personal (sección "Nuestro equipo" de la web): hasta 8 MB (las del celular suelen pesar 3 a 5 MB).
export const subirFotoEquipo = multer({
  storage: multer.diskStorage({
    destination: CARPETA_EQUIPO,
    filename: (_req, archivo, cb) => cb(null, `${crypto.randomUUID()}${EXTENSIONES[archivo.mimetype]}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, archivo, cb) => cb(null, archivo.mimetype in EXTENSIONES),
});

export function urlFotoEquipo(nombreArchivo: string) {
  return `/uploads/equipo/${nombreArchivo}`;
}

// Borra del disco una foto subida (las fotos de ejemplo de /fotos no se tocan).
export function borrarArchivoSubido(url: string) {
  if (!url.startsWith("/uploads/equipo/")) return;
  fs.rm(path.join(CARPETA_EQUIPO, path.basename(url)), { force: true }, () => {});
}

// Errores de subida (foto muy pesada, más de una foto) con un mensaje entendible.
export const erroresDeSubida: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    const mensaje =
      err.code === "LIMIT_FILE_SIZE"
        ? "La foto puede pesar hasta 8 MB"
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Elegí una sola foto"
          : "No se pudo subir la foto";
    res.status(400).json({ error: mensaje });
    return;
  }
  next(err);
};
