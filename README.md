# VetYa

Plataforma web de gestión y comunicación para una clínica veterinaria de Goya, Corrientes.
Trabajo Final Integrador.

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

## Requisitos

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
