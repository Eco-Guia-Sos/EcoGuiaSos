# EcoGuía SOS: Active Skills Registry

Este archivo documenta las "superpoderes" y metodologías (skills) que estamos utilizando para construir la plataforma. Esto asegura que la lógica sea consistente y de alta calidad.

## 🏗️ Core Architecture & Management
*   **Skill**: `antigravity-memory-bank` (by feodus)
    *   **Uso**: Implementación de la carpeta `memory/` para mantener el contexto vivo y portátil. Permite que el proyecto tenga su propia "memoria corporativa" legible por humanos y IAs.
*   **Skill**: `context-driven-development` (built-in)
    *   **Uso**: Desarrollo basado en la tríada `product.md`, `tech-stack.md` y `workflow.md` (mapeados a nuestra carpeta `memory/`).

## 🎨 UI/UX & Aesthetics
*   **Skill**: `ui-ux-pro-max` (by nextlevelbuilder)
    *   **Uso**: Aplicación del estilo **Biophilic Organic** y **Bento Grid**. Guía la creación de interfaces premium, animaciones sutiles y diseño mobile-first.
*   **Skill**: `frontend-design` (built-in)
    *   **Uso**: Estándares de calidad visual y cohesión estética.

## 🗄️ Backend & Logic
*   **Skill**: `sql-pro` / `postgresql-table-design` (built-in)
    *   **Uso**: Diseño del esquema relacional en Supabase, optimización de queries y políticas RLS.
*   **Skill**: `auth-implementation-patterns` (built-in)
    *   **Uso**: Implementación segura de roles (Admin/Actor/User) mediante Supabase Auth.

## 🗂️ Workflow & Execution
*   **Skill**: `get-shit-done` methodology (via `.gsd/` folder)
    *   **Status**: ✅ **Initialized** local template.
    *   **Uso**: Reglas estrictas de desarrollo atómico (SPEC, PLAN, WAVE) para asegurar que la generación de código sea consistente sin pérdida de contexto.

## 📝 Knowledge Management & Sync
*   **Skill**: `obsidian-bases`, `obsidian-markdown`, `obsidian-cli` (Agregadas globalmente)
    *   **Status**: ✅ **Conectado**. Se creó un Junction / Enlace Simbólico en `memory/ObsidianVault` hacia `E:\obsidian ecoguiasos\EcoGuiaSos`.
    *   **Uso**: Sincronización de decisiones arquitectónicas y estado del proyecto directamente en Obsidian.
*   **Herramienta**: **NotebookLM**
    *   **Uso**: Entorno de aprendizaje y consulta profunda para el usuario basado en los archivos del Memory Bank.

---
*Última actualización: 2026-04-02*
