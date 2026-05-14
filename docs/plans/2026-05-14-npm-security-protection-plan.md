# npm Security Protection Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Implementar de forma inmediata defensas contra ataques de cadena de suministro en npm mediante un archivo de configuración segura y lineamientos de equipo.

**Architecture:** Fortificación determinista local basada en `.npmrc` y actualización de políticas canónicas en el repositorio para deshabilitar *lifecycle scripts* automáticos y fijar versiones estáticas.

**Tech Stack:** npm, configuración ini, Markdown

---

### Task 1: Archivo de Configuración Segura Global (`.npmrc`)

**Files:**
- Create: `.npmrc`

**Step 1: Verificar inexistencia actual de `.npmrc`**

Run: `cmd.exe /c "dir .npmrc"`
Expected: File Not Found / No se encuentra el archivo

**Step 2: Escribir la configuración segura en `.npmrc`**

```ini
save-exact=true
ignore-scripts=true
min-release-age=3
```

**Step 3: Verificar que el archivo se creó exitosamente con los valores correctos**

Run: `cmd.exe /c "type .npmrc"`
Expected: Muestra las 3 líneas configuradas correctamente.

**Step 4: Commit**

```bash
git add .npmrc
git commit -m "chore(security): add secure .npmrc configuration to block lifecycle scripts and pin versions"
```

### Task 2: Actualización de Políticas de Seguridad en Dependencias (`PROJECT_RULES.md`)

**Files:**
- Modify: `PROJECT_RULES.md:21-22`

**Step 1: Visualizar el área objetivo en `PROJECT_RULES.md`**

Run: `cmd.exe /c "findstr /n /c:\"Planning Lock\" PROJECT_RULES.md"`
Expected: Muestra la línea de Planning Lock.

**Step 2: Modificar `PROJECT_RULES.md` añadiendo la sección de Seguridad de Dependencias**

```markdown
## Dependency Security Policy

**Mandatory Rule**: Todas las instalaciones de dependencias mediante `npm` deben adherirse a una postura defensiva estricta:
1. **Lifecycle Scripts Deshabilitados**: Por defecto, los scripts de terceros (`preinstall`, `postinstall`) están bloqueados globalmente mediante `.npmrc`.
2. **Dependencias Nativas**: Si un paquete requiere compilación nativa o scripts estrictamente justificados, la instalación y ejecución de scripts debe auditarse de forma manual.
3. **Versiones Exactas**: Prohibido el uso de prefijos de rango (`^`, `~`). Todas las versiones deben ser fijas y deterministas.

---
```

**Step 3: Verificar visualmente los cambios en `PROJECT_RULES.md`**

Run: `git diff PROJECT_RULES.md`
Expected: Muestra la adición exitosa de la sección de seguridad.

**Step 4: Commit**

```bash
git add PROJECT_RULES.md
git commit -m "docs(security): add canonical dependency security policy to PROJECT_RULES.md"
```

### Task 3: Auditoría y Verificación de Seguridad en Dependencias

**Files:**
- Test: `package-lock.json`

**Step 1: Ejecutar auditoría de seguridad del árbol actual**

Run: `npm audit`
Expected: Muestra el reporte de vulnerabilidades conocidas o confirma el estado de seguridad bajo la nueva directiva.

**Step 2: Commit final de verificación**

```bash
git commit --allow-empty -m "chore(security): verify dependency tree security posture via npm audit"
```
