import PDFDocument from "pdfkit";
import type { Clinica } from "@prisma/client";
import { AZUL, encabezadoPdf, GRIS } from "./carnet";

// ---------------------------------------------------------------------------
// Informe de turnos en PDF: la misma tabla que se ve en el panel, con los filtros elegidos
// ---------------------------------------------------------------------------

export interface DatosInforme {
  subtitulo: string; // "Del 16 de noviembre de 2026 al 21 de noviembre de 2026 · Atendidos"
  totales: { texto: string; valor: number }[];
  filas: string[][]; // ya escritas como se ven en pantalla, en el orden de COLUMNAS
}

const COLUMNAS = [
  { titulo: "Fecha", ancho: 62 },
  { titulo: "Hora", ancho: 38 },
  { titulo: "Mascota", ancho: 82 },
  { titulo: "Dueño", ancho: 112 },
  { titulo: "Servicio", ancho: 150 },
  { titulo: "Veterinario", ancho: 110 },
  { titulo: "Estado", ancho: 88 },
  { titulo: "Cómo se pidió", ancho: 128 },
];
export const CANTIDAD_COLUMNAS = COLUMNAS.length;

const MARGEN = 36;
const RELLENO = 5; // espacio dentro de cada celda
const LETRA = 9;

const FECHA_LARGA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

function filaDeTitulos(doc: PDFKit.PDFDocument, y: number) {
  const ancho = doc.page.width - MARGEN * 2;
  doc.rect(MARGEN, y, ancho, 20).fill("#EEF1F7");
  doc.font("Helvetica-Bold").fontSize(LETRA).fillColor(GRIS);
  let x = MARGEN;
  for (const c of COLUMNAS) {
    doc.text(c.titulo, x + RELLENO, y + 6, { width: c.ancho - RELLENO * 2, lineBreak: false });
    x += c.ancho;
  }
  return y + 20;
}

// Escribe el PDF en el stream de salida (por ejemplo, la respuesta HTTP).
export function escribirInforme(datos: DatosInforme, clinica: Clinica, salida: NodeJS.WritableStream) {
  // Apaisado, para que entren las ocho columnas sin apretar el texto.
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: MARGEN, bottom: MARGEN, left: MARGEN, right: MARGEN },
    bufferPages: true,
    info: { Title: "Informe de turnos", Author: clinica.nombre },
  });
  doc.pipe(salida);
  const ancho = doc.page.width - MARGEN * 2;
  const limite = doc.page.height - MARGEN - 18; // deja lugar para el número de página

  let y = encabezadoPdf(doc, clinica) - 8;
  doc.font("Helvetica-Bold").fontSize(18).fillColor(AZUL).text("Informe de turnos", MARGEN, y);
  doc.font("Helvetica").fontSize(10.5).fillColor(GRIS).text(datos.subtitulo, MARGEN, doc.y + 2, { width: ancho });
  y = doc.y + 10;

  // Totales en una línea: "18 turnos · 3 atendidos · ..."
  const totales = datos.totales.map((t) => `${t.valor} ${t.texto.toLowerCase()}`).join("   ·   ");
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(AZUL).text(totales, MARGEN, y, { width: ancho });
  y = doc.y + 12;

  if (datos.filas.length === 0) {
    doc.font("Helvetica").fontSize(11).fillColor(GRIS).text("No hay turnos con estos filtros.", MARGEN, y);
  } else {
    y = filaDeTitulos(doc, y);
    datos.filas.forEach((fila, i) => {
      doc.font("Helvetica").fontSize(LETRA);
      const alto =
        Math.max(...COLUMNAS.map((c, j) => doc.heightOfString(fila[j] ?? "", { width: c.ancho - RELLENO * 2 }))) + RELLENO * 2;
      // Si la fila no entra, sigue en una hoja nueva con los títulos de nuevo.
      if (y + alto > limite) {
        doc.addPage();
        y = filaDeTitulos(doc, MARGEN);
      }
      if (i % 2 === 1) doc.rect(MARGEN, y, ancho, alto).fill("#F7F8FB");
      let x = MARGEN;
      COLUMNAS.forEach((c, j) => {
        // La mascota en negrita, como en la pantalla
        doc
          .font(j === 2 ? "Helvetica-Bold" : "Helvetica")
          .fontSize(LETRA)
          .fillColor("#1C2537")
          .text(fila[j] ?? "", x + RELLENO, y + RELLENO, { width: c.ancho - RELLENO * 2 });
        x += c.ancho;
      });
      y += alto;
      doc.moveTo(MARGEN, y).lineTo(MARGEN + ancho, y).lineWidth(0.5).strokeColor("#E3E6EE").stroke();
    });
  }

  // Al pie de cada hoja: cuándo se generó y el número de página.
  const hojas = doc.bufferedPageRange();
  const generado = `Generado el ${FECHA_LARGA.format(new Date())}`;
  for (let i = 0; i < hojas.count; i++) {
    doc.switchToPage(hojas.start + i);
    doc.page.margins.bottom = 0; // si no, PDFKit cree que el pie no entra y agrega una hoja en blanco
    const yPie = doc.page.height - MARGEN - 8;
    doc.font("Helvetica").fontSize(8.5).fillColor(GRIS);
    doc.text(generado, MARGEN, yPie, { width: ancho / 2, lineBreak: false });
    doc.text(`Página ${i + 1} de ${hojas.count}`, MARGEN + ancho / 2, yPie, {
      width: ancho / 2,
      align: "right",
      lineBreak: false,
    });
  }

  doc.end();
}
