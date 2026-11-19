import { Router } from "express";
import { sesionOpcional } from "../lib/auth";
import { PERSONAL, puede } from "../lib/permisos";
import { prisma } from "../lib/prisma";

export const archivosRouter = Router();

// Entrega un archivo guardado en la base, solo a quien lo puede ver:
// - fotos del equipo (públicas): cualquiera, son las de la web;
// - foto de una mascota: el personal de la clínica y su dueño;
// - adjunto de la historia clínica: solo administración y veterinarios (lo clínico).
archivosRouter.get("/:id", sesionOpcional, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "Archivo no encontrado" });
    return;
  }
  const archivo = await prisma.archivo.findUnique({
    where: { id },
    include: {
      fotoDe: { select: { cliente: { select: { usuarioId: true } } } },
      adjunto: { select: { quitado: true } },
    },
  });
  const usuario = req.usuario;
  const delPersonal = !!usuario && PERSONAL.includes(usuario.rol) && usuario.clinicaId === archivo?.clinicaId;

  let permitido = false;
  if (archivo?.publico) permitido = true;
  else if (archivo?.fotoDe) permitido = delPersonal || (!!usuario && archivo.fotoDe.cliente.usuarioId === usuario.id);
  else if (archivo?.adjunto) permitido = delPersonal && puede(usuario!.rol, "clinica.ver") && !archivo.adjunto.quitado;
  else if (archivo) permitido = delPersonal && usuario!.rol === "ADMIN";

  if (!archivo || !permitido) {
    // Mismo mensaje si no existe o si no se puede ver: no se revela qué archivos hay.
    res.status(404).json({ error: "Archivo no encontrado" });
    return;
  }

  const descargar = req.query.descargar === "1";
  res.setHeader("Content-Type", archivo.tipo);
  res.setHeader("Content-Length", String(archivo.tamanio));
  res.setHeader(
    "Content-Disposition",
    `${descargar ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`,
  );
  res.setHeader("Cache-Control", archivo.publico ? "public, max-age=86400" : "private, max-age=3600");
  // Un PDF abierto en el navegador no puede ejecutar nada de la página.
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  res.end(Buffer.from(archivo.datos));
});
