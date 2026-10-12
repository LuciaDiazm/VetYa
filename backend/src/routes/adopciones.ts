import { Router, type ErrorRequestHandler } from "express";
import multer from "multer";
import { z } from "zod";
import { requiereRol, requiereSesion } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { borrarArchivoSubido, MAX_FOTOS_POR_ANIMAL, subirFotosAdopcion, urlPublica } from "../lib/subidas";
import { normalizarTelefono } from "../lib/telefono";

// Por ahora el sistema atiende a una sola clínica.
const CLINICA_ID = 1;

const conFotos = { fotos: { orderBy: { orden: "asc" as const } } };

// =====================================================================
// Parte pública: ver animales y pedir conocer a uno
// =====================================================================

export const adopcionesPublicoRouter = Router();

adopcionesPublicoRouter.get("/", async (_req, res) => {
  const [enAdopcion, adoptados] = await Promise.all([
    prisma.animalAdopcion.findMany({
      where: { clinicaId: CLINICA_ID, estado: { in: ["DISPONIBLE", "RESERVADO"] } },
      include: conFotos,
      orderBy: [{ estado: "asc" }, { publicadoEn: "desc" }],
    }),
    // Los últimos adoptados se muestran como "¡Ya tiene familia!"
    prisma.animalAdopcion.findMany({
      where: { clinicaId: CLINICA_ID, estado: "ADOPTADO" },
      include: conFotos,
      orderBy: { adoptadoEn: "desc" },
      take: 6,
    }),
  ]);
  res.json({ enAdopcion, adoptados });
});

adopcionesPublicoRouter.get("/:id", async (req, res) => {
  const animal = await prisma.animalAdopcion.findFirst({
    where: { id: Number(req.params.id), clinicaId: CLINICA_ID },
    include: conFotos,
  });
  if (!animal) {
    res.status(404).json({ error: "No encontramos ese animal" });
    return;
  }
  res.json(animal);
});

const esquemaSolicitud = z.object({
  nombre: z.string().trim().min(2, "Escribí tu nombre"),
  telefono: z.string().trim().min(8, "Escribí un teléfono válido"),
  vivienda: z.enum(["CASA_CON_PATIO", "CASA_SIN_PATIO", "DEPARTAMENTO"], { message: "Contanos dónde vivís" }),
  otrosAnimales: z.boolean({ message: "Contanos si tenés otros animales" }),
  aceptaCompromiso: z.literal(true, { message: "Para adoptar hay que aceptar el compromiso" }),
  mensaje: z.string().trim().max(500).optional(),
});

adopcionesPublicoRouter.post("/:id/solicitudes", async (req, res) => {
  const resultado = esquemaSolicitud.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }

  const animal = await prisma.animalAdopcion.findFirst({
    where: { id: Number(req.params.id), clinicaId: CLINICA_ID },
  });
  if (!animal || animal.estado === "ADOPTADO") {
    res.status(404).json({ error: "Este animal ya no está en adopción" });
    return;
  }

  const datos = resultado.data;
  const solicitud = await prisma.solicitudAdopcion.create({
    data: {
      animalId: animal.id,
      nombre: datos.nombre,
      telefono: normalizarTelefono(datos.telefono),
      vivienda: datos.vivienda,
      otrosAnimales: datos.otrosAnimales,
      aceptaCompromiso: true,
      mensaje: datos.mensaje || null,
    },
  });
  res.status(201).json({ id: solicitud.id });
});

// =====================================================================
// Panel de la clínica: publicar animales y atender solicitudes
// =====================================================================

export const adopcionesRouter = Router();

adopcionesRouter.use(requiereSesion, requiereRol("VETERINARIO", "ADMIN"));

const esquemaAnimal = z.object({
  nombre: z.string().trim().min(1, "Poné un nombre"),
  especie: z.enum(["PERRO", "GATO"]),
  sexo: z.enum(["MACHO", "HEMBRA"]),
  edad: z.enum(["CACHORRO", "JOVEN", "ADULTO", "MAYOR"]),
  tamano: z.enum(["CHICO", "MEDIANO", "GRANDE"]),
  color: z.string().trim().min(1, "Elegí un color"),
  historia: z.string().trim().max(600).optional(),
  tranquilo: z.boolean(),
  jugueton: z.boolean(),
  buenoConChicos: z.boolean(),
  conviveConPerros: z.boolean(),
  conviveConGatos: z.boolean(),
  vacunado: z.boolean(),
  desparasitado: z.boolean(),
  castrado: z.boolean(),
});

// Busca un animal de la clínica del usuario; si no existe responde 404.
async function animalDeLaClinica(id: number, clinicaId: number) {
  return prisma.animalAdopcion.findFirst({ where: { id, clinicaId }, include: conFotos });
}

adopcionesRouter.get("/", async (req, res) => {
  const animales = await prisma.animalAdopcion.findMany({
    where: { clinicaId: req.usuario!.clinicaId },
    include: {
      ...conFotos,
      _count: { select: { solicitudes: { where: { estado: "NUEVA" } } } },
    },
    orderBy: [{ estado: "asc" }, { publicadoEn: "desc" }],
  });
  res.json(animales);
});

adopcionesRouter.post("/", async (req, res) => {
  const resultado = esquemaAnimal.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const animal = await prisma.animalAdopcion.create({
    data: { ...resultado.data, historia: resultado.data.historia || null, clinicaId: req.usuario!.clinicaId },
    include: conFotos,
  });
  res.status(201).json(animal);
});

adopcionesRouter.put("/:id", async (req, res) => {
  const resultado = esquemaAnimal.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const id = Number(req.params.id);
  if (!(await animalDeLaClinica(id, req.usuario!.clinicaId))) {
    res.status(404).json({ error: "Animal no encontrado" });
    return;
  }
  const animal = await prisma.animalAdopcion.update({
    where: { id },
    data: { ...resultado.data, historia: resultado.data.historia || null },
    include: conFotos,
  });
  res.json(animal);
});

// Cambiar el estado con un toque: Disponible → Reservado → Adoptado.
adopcionesRouter.patch("/:id/estado", async (req, res) => {
  const resultado = z.object({ estado: z.enum(["DISPONIBLE", "RESERVADO", "ADOPTADO"]) }).safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: "Estado inválido" });
    return;
  }
  const id = Number(req.params.id);
  if (!(await animalDeLaClinica(id, req.usuario!.clinicaId))) {
    res.status(404).json({ error: "Animal no encontrado" });
    return;
  }
  const { estado } = resultado.data;
  const animal = await prisma.animalAdopcion.update({
    where: { id },
    data: { estado, adoptadoEn: estado === "ADOPTADO" ? new Date() : null },
    include: conFotos,
  });
  res.json(animal);
});

adopcionesRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const animal = await animalDeLaClinica(id, req.usuario!.clinicaId);
  if (!animal) {
    res.status(404).json({ error: "Animal no encontrado" });
    return;
  }
  await prisma.animalAdopcion.delete({ where: { id } });
  animal.fotos.forEach((f) => borrarArchivoSubido(f.url));
  res.status(204).end();
});

// Subir fotos (campo "fotos", hasta 4 por animal en total).
adopcionesRouter.post("/:id/fotos", subirFotosAdopcion.array("fotos", MAX_FOTOS_POR_ANIMAL), async (req, res) => {
  const archivos = (req.files as Express.Multer.File[] | undefined) ?? [];
  const id = Number(req.params.id);
  const animal = await animalDeLaClinica(id, req.usuario!.clinicaId);

  const descartar = () => archivos.forEach((a) => borrarArchivoSubido(urlPublica(a.filename)));
  if (!animal) {
    descartar();
    res.status(404).json({ error: "Animal no encontrado" });
    return;
  }
  if (archivos.length === 0) {
    res.status(400).json({ error: "Elegí al menos una foto (JPG, PNG o WEBP)" });
    return;
  }
  if (animal.fotos.length + archivos.length > MAX_FOTOS_POR_ANIMAL) {
    descartar();
    res.status(400).json({ error: `Cada animal puede tener hasta ${MAX_FOTOS_POR_ANIMAL} fotos` });
    return;
  }

  await prisma.fotoAdopcion.createMany({
    data: archivos.map((a, i) => ({ animalId: id, url: urlPublica(a.filename), orden: animal.fotos.length + i })),
  });
  res.status(201).json(await animalDeLaClinica(id, req.usuario!.clinicaId));
});

adopcionesRouter.delete("/:id/fotos/:fotoId", async (req, res) => {
  const id = Number(req.params.id);
  if (!(await animalDeLaClinica(id, req.usuario!.clinicaId))) {
    res.status(404).json({ error: "Animal no encontrado" });
    return;
  }
  const foto = await prisma.fotoAdopcion.findFirst({ where: { id: Number(req.params.fotoId), animalId: id } });
  if (!foto) {
    res.status(404).json({ error: "Foto no encontrada" });
    return;
  }
  await prisma.fotoAdopcion.delete({ where: { id: foto.id } });
  borrarArchivoSubido(foto.url);
  res.json(await animalDeLaClinica(id, req.usuario!.clinicaId));
});

// ---------- Solicitudes ----------

adopcionesRouter.get("/solicitudes/lista", async (req, res) => {
  const solicitudes = await prisma.solicitudAdopcion.findMany({
    where: { animal: { clinicaId: req.usuario!.clinicaId } },
    include: { animal: { select: { id: true, nombre: true, especie: true, estado: true, fotos: { take: 1, orderBy: { orden: "asc" } } } } },
    orderBy: [{ estado: "asc" }, { creadaEn: "desc" }],
  });
  res.json(solicitudes);
});

// Cantidad de solicitudes nuevas, para el aviso del menú del panel.
adopcionesRouter.get("/solicitudes/resumen", async (req, res) => {
  const nuevas = await prisma.solicitudAdopcion.count({
    where: { estado: "NUEVA", animal: { clinicaId: req.usuario!.clinicaId } },
  });
  res.json({ nuevas });
});

adopcionesRouter.patch("/solicitudes/:id", async (req, res) => {
  const resultado = z
    .object({ estado: z.enum(["NUEVA", "CONTACTADA", "APROBADA", "RECHAZADA"]) })
    .safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: "Estado inválido" });
    return;
  }
  const solicitud = await prisma.solicitudAdopcion.findFirst({
    where: { id: Number(req.params.id), animal: { clinicaId: req.usuario!.clinicaId } },
  });
  if (!solicitud) {
    res.status(404).json({ error: "Solicitud no encontrada" });
    return;
  }
  const actualizada = await prisma.solicitudAdopcion.update({
    where: { id: solicitud.id },
    data: { estado: resultado.data.estado },
  });
  res.json(actualizada);
});

// Errores de subida (foto muy pesada, demasiadas fotos) con un mensaje entendible.
export const erroresDeSubida: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const unaSola = req.originalUrl.startsWith("/api/usuarios/");
    const mensaje =
      err.code === "LIMIT_FILE_SIZE"
        ? "Cada foto puede pesar hasta 8 MB"
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
          ? unaSola
            ? "Elegí una sola foto"
            : `Podés subir hasta ${MAX_FOTOS_POR_ANIMAL} fotos`
          : "No se pudo subir la foto";
    res.status(400).json({ error: mensaje });
    return;
  }
  next(err);
};
