import path from "node:path";
import type { ErrorRequestHandler, Request } from "express";
import multer from "multer";
import { prisma } from "./prisma";

// Carpeta vieja de fotos subidas (antes del 22/11 se guardaban sueltas en el disco).
// Se sigue sirviendo por si quedó alguna; lo nuevo se guarda dentro de la base (tabla archivo).
export const CARPETA_SUBIDAS = path.resolve(__dirname, "../../uploads");

const MB = 1024 * 1024;
export const TAMANIO_MAXIMO = 8 * MB;

// Tipos permitidos. Se mira el contenido real del archivo (sus primeros bytes), no solo lo que dice el navegador:
// así nadie sube un programa disfrazado de foto.
const FIRMAS: { tipo: string; es: (b: Buffer) => boolean }[] = [
  { tipo: "image/jpeg", es: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { tipo: "image/png", es: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { tipo: "image/webp", es: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { tipo: "application/pdf", es: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
];
const IMAGENES = ["image/jpeg", "image/png", "image/webp"];

export function tipoReal(datos: Buffer): string | null {
  return FIRMAS.find((f) => f.es(datos))?.tipo ?? null;
}

export function esImagen(tipo: string) {
  return IMAGENES.includes(tipo);
}

// Se recibe en memoria y después se guarda en la base (no queda nada suelto en el disco del servidor).
function subida(tipos: string[]) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: TAMANIO_MAXIMO, files: 1 },
    fileFilter: (_req, archivo, cb) => cb(null, tipos.includes(archivo.mimetype)),
  });
}

// Fotos (del equipo y de las mascotas): JPG, PNG o WEBP. La web las achica antes de mandarlas.
export const subirFoto = subida(IMAGENES);
// Adjuntos de la historia clínica: fotos o PDF (análisis, ecografías, radiografías).
export const subirAdjunto = subida([...IMAGENES, "application/pdf"]);

// Guarda el archivo en la base y devuelve su id. Si el contenido no es del tipo que dice, devuelve null.
export async function guardarArchivo(
  req: Request,
  archivo: Express.Multer.File,
  opciones: { publico?: boolean; soloImagen?: boolean } = {},
) {
  const tipo = tipoReal(archivo.buffer);
  if (!tipo || (opciones.soloImagen && !esImagen(tipo))) return null;
  const nombre = path.basename(archivo.originalname).slice(0, 180) || "archivo";
  return prisma.archivo.create({
    data: {
      clinicaId: req.usuario!.clinicaId,
      nombre,
      tipo,
      tamanio: archivo.size,
      datos: new Uint8Array(archivo.buffer),
      publico: opciones.publico ?? false,
      subidoPorId: req.usuario!.id,
    },
    select: { id: true, nombre: true, tipo: true, tamanio: true, creadoEn: true },
  });
}

export function urlArchivo(id: number) {
  return `/api/archivos/${id}`;
}

// Si la url es de un archivo guardado en la base, devuelve su id (para borrarlo al reemplazar una foto).
export function idDeUrl(url: string | null | undefined): number | null {
  const m = url?.match(/^\/api\/archivos\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

// Errores de subida (muy pesado, más de un archivo) con un mensaje entendible.
export const erroresDeSubida: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    const mensaje =
      err.code === "LIMIT_FILE_SIZE"
        ? "El archivo puede pesar hasta 8 MB"
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Elegí un solo archivo"
          : "No se pudo subir el archivo";
    res.status(400).json({ error: mensaje });
    return;
  }
  next(err);
};
