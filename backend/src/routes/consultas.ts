import { Router } from "express";
import { z } from "zod";
import { diaArgentina } from "../lib/agenda";
import { requiereRol, requiereSesion } from "../lib/auth";
import { registrarCambio } from "../lib/auditoria";
import { PERSONAL, requierePermiso } from "../lib/permisos";
import { prisma } from "../lib/prisma";
import { guardarArchivo, subirAdjunto } from "../lib/subidas";

// Historia clínica: consultas y aplicaciones sanitarias (vacunas y desparasitaciones).
// Cargarla es de administración y veterinarios; recepción no la toca.
export const consultasRouter = Router();
consultasRouter.use(requiereSesion, requiereRol(...PERSONAL), requierePermiso("clinica.escribir"));

const esDeHoy = (fecha: Date) => diaArgentina(fecha) === diaArgentina(new Date());

const NOMBRE_CAMPO: Record<string, string> = {
  motivo: "motivo",
  pesoKg: "peso",
  temperatura: "temperatura",
  diagnostico: "diagnóstico",
  tratamiento: "tratamiento",
  observaciones: "observaciones",
};

const textoOpcional = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v ? v : null));

// Fecha "AAAA-MM-DD" (sin hora) o vacía.
const fechaOpcional = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null))
  .refine((d) => !d || !Number.isNaN(d.getTime()), "Fecha inválida");

const esquemaAplicacion = z.object({
  tipo: z.enum(["VACUNA", "DESPARASITACION"]),
  producto: z.string().trim().min(1, "Escribí qué vacuna o desparasitario se aplicó"),
  lote: textoOpcional,
  fechaProximaDosis: fechaOpcional,
});

const numeroOpcional = (min: number, max: number, mensaje: string) =>
  z
    .number()
    .min(min, mensaje)
    .max(max, mensaje)
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const esquemaConsulta = z.object({
  motivo: z.string().trim().min(1, "Escribí el motivo de la consulta"),
  pesoKg: numeroOpcional(0.05, 150, "El peso no parece correcto"),
  temperatura: numeroOpcional(30, 45, "La temperatura no parece correcta"),
  diagnostico: textoOpcional,
  tratamiento: textoOpcional,
  observaciones: textoOpcional,
});

const esquemaNuevaConsulta = esquemaConsulta.extend({
  mascotaId: z.number().int(),
  turnoId: z.number().int().optional(),
  aplicaciones: z.array(esquemaAplicacion).max(10).default([]),
});

consultasRouter.post("/", async (req, res) => {
  const resultado = esquemaNuevaConsulta.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const { mascotaId, turnoId, aplicaciones, ...datos } = resultado.data;
  const clinicaId = req.usuario!.clinicaId;

  const mascota = await prisma.mascota.findFirst({ where: { id: mascotaId, cliente: { clinicaId } } });
  if (!mascota) {
    res.status(404).json({ error: "Mascota no encontrada" });
    return;
  }

  // Si la consulta viene de un turno, tiene que ser de esta mascota y no tener ya una consulta.
  if (turnoId) {
    const turno = await prisma.turno.findFirst({
      where: { id: turnoId, clinicaId, mascotaId },
      include: { consulta: true },
    });
    if (!turno) {
      res.status(400).json({ error: "El turno no corresponde a esta mascota" });
      return;
    }
    if (turno.consulta) {
      res.status(409).json({ error: "Ese turno ya tiene una consulta cargada" });
      return;
    }
  }

  const ahora = new Date();
  // Día de hoy en Argentina (después de las 21 h, en UTC ya es el día siguiente).
  const hoySinHora = new Date(`${diaArgentina(ahora)}T00:00:00.000Z`);

  const consulta = await prisma.$transaction(async (tx) => {
    const creada = await tx.consulta.create({
      data: {
        ...datos,
        mascotaId,
        veterinarioId: req.usuario!.id,
        turnoId: turnoId ?? null,
        fecha: ahora,
        aplicaciones: {
          create: aplicaciones.map((a) => ({
            ...a,
            mascotaId,
            fechaAplicacion: hoySinHora,
            registradoPorId: req.usuario!.id,
          })),
        },
      },
      include: { aplicaciones: true },
    });
    // Cargar la consulta de un turno lo marca como atendido.
    if (turnoId) {
      await tx.turno.update({
        where: { id: turnoId },
        data: { estado: "ATENDIDO", veterinarioId: req.usuario!.id },
      });
    }
    return creada;
  });

  res.status(201).json(consulta);
});

consultasRouter.put("/:id", async (req, res) => {
  const resultado = esquemaConsulta.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const id = Number(req.params.id);
  const consulta = await prisma.consulta.findFirst({
    where: { id, mascota: { cliente: { clinicaId: req.usuario!.clinicaId } } },
  });
  if (!consulta) {
    res.status(404).json({ error: "Consulta no encontrada" });
    return;
  }
  // Una consulta es un registro clínico: la veterinaria o el veterinario corrige la suya el mismo día;
  // después, solo la administración. Cada corrección queda anotada con lo que había antes.
  const usuario = req.usuario!;
  if (usuario.rol !== "ADMIN" && !(consulta.veterinarioId === usuario.id && esDeHoy(consulta.fecha))) {
    res.status(403).json({ error: "Solo podés corregir tus consultas del día. Pedíselo a la administración" });
    return;
  }
  const actualizada = await prisma.$transaction(async (tx) => {
    const nueva = await tx.consulta.update({
      where: { id },
      data: { ...resultado.data, editadaEn: new Date(), editadaPorId: usuario.id },
    });
    const campos = ["motivo", "pesoKg", "temperatura", "diagnostico", "tratamiento", "observaciones"] as const;
    const antes: Record<string, unknown> = {};
    const despues: Record<string, unknown> = {};
    for (const c of campos) {
      if (String(consulta[c] ?? "") !== String(nueva[c] ?? "")) {
        antes[c] = consulta[c];
        despues[c] = nueva[c];
      }
    }
    const dia = consulta.fecha.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
    await registrarCambio(
      req,
      {
        accion: "consulta.corregir",
        entidad: "consulta",
        entidadId: id,
        resumen: `Corrigió la consulta del ${dia} (${Object.keys(despues).map((c) => NOMBRE_CAMPO[c]).join(", ") || "sin cambios"})`,
        antes,
        despues,
      },
      tx,
    );
    return nueva;
  });
  res.json(actualizada);
});

// ---------- Vacunas y desparasitaciones sueltas ----------
// Para registrar las que se aplicaron antes (por ejemplo, las que figuran en la libreta de papel).

const esquemaAplicacionSuelta = esquemaAplicacion.extend({
  mascotaId: z.number().int(),
  fechaAplicacion: z
    .string()
    .transform((v) => new Date(`${v}T00:00:00.000Z`))
    .refine(
      (d) => !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) <= diaArgentina(new Date()),
      "La fecha de aplicación no es válida",
    ),
});

consultasRouter.post("/aplicaciones", async (req, res) => {
  const resultado = esquemaAplicacionSuelta.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const { mascotaId, ...datos } = resultado.data;
  const mascota = await prisma.mascota.findFirst({
    where: { id: mascotaId, cliente: { clinicaId: req.usuario!.clinicaId } },
  });
  if (!mascota) {
    res.status(404).json({ error: "Mascota no encontrada" });
    return;
  }
  if (datos.fechaProximaDosis && datos.fechaProximaDosis < datos.fechaAplicacion) {
    res.status(400).json({ error: "La próxima dosis tiene que ser después de la aplicación" });
    return;
  }
  const aplicacion = await prisma.aplicacionSanitaria.create({
    data: { ...datos, mascotaId, registradoPorId: req.usuario!.id },
  });
  res.status(201).json(aplicacion);
});

// Una vacuna mal cargada no se borra: se anula con un motivo y queda tachada en la ficha.
// Deja de contar para los avisos y el carnet. La administración anula cualquiera;
// quien la cargó, la suya del mismo día.
const esquemaAnular = z.object({
  motivo: z.string().trim().min(3, "Escribí por qué se anula").max(300),
});

consultasRouter.patch("/aplicaciones/:id/anular", async (req, res) => {
  const resultado = esquemaAnular.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  const id = Number(req.params.id);
  const usuario = req.usuario!;
  const aplicacion = await prisma.aplicacionSanitaria.findFirst({
    where: { id, mascota: { cliente: { clinicaId: usuario.clinicaId } } },
    include: { mascota: { select: { nombre: true } } },
  });
  if (!aplicacion) {
    res.status(404).json({ error: "Registro no encontrado" });
    return;
  }
  if (aplicacion.anulada) {
    res.status(409).json({ error: "Ya estaba anulada" });
    return;
  }
  const suyaDeHoy = aplicacion.registradoPorId === usuario.id && esDeHoy(aplicacion.creadoEn);
  if (usuario.rol !== "ADMIN" && !suyaDeHoy) {
    res.status(403).json({ error: "Solo podés anular lo que cargaste hoy. Pedíselo a la administración" });
    return;
  }
  const anulada = await prisma.$transaction(async (tx) => {
    const r = await tx.aplicacionSanitaria.update({
      where: { id },
      data: { anulada: true, anuladaEn: new Date(), anuladaPorId: usuario.id, motivoAnulacion: resultado.data.motivo },
    });
    const que = aplicacion.tipo === "VACUNA" ? "la vacuna" : "la desparasitación";
    await registrarCambio(
      req,
      {
        accion: "vacuna.anular",
        entidad: "aplicacion",
        entidadId: id,
        resumen: `Anuló ${que} ${aplicacion.producto} de ${aplicacion.mascota.nombre}: ${resultado.data.motivo}`,
      },
      tx,
    );
    return r;
  });
  res.json(anulada);
});

// ---------- Archivos adjuntos (análisis, ecografías, radiografías, fotos) ----------

const esquemaAdjunto = z.object({
  mascotaId: z.coerce.number().int(),
  consultaId: z.coerce.number().int().optional(),
  descripcion: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : null)),
});

consultasRouter.post("/adjuntos", subirAdjunto.single("archivo"), async (req, res) => {
  const resultado = esquemaAdjunto.safeParse(req.body ?? {});
  if (!resultado.success) {
    res.status(400).json({ error: resultado.error.issues[0].message });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "Elegí un archivo (foto o PDF)" });
    return;
  }
  const { mascotaId, consultaId, descripcion } = resultado.data;
  const clinicaId = req.usuario!.clinicaId;
  const mascota = await prisma.mascota.findFirst({ where: { id: mascotaId, cliente: { clinicaId } } });
  if (!mascota) {
    res.status(404).json({ error: "Mascota no encontrada" });
    return;
  }
  if (consultaId && !(await prisma.consulta.findFirst({ where: { id: consultaId, mascotaId } }))) {
    res.status(400).json({ error: "La consulta no corresponde a esta mascota" });
    return;
  }
  const archivo = await guardarArchivo(req, req.file);
  if (!archivo) {
    res.status(400).json({ error: "Solo se pueden adjuntar fotos (JPG, PNG, WEBP) o PDF" });
    return;
  }
  const adjunto = await prisma.adjunto.create({
    data: { mascotaId, consultaId: consultaId ?? null, archivoId: archivo.id, descripcion, subidoPorId: req.usuario!.id },
    include: {
      archivo: { select: { nombre: true, tipo: true, tamanio: true } },
      subidoPor: { select: { id: true, nombre: true, apellido: true } },
    },
  });
  res.status(201).json(adjunto);
});

// Quitar un adjunto lo saca de la ficha, pero queda guardado y anotado (no se pierde nada clínico).
consultasRouter.patch("/adjuntos/:id/quitar", async (req, res) => {
  const id = Number(req.params.id);
  const usuario = req.usuario!;
  const adjunto = await prisma.adjunto.findFirst({
    where: { id, quitado: false, mascota: { cliente: { clinicaId: usuario.clinicaId } } },
    include: { archivo: { select: { nombre: true } }, mascota: { select: { nombre: true } } },
  });
  if (!adjunto) {
    res.status(404).json({ error: "Archivo no encontrado" });
    return;
  }
  if (usuario.rol !== "ADMIN" && !(adjunto.subidoPorId === usuario.id && esDeHoy(adjunto.creadoEn))) {
    res.status(403).json({ error: "Solo podés quitar lo que subiste hoy. Pedíselo a la administración" });
    return;
  }
  await prisma.adjunto.update({
    where: { id },
    data: { quitado: true, quitadoEn: new Date(), quitadoPorId: usuario.id },
  });
  await registrarCambio(req, {
    accion: "adjunto.quitar",
    entidad: "adjunto",
    entidadId: id,
    resumen: `Quitó el archivo ${adjunto.archivo.nombre} de la ficha de ${adjunto.mascota.nombre}`,
  });
  res.status(204).end();
});
