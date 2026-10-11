import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";

// Carpeta donde se guardan las fotos que sube la clínica.
// Se sirve como /uploads/... (ver app.ts) y no se versiona en Git.
export const CARPETA_SUBIDAS = path.resolve(__dirname, "../../uploads");
const CARPETA_ADOPCIONES = path.join(CARPETA_SUBIDAS, "adopciones");
fs.mkdirSync(CARPETA_ADOPCIONES, { recursive: true });

const EXTENSIONES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const MAX_FOTOS_POR_ANIMAL = 4;

// Fotos de animales en adopción: solo imágenes, hasta 8 MB cada una (las del celular suelen pesar 3 a 5 MB).
export const subirFotosAdopcion = multer({
  storage: multer.diskStorage({
    destination: CARPETA_ADOPCIONES,
    filename: (_req, archivo, cb) => cb(null, `${crypto.randomUUID()}${EXTENSIONES[archivo.mimetype]}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: MAX_FOTOS_POR_ANIMAL },
  fileFilter: (_req, archivo, cb) => cb(null, archivo.mimetype in EXTENSIONES),
});

export function urlPublica(nombreArchivo: string) {
  return `/uploads/adopciones/${nombreArchivo}`;
}

// Borra del disco una foto subida (las fotos de ejemplo de /fotos no se tocan).
export function borrarArchivoSubido(url: string) {
  if (!url.startsWith("/uploads/adopciones/")) return;
  const archivo = path.join(CARPETA_ADOPCIONES, path.basename(url));
  fs.rm(archivo, { force: true }, () => {});
}
