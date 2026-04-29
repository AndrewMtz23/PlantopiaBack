# Plantopia Backend API

Backend de Plantopia para la version **PostgreSQL + Prisma**. Esta rama (`PlantopiaWithPostgreSQL`) conserva la migracion desde la version original con MySQL y centraliza el acceso a datos mediante Prisma Client.

## Stack

- Node.js
- Express
- PostgreSQL
- Prisma ORM
- JWT
- bcryptjs
- Multer para carga de imagenes

## Variables De Entorno

Crea un archivo `.env` en la raiz del backend usando `.env.example` como base:

```env
PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=8h

# Solo para scripts legacy/migracion desde MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=replace-with-your-password
DB_NAME=server
DB_PORT=3306
DB_CONNECTION_LIMIT=10

PUBLIC_PATH=
UPLOADS_PATH=
```

Notas:

- `DATABASE_URL` es obligatoria para Prisma/PostgreSQL.
- `JWT_SECRET` es obligatorio. El servidor no usa un secreto hardcodeado.
- Las variables `DB_*` solo son necesarias si ejecutas scripts legacy de MySQL o migracion.
- `PUBLIC_PATH` y `UPLOADS_PATH` son opcionales; si no se configuran, se usan las carpetas locales del proyecto.

## Instalacion Local

```bash
npm install
npx prisma generate
npx prisma db push
npm start
```

Para desarrollo puedes usar:

```bash
npm run dev
```

Si `nodemon` falla en Windows por permisos, ejecuta temporalmente:

```bash
node index.js
```

## Base De Datos

Esta version usa PostgreSQL como base principal. Prisma toma el esquema desde:

```text
prisma/schema.prisma
```

El archivo `BD/server.sql` queda como referencia historica de la version MySQL.

## Rama

- `main`: version original.
- `PlantopiaWithPostgreSQL`: version migrada a PostgreSQL + Prisma.
