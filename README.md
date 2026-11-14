# VetYa

Plataforma web de gestión y comunicación para una clínica veterinaria de Goya, Corrientes.
Trabajo Final Integrador — Tecnicatura Universitaria en Programación (UTN FRRe, Extensión Áulica Goya).

> La clínica, las personas y los datos que aparecen son ficticios.

## Qué hace

- **Sitio público:** servicios, equipo, preguntas frecuentes, contacto con mapa, urgencias, pedir turno online y adopción.
- **Cuenta del dueño:** sus mascotas, vacunas, visitas y próximos turnos.
- **Panel de la clínica:** turnos del día, agenda, clientes y mascotas, historia clínica, recordatorios por WhatsApp, carnet de vacunas en PDF, adopciones, configuración, estadísticas e informe de turnos entre dos fechas.

## Estructura

```
VetYa/
├── backend/    API REST (Node.js + Express + TypeScript + Prisma)
├── frontend/   Aplicación web (React + TypeScript + Vite)
└── docs/       Documentación del proyecto
```

## Documentación

- [Ficha del proyecto](docs/00-ficha-proyecto.md)
- [Modelo de datos (DER)](docs/01-modelo-de-datos.md)

## Forma rápida (Windows)

1. Instalá **Node.js** (versión LTS, de nodejs.org), **MySQL 8** (anotá la contraseña que elijas) y **Git** (de git-scm.com).
2. Doble clic en **`instalar.bat`**: te pide la contraseña de MySQL y deja todo listo (configuración, dependencias, base de datos y datos de ejemplo). Se puede repetir sin problema: no borra nada.
3. Doble clic en **`iniciar.bat`**: abre el sistema en el navegador (http://localhost:5173). Se abren dos ventanas negras: no las cierres mientras lo uses.

Los usuarios de prueba están en el encabezado de `backend/prisma/seed.ts`.

## Forma manual

### Requisitos

- Node.js 20 o superior
- MySQL 8

## Cómo correrlo en tu compu

### 1. Base de datos

Creá el archivo `backend/.env` copiando `backend/.env.example`, y poné tu usuario y contraseña de MySQL en `DATABASE_URL`.

Después, desde la carpeta `backend`:

```bash
npm install
npm run db:migrate
npm run db:seed
```

- `db:migrate` crea la base `vetya` y todas sus tablas.
- `db:seed` carga datos de prueba: una clínica, servicios, horarios, preguntas frecuentes y usuarios de prueba (ver `backend/prisma/seed.ts`).

### 2. Backend

Desde `backend`:

```bash
npm run dev
```

La API queda en http://localhost:3000. Para probar: http://localhost:3000/api/salud

### 3. Frontend

En otra terminal, desde `frontend`:

```bash
npm install
npm run dev
```

La web queda en http://localhost:5173.

## Comandos útiles (backend)

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta la API y la reinicia al guardar cambios |
| `npm run db:migrate` | Aplica cambios del esquema a la base de datos |
| `npm run db:seed` | Carga los datos de prueba |
| `npm run db:studio` | Abre Prisma Studio para ver y editar los datos desde el navegador |
| `npm run build` | Compila para producción |
