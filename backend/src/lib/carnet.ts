import crypto from "node:crypto";
import path from "node:path";
import PDFDocument from "pdfkit";
import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// Carnet de vacunación en PDF
// ---------------------------------------------------------------------------
// Es un carnet para imprimir y doblar: una hoja A4 apaisada, de los dos lados, doblada al medio.
//   Hoja 1 (afuera):  contratapa (datos de la clínica, alergias, notas) | tapa (logo y datos de la mascota)
//   Hoja 2 (adentro): vacunas | desparasitaciones
// Todo se completa solo con lo que está cargado; quedan renglones en blanco para seguir a mano.
// Si las vacunas no entran, se agregan hojas de continuación con el mismo formato.

export const AZUL = "#1C2D63";
export const AMARILLO = "#F6C343";
export const GRIS = "#57627A";
const TINTA = "#1C2537";
const BORDE = "#E6DCCD";
const CREMA = "#F8F3EB";
const CELESTE = "#EAF4FC";
const ROJO = "#B42318";

// El logo de VetYa (el perro y el gato), el mismo dibujo de la web.
const CARPETA_RECURSOS = path.resolve(__dirname, "../../assets");
const LOGO_BLANCO = path.join(CARPETA_RECURSOS, "logo-blanco.png");
const LOGO_AZUL = path.join(CARPETA_RECURSOS, "logo.png");
const PROPORCION_LOGO = 202 / 410; // alto / ancho del dibujo

const FECHA = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const FECHA_EMISION = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

// Teléfono legible: "5493777123456" → "3777 123456" (igual que en el panel).
function telefonoLegible(telefono: string) {
  const d = telefono.replace(/\D/g, "");
  return d.startsWith("549") && d.length === 13 ? `${d.slice(3, 7)} ${d.slice(7)}` : telefono;
}

// Devuelve el enlace privado del carnet de una mascota; si no tiene, lo crea.
export async function tokenDeCarnet(mascotaId: number) {
  const mascota = await prisma.mascota.findUniqueOrThrow({ where: { id: mascotaId }, select: { tokenCarnet: true } });
  if (mascota.tokenCarnet) return mascota.tokenCarnet;
  const token = crypto.randomBytes(18).toString("base64url"); // 24 caracteres imposibles de adivinar
  await prisma.mascota.update({ where: { id: mascotaId }, data: { tokenCarnet: token } });
  return token;
}

export async function datosDelCarnet(token: string) {
  return prisma.mascota.findUnique({
    where: { tokenCarnet: token },
    include: {
      cliente: { include: { clinica: true } },
      aplicaciones: {
        where: { anulada: false },
        orderBy: { fechaAplicacion: "asc" },
        include: {
          consulta: { select: { pesoKg: true } },
          registradoPor: { select: { nombre: true, apellido: true, matricula: true } },
        },
      },
    },
  });
}

type DatosCarnet = NonNullable<Awaited<ReturnType<typeof datosDelCarnet>>>;

type Clinica = { nombre: string; direccion: string; telefono: string };

// Encabezado de los otros PDF de la clínica (informe, recomendaciones): franja azul con el logo
// y "VetYa" en blanco, los datos de la clínica a la derecha y una línea amarilla abajo.
export function encabezadoPdf(doc: PDFKit.PDFDocument, clinica: Clinica) {
  const anchoPagina = doc.page.width;
  const margen = doc.page.margins.left;
  const alto = 92;

  doc.rect(0, 0, anchoPagina, alto).fill(AZUL);
  doc.rect(0, alto, anchoPagina, 5).fill(AMARILLO);

  const anchoLogo = 78;
  doc.image(LOGO_BLANCO, margen, 22, { width: anchoLogo });
  doc
    .font("Helvetica-Bold")
    .fontSize(26)
    .fillColor("#FFFFFF")
    .text("VetYa", margen + anchoLogo + 12, 30, { lineBreak: false });

  const anchoDatos = 240;
  const xDatos = anchoPagina - margen - anchoDatos;
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#FFFFFF").text(clinica.nombre, xDatos, 28, { width: anchoDatos, align: "right" });
  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor("#D6DCEC")
    .text(clinica.direccion, xDatos, 46, { width: anchoDatos, align: "right" })
    .text(`Tel. ${clinica.telefono}`, xDatos, 59, { width: anchoDatos, align: "right" });

  doc.x = margen;
  return alto + 28;
}

// ---------------------------------------------------------------------------
// Piezas del carnet
// ---------------------------------------------------------------------------

const ANCHO_HOJA = 841.89; // A4 apaisada
const ALTO_HOJA = 595.28;
const MITAD = ANCHO_HOJA / 2;
const MARGEN = 30; // dentro de cada mitad

type Panel = { x: number; y: number; ancho: number; alto: number };
const panelIzquierdo: Panel = { x: MARGEN, y: MARGEN, ancho: MITAD - MARGEN * 2, alto: ALTO_HOJA - MARGEN * 2 };
const panelDerecho: Panel = { x: MITAD + MARGEN, y: MARGEN, ancho: MITAD - MARGEN * 2, alto: ALTO_HOJA - MARGEN * 2 };

// Una huellita: almohadilla y cuatro deditos.
function huella(doc: PDFKit.PDFDocument, x: number, y: number, tam: number, giro: number) {
  doc.save();
  doc.translate(x, y).rotate(giro);
  doc.ellipse(0, tam * 0.35, tam * 0.42, tam * 0.34).fill();
  doc.ellipse(-tam * 0.5, -tam * 0.12, tam * 0.15, tam * 0.2).fill();
  doc.ellipse(-tam * 0.18, -tam * 0.42, tam * 0.15, tam * 0.2).fill();
  doc.ellipse(tam * 0.18, -tam * 0.42, tam * 0.15, tam * 0.2).fill();
  doc.ellipse(tam * 0.5, -tam * 0.12, tam * 0.15, tam * 0.2).fill();
  doc.restore();
}

// Fondo de la hoja: crema con huellitas suaves y la línea de doblez punteada en el medio.
function fondoHoja(doc: PDFKit.PDFDocument) {
  doc.rect(0, 0, ANCHO_HOJA, ALTO_HOJA).fill(CREMA);
  doc.save();
  doc.fillColor(AZUL).fillOpacity(0.045);
  // Grilla fija con un poco de desorden, siempre igual (no al azar) para que todas las hojas coincidan.
  for (let fila = 0; fila < 9; fila++) {
    for (let col = 0; col < 14; col++) {
      const x = 22 + col * 60 + (fila % 2) * 30 + ((col * 7 + fila * 3) % 5) * 2;
      const y = 22 + fila * 68 + ((col * 5 + fila) % 4) * 3;
      huella(doc, x, y, 10 + ((col + fila) % 3) * 2, ((col * 37 + fila * 53) % 70) - 35);
    }
  }
  doc.restore();
  // Doblez
  doc.save();
  doc
    .moveTo(MITAD, 12)
    .lineTo(MITAD, ALTO_HOJA - 12)
    .dash(3, { space: 4 })
    .strokeColor(BORDE)
    .lineWidth(0.8)
    .stroke();
  doc.restore();
}

// Título de una página del carnet: texto azul en mayúsculas con una rayita amarilla debajo.
function tituloPanel(doc: PDFKit.PDFDocument, p: Panel, texto: string, y: number) {
  doc.font("Helvetica-Bold").fontSize(15).fillColor(AZUL).text(texto.toUpperCase(), p.x, y, {
    width: p.ancho,
    align: "center",
    characterSpacing: 0.8,
    lineBreak: false,
  });
  doc.roundedRect(p.x + p.ancho / 2 - 22, y + 21, 44, 4, 2).fill(AMARILLO);
  return y + 36;
}

// Campo de la ficha: etiqueta chiquita arriba y el dato escrito en una cajita blanca.
const ALTO_CAMPO = 41;

function campo(doc: PDFKit.PDFDocument, x: number, y: number, ancho: number, etiqueta: string, valor: string, alto = ALTO_CAMPO) {
  doc.roundedRect(x, y, ancho, alto, 6).fill("#FFFFFF");
  doc.roundedRect(x, y, ancho, alto, 6).strokeColor(BORDE).lineWidth(0.8).stroke();
  doc.font("Helvetica-Bold").fontSize(6.8).fillColor(GRIS).text(etiqueta.toUpperCase(), x + 9, y + 8, {
    characterSpacing: 0.5,
    lineBreak: false,
  });
  doc
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .fillColor(TINTA)
    .text(valor, x + 9, y + 21, { width: ancho - 18, lineBreak: false, ellipsis: true });
}

// Campo con opciones para marcar (como en un carnet de papel): la que corresponde va rellena.
function campoOpciones(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  ancho: number,
  etiqueta: string,
  opciones: string[],
  elegida: string | null,
  extra?: string,
) {
  const alto = ALTO_CAMPO;
  doc.roundedRect(x, y, ancho, alto, 6).fill("#FFFFFF");
  doc.roundedRect(x, y, ancho, alto, 6).strokeColor(BORDE).lineWidth(0.8).stroke();
  doc.font("Helvetica-Bold").fontSize(6.8).fillColor(GRIS).text(etiqueta.toUpperCase(), x + 9, y + 8, {
    characterSpacing: 0.5,
    lineBreak: false,
  });
  let cx = x + 9;
  const cy = y + 27;
  for (const op of opciones) {
    const marcada = op === elegida;
    doc.circle(cx + 4, cy, 4).lineWidth(1).strokeColor(AZUL).stroke();
    if (marcada) doc.circle(cx + 4, cy, 2.4).fill(AZUL);
    const texto = marcada && extra ? `${op}: ${extra}` : op;
    doc
      .font(marcada ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9)
      .fillColor(marcada ? TINTA : GRIS)
      .text(texto, cx + 11, cy - 4.5, { lineBreak: false });
    cx += 11 + doc.widthOfString(texto) + 12;
  }
}

type Columna = { titulo: string; ancho: number; alinear?: "left" | "center" };

// Tabla de la libreta: encabezado azul, renglones blancos y crema alternados,
// primero lo cargado y después renglones vacíos hasta llenar el espacio.
function tablaLibreta(doc: PDFKit.PDFDocument, p: Panel, y: number, columnas: Columna[], filas: string[][], altoDisponible: number) {
  const altoEncabezado = 22;
  const altoFila = 27;
  const ancho = columnas.reduce((t, c) => t + c.ancho, 0);
  const x0 = p.x + (p.ancho - ancho) / 2;
  const cantidad = Math.floor((altoDisponible - altoEncabezado) / altoFila);

  doc.roundedRect(x0, y, ancho, altoEncabezado, 6).fill(AZUL);
  doc.rect(x0, y + altoEncabezado - 6, ancho, 6).fill(AZUL);
  let x = x0;
  for (const c of columnas) {
    doc
      .font("Helvetica-Bold")
      .fontSize(7.2)
      .fillColor("#FFFFFF")
      .text(c.titulo.toUpperCase(), x + 4, y + 8, { width: c.ancho - 8, align: "center", characterSpacing: 0.4, lineBreak: false });
    x += c.ancho;
  }

  let yf = y + altoEncabezado;
  for (let i = 0; i < cantidad; i++) {
    doc.rect(x0, yf, ancho, altoFila).fill(i % 2 === 0 ? "#FFFFFF" : "#FBF8F3");
    const fila = filas[i];
    let xc = x0;
    columnas.forEach((c, j) => {
      if (j > 0) doc.moveTo(xc, yf).lineTo(xc, yf + altoFila).strokeColor(BORDE).lineWidth(0.6).stroke();
      if (fila?.[j]) {
        doc
          .font(j === 1 ? "Helvetica-Bold" : "Helvetica")
          .fontSize(j === 1 ? 8.6 : 8.2)
          .fillColor(j === columnas.length - 1 && c.titulo.startsWith("Pr") ? AZUL : TINTA)
          .text(fila[j], xc + 4, yf + (doc.heightOfString(fila[j], { width: c.ancho - 8 }) > 12 ? 4 : 9.5), {
            width: c.ancho - 8,
            height: altoFila - 4,
            align: c.alinear ?? "left",
            ellipsis: true,
          });
      }
      xc += c.ancho;
    });
    yf += altoFila;
  }
  // Contorno
  doc
    .roundedRect(x0, y, ancho, yf - y, 6)
    .strokeColor(BORDE)
    .lineWidth(0.8)
    .stroke();
  return cantidad;
}

function pieDePanel(doc: PDFKit.PDFDocument, p: Panel, texto: string) {
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(GRIS)
    .text(texto, p.x, p.y + p.alto - 8, { width: p.ancho, align: "center", lineBreak: false });
}

// ---------------------------------------------------------------------------
// El carnet
// ---------------------------------------------------------------------------

// Escribe el PDF del carnet en el stream de salida (por ejemplo, la respuesta HTTP).
export function escribirCarnet(m: DatosCarnet, salida: NodeJS.WritableStream) {
  const clinica = m.cliente.clinica;
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
    autoFirstPage: false,
    info: { Title: `Carnet de vacunación de ${m.nombre}`, Author: clinica.nombre },
  });
  doc.pipe(salida);

  const especie = m.especie === "PERRO" ? "Perro" : m.especie === "GATO" ? "Gato" : "Otra";
  const dueno = `${m.cliente.nombre} ${m.cliente.apellido}`;

  // ===== Hoja 1, afuera =====
  doc.addPage();
  fondoHoja(doc);

  // ---- Tapa (mitad derecha) ----
  const t = panelDerecho;
  doc.roundedRect(MITAD + 14, 14, MITAD - 28, 150, 14).fill(AZUL);
  doc.rect(MITAD + 14, 158, MITAD - 28, 6).fill(AMARILLO);
  const anchoLogo = 150;
  doc.image(LOGO_BLANCO, MITAD + MITAD / 2 - anchoLogo / 2, 28, { width: anchoLogo });
  doc
    .font("Helvetica-Bold")
    .fontSize(30)
    .fillColor("#FFFFFF")
    .text("VetYa", t.x, 28 + anchoLogo * PROPORCION_LOGO + 6, { width: t.ancho, align: "center", lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#D6DCEC")
    .text(clinica.nombre, t.x, 28 + anchoLogo * PROPORCION_LOGO + 39, { width: t.ancho, align: "center", lineBreak: false });

  let y = tituloPanel(doc, t, "Carnet de vacunación", 184);

  const gap = 9;
  const mitadCampo = (t.ancho - gap) / 2;
  campo(doc, t.x, y, mitadCampo, "Nombre", m.nombre);
  campo(doc, t.x + mitadCampo + gap, y, mitadCampo, "Raza", m.raza ?? "");
  y += ALTO_CAMPO + gap;
  campoOpciones(doc, t.x, y, mitadCampo, "Especie", ["Perro", "Gato", "Otra"], especie, m.especie === "OTRO" ? m.otraEspecie ?? undefined : undefined);
  campoOpciones(doc, t.x + mitadCampo + gap, y, mitadCampo, "Sexo", ["Macho", "Hembra"], m.sexo === "HEMBRA" ? "Hembra" : "Macho");
  y += ALTO_CAMPO + gap;
  campo(doc, t.x, y, mitadCampo, "Fecha de nacimiento", m.fechaNacimiento ? FECHA.format(m.fechaNacimiento) : "");
  campo(doc, t.x + mitadCampo + gap, y, mitadCampo, "Pelaje / color", m.color ?? "");
  y += ALTO_CAMPO + gap;
  campoOpciones(doc, t.x, y, mitadCampo, "Castrado/a", ["Sí", "No"], m.castrado ? "Sí" : "No");
  campo(doc, t.x + mitadCampo + gap, y, mitadCampo, "Microchip", m.microchip ?? "");
  y += ALTO_CAMPO + gap;
  campo(doc, t.x, y, t.ancho, "Dueño/a", dueno);
  y += ALTO_CAMPO + gap;
  campo(doc, t.x, y, mitadCampo, "Teléfono", telefonoLegible(m.cliente.telefono));
  campo(doc, t.x + mitadCampo + gap, y, mitadCampo, "Dirección", m.cliente.direccion ?? "");

  // ---- Contratapa (mitad izquierda) ----
  const c = panelIzquierdo;
  y = tituloPanel(doc, c, "Datos importantes", c.y + 4);

  // Alergias y cuidados: en rojo si hay, para que se vea enseguida.
  const altoAlergias = 62;
  doc.roundedRect(c.x, y, c.ancho, altoAlergias, 8).fill("#FFFFFF");
  doc
    .roundedRect(c.x, y, c.ancho, altoAlergias, 8)
    .strokeColor(m.alergias ? ROJO : BORDE)
    .lineWidth(m.alergias ? 1.2 : 0.8)
    .stroke();
  doc
    .font("Helvetica-Bold")
    .fontSize(6.8)
    .fillColor(m.alergias ? ROJO : GRIS)
    .text(m.alergias ? "ALERGIAS Y CUIDADOS · ¡ATENCIÓN!" : "ALERGIAS Y CUIDADOS", c.x + 10, y + 8, {
      characterSpacing: 0.5,
      lineBreak: false,
    });
  doc
    .font(m.alergias ? "Helvetica-Bold" : "Helvetica")
    .fontSize(9.5)
    .fillColor(m.alergias ? ROJO : GRIS)
    .text(m.alergias ?? "Sin alergias registradas.", c.x + 10, y + 21, { width: c.ancho - 20, height: altoAlergias - 26, ellipsis: true });
  y += altoAlergias + 12;

  // Observaciones: renglones para escribir a mano (con las de la ficha, si hay, en el primero).
  const altoClinica = 96;
  const altoAviso = 44;
  const altoObs = c.y + c.alto - 14 - altoClinica - 12 - altoAviso - 12 - y;
  doc.roundedRect(c.x, y, c.ancho, altoObs, 8).fill("#FFFFFF");
  doc.roundedRect(c.x, y, c.ancho, altoObs, 8).strokeColor(BORDE).lineWidth(0.8).stroke();
  doc.font("Helvetica-Bold").fontSize(6.8).fillColor(GRIS).text("OBSERVACIONES", c.x + 10, y + 8, { characterSpacing: 0.5, lineBreak: false });
  if (m.observaciones) {
    doc.font("Helvetica").fontSize(9).fillColor(TINTA).text(m.observaciones, c.x + 10, y + 21, {
      width: c.ancho - 20,
      height: 34,
      ellipsis: true,
    });
  }
  for (let i = 0; i < 12; i++) {
    const yl = y + 42 + i * 20 + (m.observaciones ? 20 : 0);
    if (yl > y + altoObs - 10) break;
    doc.moveTo(c.x + 10, yl).lineTo(c.x + c.ancho - 10, yl).strokeColor(BORDE).lineWidth(0.7).stroke();
  }
  y += altoObs + 12;

  // Recordatorio
  doc.roundedRect(c.x, y, c.ancho, altoAviso, 8).fill(CELESTE);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(AZUL)
    .text("Te avisamos por WhatsApp antes de cada refuerzo.", c.x, y + 10, { width: c.ancho, align: "center", lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(GRIS)
    .text("Traé este carnet a cada visita.", c.x, y + 25, { width: c.ancho, align: "center", lineBreak: false });
  y += altoAviso + 12;

  // Datos de la clínica, abajo, en azul
  doc.roundedRect(c.x, y, c.ancho, altoClinica, 10).fill(AZUL);
  const anchoLogoChico = 52;
  doc.image(LOGO_BLANCO, c.x + 14, y + altoClinica / 2 - (anchoLogoChico * PROPORCION_LOGO) / 2, { width: anchoLogoChico });
  const xt = c.x + 14 + anchoLogoChico + 14;
  const anchoTexto = c.ancho - (xt - c.x) - 12;
  const lineas = [
    clinica.direccion,
    `Tel. ${clinica.telefono}${clinica.whatsapp && telefonoLegible(clinica.whatsapp) !== telefonoLegible(clinica.telefono) ? ` · WhatsApp ${telefonoLegible(clinica.whatsapp)}` : ""}`,
    clinica.telefonoUrgencias ? `Urgencias: ${telefonoLegible(clinica.telefonoUrgencias)}${clinica.horarioUrgencias ? ` (${clinica.horarioUrgencias})` : ""}` : null,
    clinica.email,
  ].filter((l): l is string => Boolean(l));
  const yTexto = y + altoClinica / 2 - (15 + lineas.length * 11) / 2;
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#FFFFFF").text(clinica.nombre, xt, yTexto, { width: anchoTexto, lineBreak: false, ellipsis: true });
  lineas.forEach((l, i) =>
    doc
      .font("Helvetica")
      .fontSize(8.2)
      .fillColor("#D6DCEC")
      .text(l, xt, yTexto + 16 + i * 11, { width: anchoTexto, lineBreak: false, ellipsis: true }),
  );
  pieDePanel(doc, c, `Emitido el ${FECHA_EMISION.format(new Date())}`);

  // ===== Hoja 2 (y las que hagan falta), adentro =====
  const firma = (a: DatosCarnet["aplicaciones"][number]) =>
    a.registradoPor ? `${a.registradoPor.nombre[0]}. ${a.registradoPor.apellido}${a.registradoPor.matricula ? `\n${a.registradoPor.matricula}` : ""}` : "";
  const vacunas = m.aplicaciones
    .filter((a) => a.tipo === "VACUNA")
    .map((a) => [
      FECHA.format(a.fechaAplicacion),
      a.producto,
      a.lote ?? "",
      firma(a),
      a.fechaProximaDosis ? FECHA.format(a.fechaProximaDosis) : "",
    ]);
  const desparasitaciones = m.aplicaciones
    .filter((a) => a.tipo === "DESPARASITACION")
    .map((a) => [
      FECHA.format(a.fechaAplicacion),
      a.consulta?.pesoKg ? `${Number(a.consulta.pesoKg).toLocaleString("es-AR")} kg` : "",
      a.producto,
      firma(a),
      a.fechaProximaDosis ? FECHA.format(a.fechaProximaDosis) : "",
    ]);

  const ancho = panelIzquierdo.ancho;
  const columnasVacunas: Columna[] = [
    { titulo: "Fecha", ancho: 56, alinear: "center" },
    { titulo: "Vacuna", ancho: ancho - 56 - 64 - 74 - 62 },
    { titulo: "Lote", ancho: 64, alinear: "center" },
    { titulo: "Firma y sello", ancho: 74, alinear: "center" },
    { titulo: "Próxima", ancho: 62, alinear: "center" },
  ];
  const columnasDesp: Columna[] = [
    { titulo: "Fecha", ancho: 56, alinear: "center" },
    { titulo: "Peso", ancho: 44, alinear: "center" },
    { titulo: "Producto", ancho: ancho - 56 - 44 - 74 - 62 },
    { titulo: "Firma y sello", ancho: 74, alinear: "center" },
    { titulo: "Próxima", ancho: 62, alinear: "center" },
  ];

  let restoV = vacunas;
  let restoD = desparasitaciones;
  let hoja = 0;
  do {
    doc.addPage();
    fondoHoja(doc);
    const sigue = hoja > 0 ? " (sigue)" : "";
    const yv = tituloPanel(doc, panelIzquierdo, `Vacunas${sigue}`, panelIzquierdo.y + 4);
    const entranV = tablaLibreta(doc, panelIzquierdo, yv, columnasVacunas, restoV, panelIzquierdo.y + panelIzquierdo.alto - yv - 18);
    const yd = tituloPanel(doc, panelDerecho, `Desparasitaciones${sigue}`, panelDerecho.y + 4);
    const entranD = tablaLibreta(doc, panelDerecho, yd, columnasDesp, restoD, panelDerecho.y + panelDerecho.alto - yd - 18);
    pieDePanel(doc, panelIzquierdo, `${m.nombre} · ${clinica.nombre}`);
    pieDePanel(doc, panelDerecho, "Internas (pastillas, jarabes) y externas (pipetas, collares, comprimidos para pulgas y garrapatas).");
    restoV = restoV.slice(entranV);
    restoD = restoD.slice(entranD);
    hoja++;
  } while (restoV.length > 0 || restoD.length > 0);

  doc.end();
}
