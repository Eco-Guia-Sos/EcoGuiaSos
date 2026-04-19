# Guía de Estudio para NotebookLM: EcoGuía SOS

Para que NotebookLM te ayude a entender y programar tu página sin "perderse", te recomiendo cargar **exactamente** estos archivos en este orden. Esto le dará la "visión de arquitecto" que necesitas.

## 📂 Nivel 1: El "Cerebro" (Contexto General)

Carga primero estos archivos de la carpeta `memory/`. Son los más importantes para que NotebookLM sepa _qué_ estamos construyendo:

1.  **`memory/projectBrief.md`**: La misión y objetivos del proyecto.
2.  **`memory/productContext.md`**: El stack técnico y cómo funcionan los roles (Admin/Actor).
3.  **`memory/activeContext.md`**: Lo que estamos haciendo justo ahora.
4.  **`memory/progress.md`**: El mapa de ruta (qué falta por hacer).

## 🗄️ Nivel 2: Los "Cimientos" (Base de Datos)

Carga esto para que entienda cómo se guarda la información:

- **`supabase/migrations/20260322_initial_schema.sql`**: Aquí está la lógica de las tablas, los permisos (RLS) y los triggers. Es la "anatomía" de tu base de datos.

## ⚙️ Nivel 3: El "Motor" (Lógica de Programación)

Si quieres aprender a programar la conexión, carga estos:

- **`assets/js/supabase.js`**: El archivo que conecta tu página con Supabase.
- **`assets/js/pages/admin.js`**: (Opcional) Para ver cómo funcionan los formularios de subida de datos.

---

## 🎯 Consejos para preguntar a NotebookLM:

Una vez cargados, prueba estos "Prompts" para aprender:

- _"Explícame como si fuera un principiante qué hace el archivo initial_schema.sql"_
- _"¿Cómo se relaciona la tabla 'profiles' con la tabla 'organizations'?"_
- _"Si quiero agregar una nueva función en Javascript para clonar un evento, ¿en qué archivo debería basarme y por qué?"_

**Recuerda**: No necesitas copiar y pegar código suelto. Al subir el archivo completo, NotebookLM tiene todo el contexto y te dará respuestas mucho más precisas. ¡Vamos con calma!🦾🚀
