# SAT Escolar — Backend v2

## Instalación

```bash
cd backend
npm install
cp .env.example .env     # editar si es necesario
node src/seed.js         # crear usuarios iniciales
npm run dev              # modo desarrollo (nodemon)
# o
npm start                # producción
```

El servidor arranca en **http://localhost:3000**

## Usuarios iniciales (seed)

| Usuario     | Contraseña | Rol        |
|-------------|------------|------------|
| docente     | 123        | docente    |
| psicologa   | 123        | psicologo  |
| estudiante  | 123        | estudiante |

## Endpoints principales

### Auth
- `POST /api/auth/login`       — `{ username, password }` → `{ token, role, fullName, id }`
- `POST /api/auth/register`    — `{ fullName, email, username, password, role }`

### Estudiantes
- `GET  /api/estudiantes`              — listar estudiantes (con nivel de riesgo)
- `POST /api/estudiantes`              — registrar estudiante `{ nombre, grado, seccion }`
- `DELETE /api/estudiantes/:id`        — eliminar

### Registros docente
- `POST /api/estudiantes/registro`     — `{ estudianteId, evaluacion, asistencia, nota, conducta, observacion }`
- `GET  /api/estudiantes/:id/registros`— historial de registros

### Formularios socioemocionales
- `POST /api/estudiantes/formulario/activar`     — `{ grado, seccion }`
- `POST /api/estudiantes/formulario/desactivar`  — `{ grado, seccion }`
- `GET  /api/estudiantes/formulario/activo?grado=&seccion=`
- `POST /api/estudiantes/formulario/respuesta`   — `{ formularioId, estudianteId, pregunta1..5 }`
- `GET  /api/estudiantes/formulario/respuestas?grado=&seccion=`

### Incidentes
- `POST /api/estudiantes/incidente`       — `{ descripcion, fotoBase64? }`
- `GET  /api/estudiantes/incidentes`      — listar todos
- `GET  /api/estudiantes/incidentes?nuevos=1` — solo no leídos
- `POST /api/estudiantes/incidentes/leer` — marcar leídos

### Evaluación de riesgo
- `GET  /api/estudiantes/:id/evaluacion`  — resultado del motor SAT
- `POST /api/estudiantes/:id/recalcular`  — forzar recálculo

### Seguimiento
- `POST /api/estudiantes/seguimiento`         — `{ estudianteId, estadoNuevo, accion, notas }`
- `GET  /api/estudiantes/:id/seguimiento`     — historial de intervenciones

## Motor de Análisis de Riesgo

El motor (`src/utils/motorRiesgo.js`) evalúa 4 dimensiones con estos pesos:

| Dimensión       | Peso | Criterio principal                        |
|-----------------|------|-------------------------------------------|
| Académico       | 30%  | Promedio de notas (escala 0–20)           |
| Asistencia      | 30%  | % de faltas + faltas consecutivas         |
| Conductual      | 20%  | Frecuencia de conductas Mala/Regular      |
| Socioemocional  | 20%  | Análisis de texto + incidentes reportados |

### Niveles de riesgo (puntaje 0–100)
- **Excelente** (0–19)   → 🟢
- **Bien** (20–39)       → 🟢
- **Regular** (40–59)    → 🟡
- **En riesgo** (60–79)  → 🟠
- **Alto riesgo** (80+)  → 🔴

El puntaje se recalcula automáticamente cada vez que se guarda un registro, una respuesta de formulario, o un incidente.
