import crypto from "node:crypto";
import PDFDocument from "pdfkit";
import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// Carnet de vacunación en PDF
// ---------------------------------------------------------------------------

const AZUL = "#1C2D63";
const AMARILLO = "#F6C343";
const GRIS = "#57627A";
const BORDE = "#E6DCCD";

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

// Huella con cruz (el logo de VetYa) dibujada con figuras, para no depender de archivos de imagen.
function dibujarLogo(doc: PDFKit.PDFDocument, x: number, y: number, tamano: number) {
  const e = tamano / 40;
  doc.roundedRect(x, y, 40 * e, 40 * e, 11 * e).fill(AZUL);
  doc.fillColor(AMARILLO);
  for (const [cx, cy] of [[11, 15], [17.3, 10], [22.7, 10], [29, 15]]) {
    doc.ellipse(x + cx * e, y + cy * e, 3.4 * e, 4.2 * e).fill();
  }
  doc.roundedRect(x + 16.5 * e, y + 17 * e, 7 * e, 17 * e, 2.6 * e).fill();
  doc.roundedRect(x + 11.5 * e, y + 22 * e, 17 * e, 7 * e, 2.6 * e).fill();
}

function tabla(
  doc: PDFKit.PDFDocument,
  titulo: string,
  filas: string[][],
  columnas: { titulo: string; ancho: number }[],
) {
  const x0 = doc.page.margins.left;
  doc.moveDown(1.2);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(AZUL).text(titulo, x0);
  doc.moveDown(0.4);

  if (filas.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor(GRIS).text("Sin registros.", x0);
    return;
  }

  const alto = 22;
  const dibujarFila = (celdas: string[], encabezado: boolean) => {
    // Si no entra en la página, se continúa en otra.
    if (doc.y + alto > doc.page.height - doc.page.margins.bottom - 30) doc.addPage();
    const y = doc.y;
    if (encabezado) doc.rect(x0, y, columnas.reduce((t, c) => t + c.ancho, 0), alto).fill("#F8F3EB");
    let x = x0;
    celdas.forEach((texto, i) => {
      doc
        .font(encabezado ? "Helvetica-Bold" : "Helvetica")
        .fontSize(encabezado ? 9 : 10)
        .fillColor(encabezado ? GRIS : "#1C2537")
        .text(texto, x + 6, y + 6, { width: columnas[i].ancho - 12, height: alto - 6, ellipsis: true, lineBreak: false });
      x += columnas[i].ancho;
    });
    doc
      .moveTo(x0, y + alto)
      .lineTo(x, y + alto)
      .strokeColor(BORDE)
      .lineWidth(1)
      .stroke();
    doc.x = x0;
    doc.y = y + alto;
  };

  dibujarFila(
    columnas.map((c) => c.titulo),
    true,
  );
  filas.forEach((f) => dibujarFila(f, false));
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

  // ---------- Encabezado ----------
  dibujarLogo(doc, 48, 44, 44);
  doc.font("Helvetica-Bold").fontSize(18).fillColor(AZUL).text(clinica.nombre, 104, 46);
  doc.font("Helvetica").fontSize(10).fillColor(GRIS).text(`${clinica.direccion}  -  Tel. ${clinica.telefono}`, 104, 70);
  doc.rect(48, 104, ancho, 3).fill(AMARILLO);

  doc.font("Helvetica-Bold").fontSize(22).fillColor(AZUL).text("Carnet de vacunación", 48, 124);

  // ---------- Datos de la mascota ----------
  const especie = { PERRO: "Perro", GATO: "Gato", OTRO: "Otro" }[m.especie];
  const datos: [string, string][] = [
    ["Nombre", m.nombre],
    ["Especie", especie],
    ["Sexo", m.sexo === "HEMBRA" ? "Hembra" : "Macho"],
    ["Raza", m.raza ?? "-"],
    ["Color", m.color ?? "-"],
    ["Nacimiento", m.fechaNacimiento ? FECHA.format(m.fechaNacimiento) : "-"],
    ["Castración", m.castrado ? "Sí" : "No"],
    ["Dueño/a", `${m.cliente.nombre} ${m.cliente.apellido}`],
  ];
  const yDatos = 166;
  doc.roundedRect(48, yDatos, ancho, 104, 10).lineWidth(1).strokeColor(BORDE).stroke();
  datos.forEach(([etiqueta, valor], i) => {
    const columna = i % 2;
    const fila = Math.floor(i / 2);
    const x = 64 + columna * (ancho / 2);
    const y = yDatos + 12 + fila * 22;
    doc.font("Helvetica").fontSize(9).fillColor(GRIS).text(etiqueta, x, y, { width: 80 });
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#1C2537")
      .text(valor, x + 80, y - 1, { width: ancho / 2 - 100, lineBreak: false, ellipsis: true });
  });
  doc.x = 48;
  doc.y = yDatos + 104;

  // ---------- Tablas ----------
  const columnas = [
    { titulo: "FECHA", ancho: 80 },
    { titulo: "PRODUCTO", ancho: ancho - 80 - 90 - 100 },
    { titulo: "LOTE", ancho: 90 },
    { titulo: "PRÓXIMA DOSIS", ancho: 100 },
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

  tabla(doc, "Vacunas", filasDe("VACUNA"), columnas);
  tabla(doc, "Desparasitaciones", filasDe("DESPARASITACION"), columnas);

  // ---------- Pie ----------
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(GRIS)
    .text(
      `Emitido el ${FECHA_EMISION.format(new Date())} por ${clinica.nombre}. Te avisamos por WhatsApp antes de cada refuerzo.`,
      48,
      doc.page.height - 70,
      { width: ancho, align: "center" },
    );

  doc.end();
}
