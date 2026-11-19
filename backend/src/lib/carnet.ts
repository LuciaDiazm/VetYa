import crypto from "node:crypto";
import path from "node:path";
import PDFDocument from "pdfkit";
import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// Carnet de vacunación en PDF
// ---------------------------------------------------------------------------

export const AZUL = "#1C2D63";
export const AMARILLO = "#F6C343";
export const GRIS = "#57627A";
const TINTA = "#1C2537";
const BORDE = "#E6DCCD";
const CREMA = "#F8F3EB";
const CELESTE = "#EAF4FC";

// El logo de VetYa (el perro y el gato), el mismo dibujo de la web: en blanco para la franja azul
// y en azul para la marca de agua.
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
      aplicaciones: { orderBy: { fechaAplicacion: "asc" } },
    },
  });
}

type DatosCarnet = NonNullable<Awaited<ReturnType<typeof datosDelCarnet>>>;

type Clinica = { nombre: string; direccion: string; telefono: string };

// Encabezado de los PDF de la clínica: franja azul de lado a lado con el logo y "VetYa" en blanco,
// los datos de la clínica a la derecha y una línea amarilla abajo. Devuelve dónde sigue el contenido.
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

// Marca de agua: el logo grande y muy suave en la esquina de abajo.
function marcaDeAgua(doc: PDFKit.PDFDocument) {
  const ancho = 300;
  doc.save();
  doc.opacity(0.05);
  doc.image(LOGO_AZUL, doc.page.width - ancho - 20, doc.page.height - ancho * PROPORCION_LOGO - 70, { width: ancho });
  doc.restore();
}

// Título de sección con una rayita amarilla a la izquierda.
function tituloSeccion(doc: PDFKit.PDFDocument, texto: string) {
  const x0 = doc.page.margins.left;
  if (doc.y + 70 > doc.page.height - doc.page.margins.bottom - 40) doc.addPage();
  const y = doc.y;
  doc.roundedRect(x0, y + 1, 5, 17, 2.5).fill(AMARILLO);
  doc.font("Helvetica-Bold").fontSize(15).fillColor(AZUL).text(texto, x0 + 14, y, { lineBreak: false });
  doc.x = x0;
  doc.y = y + 28;
}

function tabla(
  doc: PDFKit.PDFDocument,
  titulo: string,
  vacio: string,
  filas: string[][],
  columnas: { titulo: string; ancho: number }[],
) {
  const x0 = doc.page.margins.left;
  const anchoTotal = columnas.reduce((t, c) => t + c.ancho, 0);
  doc.moveDown(1.4);
  tituloSeccion(doc, titulo);

  if (filas.length === 0) {
    const y = doc.y;
    doc.roundedRect(x0, y, anchoTotal, 34, 8).fill(CREMA);
    doc.font("Helvetica").fontSize(10.5).fillColor(GRIS).text(vacio, x0 + 14, y + 11, { lineBreak: false });
    doc.x = x0;
    doc.y = y + 34;
    return;
  }

  const alto = 26;
  const dibujarFila = (celdas: string[], tipo: "encabezado" | "par" | "impar") => {
    // Si no entra en la página, se continúa en otra.
    if (doc.y + alto > doc.page.height - doc.page.margins.bottom - 40) doc.addPage();
    const y = doc.y;
    if (tipo === "encabezado") doc.roundedRect(x0, y, anchoTotal, alto, 7).fill(AZUL);
    else if (tipo === "par") doc.rect(x0, y, anchoTotal, alto).fill(CREMA);
    let x = x0;
    celdas.forEach((texto, i) => {
      const ultima = i === celdas.length - 1;
      doc
        .font(tipo === "encabezado" || ultima ? "Helvetica-Bold" : "Helvetica")
        .fontSize(tipo === "encabezado" ? 8.5 : 10.5)
        .fillColor(tipo === "encabezado" ? "#FFFFFF" : ultima ? AZUL : TINTA)
        .text(texto, x + 10, y + (tipo === "encabezado" ? 9 : 8), {
          width: columnas[i].ancho - 20,
          height: alto - 6,
          ellipsis: true,
          lineBreak: false,
          characterSpacing: tipo === "encabezado" ? 0.6 : 0,
        });
      x += columnas[i].ancho;
    });
    doc.x = x0;
    doc.y = y + alto;
  };

  dibujarFila(
    columnas.map((c) => c.titulo),
    "encabezado",
  );
  filas.forEach((f, i) => dibujarFila(f, i % 2 === 1 ? "par" : "impar"));
  // Línea fina al final de la tabla
  doc.moveTo(x0, doc.y).lineTo(x0 + anchoTotal, doc.y).strokeColor(BORDE).lineWidth(1).stroke();
}

// Escribe el PDF del carnet en el stream de salida (por ejemplo, la respuesta HTTP).
export function escribirCarnet(m: DatosCarnet, salida: NodeJS.WritableStream) {
  const clinica = m.cliente.clinica;
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
    info: { Title: `Carnet de vacunación de ${m.nombre}`, Author: clinica.nombre },
  });
  doc.pipe(salida);
  const ancho = doc.page.width - 96;

  // ---------- Encabezado y marca de agua ----------
  marcaDeAgua(doc);
  const yTitulo = encabezadoPdf(doc, clinica);

  doc.font("Helvetica-Bold").fontSize(24).fillColor(AZUL).text("Carnet de vacunación", 48, yTitulo);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(GRIS)
    .text(`Emitido el ${FECHA_EMISION.format(new Date())}`, 48, yTitulo + 6, { width: ancho, align: "right" });

  // ---------- Tarjeta celeste con los datos de la mascota ----------
  const especie = m.especie === "OTRO" ? m.otraEspecie || "Otra especie" : { PERRO: "Perro", GATO: "Gato" }[m.especie];
  const sexo = m.sexo === "HEMBRA" ? "Hembra" : "Macho";
  const yTarjeta = yTitulo + 44;
  const altoTarjeta = 128;
  doc.roundedRect(48, yTarjeta, ancho, altoTarjeta, 14).fill(CELESTE);

  // Nombre bien grande, con la especie y el sexo al lado
  doc.font("Helvetica-Bold").fontSize(22).fillColor(AZUL).text(m.nombre, 68, yTarjeta + 18, { lineBreak: false });
  const anchoNombre = doc.widthOfString(m.nombre);
  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor(GRIS)
    .text(`${especie} · ${sexo}`, 68 + anchoNombre + 12, yTarjeta + 26, { lineBreak: false });

  // Los demás datos en tres columnas
  const datos: [string, string][] = [
    ["RAZA", m.raza ?? "-"],
    ["COLOR", m.color ?? "-"],
    ["NACIMIENTO", m.fechaNacimiento ? FECHA.format(m.fechaNacimiento) : "-"],
    ["CASTRACIÓN", m.castrado ? "Sí" : "No"],
    ["DUEÑO/A", `${m.cliente.nombre} ${m.cliente.apellido}`],
  ];
  const anchoColumna = (ancho - 40) / 3;
  datos.forEach(([etiqueta, valor], i) => {
    const x = 68 + (i % 3) * anchoColumna;
    const y = yTarjeta + 58 + Math.floor(i / 3) * 34;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(GRIS).text(etiqueta, x, y, { characterSpacing: 0.6, lineBreak: false });
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(TINTA)
      .text(valor, x, y + 11, { width: anchoColumna - 12, lineBreak: false, ellipsis: true });
  });
  doc.x = 48;
  doc.y = yTarjeta + altoTarjeta;

  // ---------- Tablas ----------
  const columnas = [
    { titulo: "FECHA", ancho: 84 },
    { titulo: "PRODUCTO", ancho: ancho - 84 - 90 - 110 },
    { titulo: "LOTE", ancho: 90 },
    { titulo: "PRÓXIMA DOSIS", ancho: 110 },
  ];
  const filasDe = (tipo: "VACUNA" | "DESPARASITACION") =>
    m.aplicaciones
      .filter((a) => a.tipo === tipo)
      .map((a) => [
        FECHA.format(a.fechaAplicacion),
        a.producto,
        a.lote ?? "-",
        a.fechaProximaDosis ? FECHA.format(a.fechaProximaDosis) : "-",
      ]);

  tabla(doc, "Vacunas", "Todavía no tiene vacunas registradas.", filasDe("VACUNA"), columnas);
  tabla(doc, "Desparasitaciones", "Todavía no tiene desparasitaciones registradas.", filasDe("DESPARASITACION"), columnas);

  // ---------- Pie: aviso de WhatsApp en una franja crema ----------
  const yPie = doc.page.height - 92;
  if (doc.y > yPie - 16) doc.addPage();
  doc.roundedRect(48, yPie, ancho, 40, 10).fill(CREMA);
  doc
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .fillColor(AZUL)
    .text("Te avisamos por WhatsApp antes de cada refuerzo.", 48, yPie + 9, { width: ancho, align: "center" });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(GRIS)
    .text(`${clinica.nombre} · ${clinica.direccion} · Tel. ${clinica.telefono}`, 48, yPie + 23, { width: ancho, align: "center" });

  doc.end();
}
