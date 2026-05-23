# 🤖 INSTRUCCIONES PARA EL AGENTE (HANDOVER)

**¡Hola, colega agente!** 
Si estás leyendo esto, estás en una nueva ventana/sesión encargada de construir la nueva versión en Vue 3 del proyecto **EcoGuía SOS**. 
El usuario ha decidido migrar de Vanilla JS a una arquitectura SPA moderna, robusta y escalable.

---

## 🎯 EL OBJETIVO
Migrar el proyecto "EcoGuía SOS" (que originalmente estaba en Vanilla JS) a un stack de **Vue 3 + Vite + TypeScript + Pinia**, manteniendo la base de datos de Supabase. El objetivo a largo plazo es reutilizar la lógica de negocio (Servicios TypeScript) en una app móvil con React Native.

## 📜 REGLAS DEL PROYECTO Y OPERACIONES
1. **Nuevo Repositorio:** Este código formará un repositorio completamente nuevo. No toques el código antiguo.
2. **Commits Iterativos:** Haz commits y pushes pequeños y constantes al terminar cada tarea.
3. **Localhost Primero:** Todo debe funcionar perfecto en local antes de publicar.
4. **CSS Global Híbrido:** Por ahora, vamos a mantener y usar los archivos CSS antiguos (`global.css`, `style.css`, etc.) importados globalmente para no romper el diseño visual. Más adelante, los componentes usarán `<style scoped>`.

---

## 🗺️ ROADMAP DE TAREAS

Por favor, sigue estas fases paso a paso con el usuario:

### Fase 1: El Lienzo en Blanco (Setup)
- [ ] Ejecutar `npx create-vue@latest .` (Seleccionar: Vue Router, Pinia, TypeScript. **NO** seleccionar JSX, testing avanzado si no lo pide, ni ESLint estricto por ahora para evitar fricción).
- [ ] Ejecutar `npm install` y añadir las dependencias extra (`@supabase/supabase-js`).
- [ ] Inicializar el repositorio Git y hacer el primer commit "feat: init vue3 project".

### Fase 2: El Esqueleto y el Diseño (Assets)
- [ ] Traer los assets del proyecto viejo (imágenes, CSS global) y ponerlos en `/public` o `/src/assets`.
- [ ] Configurar `src/App.vue` para que cargue los estilos globales y dibuje el cascarón (Navbar / Footer).
- [ ] Commit y Push iterativo.

### Fase 3: La Conexión Inteligente (Supabase y Pinia)
- [ ] Crear `src/services/supabase.service.ts` importando credenciales del `.env`.
- [ ] Crear `src/stores/authStore.ts` con Pinia para manejar la sesión en tiempo real.
- [ ] Commit y Push iterativo.

### Fase 4: Transformación de Pantallas (Vistas)
- [ ] Crear `src/views/HomeView.vue` migrando la lógica de `index.html`.
- [ ] Crear el resto de vistas y conectar el Vue Router.
- [ ] Commit y Push iterativo.

---
**INSTRUCCIÓN INMEDIATA PARA EL AGENTE:**
Al leer esto, saluda al usuario, confirma que has entendido el plan y pregúntale si quieres que lances el comando de la **Fase 1 (`npx create-vue@latest .`)**.
