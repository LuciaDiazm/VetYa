// Límite de intentos (contra quien prueba contraseñas una y otra vez, o crea cuentas en cantidad).
// Se cuenta en la memoria del servidor: si el servidor se reinicia, los contadores vuelven a cero.
// Para una clínica alcanza; no hace falta guardar esto en la base de datos.

interface Contador {
  cantidad: number;
  hasta: number; // hasta cuándo vale este contador (milisegundos)
}

const contadores = new Map<string, Contador>();

export const MINUTO = 60 * 1000;

// Cuántos minutos faltan para poder volver a intentar (0 = puede intentar).
export function minutosBloqueado(clave: string, maximo: number): number {
  const c = contadores.get(clave);
  if (!c || c.hasta <= Date.now() || c.cantidad < maximo) return 0;
  return Math.max(1, Math.ceil((c.hasta - Date.now()) / MINUTO));
}

// Suma un intento. La ventana empieza con el primer intento.
export function sumarIntento(clave: string, ventanaMs: number) {
  const ahora = Date.now();
  const c = contadores.get(clave);
  if (!c || c.hasta <= ahora) contadores.set(clave, { cantidad: 1, hasta: ahora + ventanaMs });
  else c.cantidad += 1;
}

// Si entró bien, se olvidan los intentos fallidos.
export function borrarIntentos(clave: string) {
  contadores.delete(clave);
}

// Cada 10 minutos se borran los contadores vencidos, para que la memoria no crezca.
setInterval(() => {
  const ahora = Date.now();
  for (const [clave, c] of contadores) if (c.hasta <= ahora) contadores.delete(clave);
}, 10 * MINUTO).unref();
