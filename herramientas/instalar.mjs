// Prepara VetYa en una computadora nueva: crea la configuración, instala lo necesario,
// arma la base de datos y carga los datos de ejemplo. Se ejecuta con instalar.bat.
// Se puede correr más de una vez sin problema: no borra nada.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(raiz, "backend");
const frontend = path.join(raiz, "frontend");
const archivoEnv = path.join(backend, ".env");

function titulo(texto) {
  console.log(`\n=== ${texto} ===`);
}

function fallar(texto) {
  console.log(`\nNO SE PUDO TERMINAR: ${texto}`);
  process.exit(1);
}

// Corre un comando mostrando lo que va pasando. Devuelve true si salió bien.
function correr(comando, carpeta) {
  const r = spawnSync(comando, { cwd: carpeta, shell: true, stdio: "inherit" });
  return r.status === 0;
}

// 1. Node.js
titulo("1 de 5 · Revisando Node.js");
const version = Number(process.versions.node.split(".")[0]);
if (version < 20) fallar(`tenés Node.js ${process.versions.node} y se necesita la versión 20 o más nueva. Instalá la versión LTS desde nodejs.org.`);
console.log(`Node.js ${process.versions.node}: OK`);

// 2. Configuración (backend/.env)
titulo("2 de 5 · Configuración");
if (fs.existsSync(archivoEnv)) {
  console.log("Ya existe backend/.env: se deja como está.");
} else {
  // Se leen las respuestas renglón por renglón (así no se pierde ninguna aunque lleguen juntas).
  const rl = readline.createInterface({ input: process.stdin });
  const renglones = rl[Symbol.asyncIterator]();
  const preguntar = async (texto) => {
    process.stdout.write(texto);
    const { value } = await renglones.next();
    return value ?? "";
  };
  console.log("Necesito los datos de MySQL que elegiste al instalarlo.");
  const usuario = (await preguntar("Usuario de MySQL (si no sabés, apretá Enter para usar root): ")).trim() || "root";
  const clave = await preguntar("Contraseña de MySQL (se va a ver mientras la escribís): ");
  rl.close();
  const url = `mysql://${encodeURIComponent(usuario)}:${encodeURIComponent(clave)}@localhost:3306/vetya`;
  fs.writeFileSync(
    archivoEnv,
    [
      "# Creado por instalar.bat. Si cambiás la contraseña de MySQL, cambiala también acá.",
      `DATABASE_URL="${url}"`,
      `JWT_SECRET="${crypto.randomBytes(32).toString("hex")}"`,
      "PORT=3000",
      'FRONTEND_URL="http://localhost:5173"',
      "",
    ].join("\n"),
  );
  console.log("Listo: se creó backend/.env");
}

// 3. Dependencias
titulo("3 de 5 · Instalando lo necesario (puede tardar unos minutos la primera vez)");
if (!correr("npm install", backend)) fallar("no se pudo instalar el backend. Revisá que haya internet y volvé a abrir instalar.bat.");
if (!correr("npm install", frontend)) fallar("no se pudo instalar el frontend. Revisá que haya internet y volvé a abrir instalar.bat.");

// 4. Base de datos
titulo("4 de 5 · Armando la base de datos");
if (!correr("npx prisma migrate deploy", backend)) {
  fallar(
    "no se pudo conectar con MySQL. Revisá que MySQL esté instalado y encendido, y que la contraseña sea la correcta. " +
      "Si te equivocaste de contraseña, borrá el archivo backend/.env y volvé a abrir instalar.bat.",
  );
}
if (!correr("npx prisma generate", backend)) {
  fallar("no se pudo preparar el acceso a la base. Si VetYa está abierto, cerralo (las ventanas negras) y volvé a abrir instalar.bat.");
}

// 5. Datos de ejemplo
titulo("5 de 5 · Cargando los datos de ejemplo");
if (!correr("npx tsx prisma/seed.ts", backend)) fallar("no se pudieron cargar los datos de ejemplo.");

console.log("\n¡VetYa quedó instalado! Para abrirlo, hacé doble clic en iniciar.bat");
