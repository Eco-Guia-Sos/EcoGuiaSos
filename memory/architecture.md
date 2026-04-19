# 🏗️ Architecture: EcoGuía SOS

## System Overview
EcoGuía SOS es una Single Page Application (SPA) modular diseñada para la gestión de comunidades ecológicas. Utiliza una arquitectura desacoplada donde el frontend (Vite/Vanilla JS) se comunica con Supabase para la persistencia.

## Core Components
- **Frontend**: Vanilla HTML/JS/CSS servido mediante Vite.
- **Backend-as-a-Service**: Supabase (PostgreSQL, Auth, Storage, Edge Functions).
- **Design System**: Estilos orgánicos biofílicos con Bento Grid.

## Technical Decisions & SOLID Principles
- **Modularity (Single Responsibility)**: Los componentes de UI y la lógica de base de datos se separan rigurosamente. `app.js` no debe gestionar consultas a la DB; eso pertenece a módulos dedicados como `auth.js` o `db.js`.
- **Open/Closed**: Utilizamos variables CSS globales (`assets/css/globals.css`) para alterar temas sin reescribir clases de UI (Bento Grid).
- **Dependency Injection**: Los módulos de JS reciben la instancia de cliente de `supabase` como parámetro, en lugar de invocarla globalmente, permitiendo tests fáciles en el futuro.
- **Security**: Implementación de Row Level Security (RLS) en Supabase para proteger datos por roles.

## Scalability Strategy
1. **Frontend (Vercel/Vite)**: Servido a través de un Edge CDN. La carga es instantánea y escala globalmente de facto.
2. **Backend (Supabase/PostgreSQL)**: Arquitectura *Backend-as-a-Service*. Escala verticalmente y maneja su propio *connection pooling*. Cuando superemos miles de usuarios, Supabase nos permite instanciar réplicas de lectura.
3. **Estado de Código**: Al mantenernos en Vanilla JS, evitamos el peso de librerías enormes, pero requiere disciplina (metodología GSD) para no convertir el código en "Spaghetti".

## Implementation Paths
- `/index.html`: Punto de entrada principal.
- `/supabase/`: Scripts de migración y configuración.
- `/assets/`: Recursos estáticos y estilos globales.
- `/memory/`: El "Cerebro" del proyecto (Memory Bank).
