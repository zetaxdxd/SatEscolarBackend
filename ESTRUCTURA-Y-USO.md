# Guia paso a paso

## 1. Donde colocar cada archivo

La carpeta `backend` debe quedar al mismo nivel que `index.html`, `css`, `js` y `pages`.

```txt
sat-escolar/
  index.html
  css/
  js/
  pages/
  backend/
```

## 2. Para que sirve cada parte

`src/server.js`

Inicia el servidor y crea la base de datos si todavia no existe.

`src/app.js`

Configura Express, CORS, JSON y las rutas principales.

`src/config/database.js`

Abre la conexion con SQLite y crea la tabla `users`.

`src/routes/authRoutes.js`

Define las rutas:

```txt
POST /api/auth/register
POST /api/auth/login
GET /api/auth/users/:role
```

`src/controllers/authController.js`

Contiene la logica de registro, login y listado por rol.

`src/models/userModel.js`

Hace las consultas SQL a la base de datos.

`src/middleware/validateAuth.js`

Valida que los datos enviados por el frontend esten completos.

`src/utils/roles.js`

Centraliza los roles permitidos.

## 3. Comandos

Instalar dependencias:

```bash
cd backend
npm install
```

Configurar variables:

```bash
cp .env.example .env
```

Ejecutar backend:

```bash
npm start
```

Ejecutar en desarrollo:

```bash
npm run dev
```

## 4. Probar registro con Postman, Insomnia o Thunder Client

Metodo:

```txt
POST
```

URL:

```txt
http://localhost:3000/api/auth/register
```

Body JSON:

```json
{
  "fullName": "Ana Torres",
  "email": "ana@colegio.edu.pe",
  "username": "anatorres",
  "password": "123456",
  "role": "estudiante"
}
```

## 5. Probar login

Metodo:

```txt
POST
```

URL:

```txt
http://localhost:3000/api/auth/login
```

Body JSON:

```json
{
  "identifier": "anatorres",
  "password": "123456"
}
```

## 6. Conectar con el frontend actual

El archivo de ejemplo esta en:

```txt
backend/examples/frontend-auth.js
```

Ese archivo contiene dos funciones:

```txt
registrarUsuarioBackend()
iniciarSesionBackend()
```

Puedes usar `iniciarSesionBackend()` en el boton del login para reemplazar el login demo que actualmente usa usuarios fijos.
