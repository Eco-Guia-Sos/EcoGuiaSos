# Diseño de Protección y Seguridad de Dependencias (npm / pnpm)

**Fecha:** 2026-05-14  
**Objetivo:** Establecer una postura robusta de defensa contra ataques de cadena de suministro (supply chain attacks) y la ejecución no autorizada de código malicioso a través de *lifecycle scripts* en las dependencias del proyecto.

---

## 1. Contexto y Justificación Arquitectónica

El uso de `npm install` conlleva el riesgo inherente de ejecutar secuencias de comandos arbitrarias (`preinstall`, `postinstall`) definidas por paquetes de terceros. Para un proyecto web moderno que maneja integraciones clave (como Vite, Supabase y despliegues a Cloudflare mediante Wrangler), es imperativo mitigar estos vectores de ataque sin introducir fricción excesiva que deteriore la velocidad de desarrollo.

Se ha optado por un **enfoque de defensa en profundidad dividido en dos fases** (Opción C), garantizando protección inmediata de forma transparente y estableciendo una ruta de evolución hacia gestores de paquetes nativamente más restrictivos.

---

## 2. Fase 1: Protección Inmediata (Ahorita)

La primera fase se centra en cerrar los vectores de ataque automáticos en la configuración actual basada en `npm`.

### 2.1. Bloqueo Global de Scripts y Fijación de Versiones (`.npmrc`)
Se creará un archivo `.npmrc` en la raíz del proyecto para forzar políticas de seguridad deterministas en cualquier entorno local que instale dependencias:
* `ignore-scripts=true`: Deshabilita la ejecución automática de comandos definidos en los paquetes durante `npm install`.
* `save-exact=true`: Garantiza que las nuevas dependencias se instalen con versiones estáticas exactas, evitando rangos con prefijos `^` o `~` que propicien actualizaciones sorpresivas.

### 2.2. Auditoría y Verificación del Estado de Dependencias
* Ejecución periódica o bajo demanda de `npm audit` para visibilizar vulnerabilidades conocidas en el árbol actual de `package-lock.json`.

### 2.3. Guardarraíles y Normativas para el Equipo
* Se establecerá en las reglas del proyecto (`PROJECT_RULES.md` o documentación interna) el procedimiento para dependencias nativas que estrictamente requieran compilación o scripts posteriores, prefiriendo la ejecución manual controlada o la revisión del paquete previo a su autorización.

---

## 3. Fase 2: Estrategia de Evolución (Futuro)

Para consolidar la seguridad estructural del repositorio a largo plazo, se planifica la transición hacia herramientas con mejores primitivas de aislamiento.

### 3.1. Migración a pnpm
* Reemplazo completo de `npm` por `pnpm`, aprovechando su arquitectura basada en enlaces duros (hard links) y su resolución estricta que previene las dependencias fantasma (phantom dependencies).
* Adopción de sus políticas de seguridad nativas, tales como `pnpm.onlyBuiltDependencies` para elaborar una lista blanca explícita de paquetes autorizados a ejecutar comandos de construcción.

### 3.2. Automatización Segura en CI/CD
* En caso de incorporar flujos automatizados de construcción o validación (ej. GitHub Actions), asegurar el uso exclusivo de comandos inmutables como `npm ci --ignore-scripts` o la configuración equivalente de `pnpm install --frozen-lockfile`.

---

## 4. Consideraciones de Pruebas y Verificación

* **Verificación de la Fase 1:** Comprobar que al instalar un paquete de prueba con scripts definidos, la terminal omita su ejecución silenciosa y respete las directivas del archivo `.npmrc`.
* **Verificación de Construcción:** Asegurar que los comandos clave del flujo de trabajo (`npm run build`, `npm run dev`) continúen operando exitosamente con los *lifecycle scripts* globales deshabilitados.
