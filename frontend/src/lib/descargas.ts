// Descargas que arma la propia página: planillas para Excel y archivos que manda el servidor.

// Baja un archivo con el nombre dado, sin abrir otra pestaña.
export function descargarArchivo(contenido: Blob, nombre: string) {
  const url = URL.createObjectURL(contenido)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Una celda de la planilla. Va entre comillas si hace falta, y si empieza con = + - @
// se le pone un apóstrofo para que Excel no la tome como fórmula (por ejemplo, un nombre cargado desde la web).
function celda(valor: string | number) {
  let texto = String(valor)
  if (/^[=+\-@]/.test(texto)) texto = `'${texto}`
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

// Planilla para Excel (CSV): separada con punto y coma, que es lo que espera Excel en español,
// y con la marca del comienzo para que respete los acentos.
export function descargarPlanilla(filas: (string | number)[][], nombre: string) {
  const texto = filas.map((fila) => fila.map(celda).join(';')).join('\r\n')
  descargarArchivo(new Blob(['﻿', texto], { type: 'text/csv;charset=utf-8' }), nombre)
}
