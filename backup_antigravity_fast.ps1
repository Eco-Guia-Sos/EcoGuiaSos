# Script de Respaldo Antigravity (Versión Rápida con Robocopy)
# Optimizado para manejar los +180,000 archivos y 17GB de datos.

$sourcePath = "C:\Users\SergioGJ\.gemini"
$destinationFolder = "c:\Users\SergioGJ\OneDrive - Instituto Politecnico Nacional\Programacion\antigravity\ecogaiasos_pruebas\backups\dot_gemini_raw"

# Crear carpeta de destino si no existe
if (-not (Test-Path $destinationFolder)) {
    New-Item -ItemType Directory -Path $destinationFolder -Force
}

Write-Host "Iniciando respaldo rápido con Robocopy..." -ForegroundColor Yellow
Write-Host "Detectados: ~187,000 archivos (17 GB). Esto tomará tiempo pero es mucho más rápido que comprimir." -ForegroundColor Cyan

# Robocopy: /E (subdirectorios), /Z (resumible), /MT:32 (32 hilos para velocidad), /R:5 /W:5 (reintentos breves)
# /XD "antigravity-browser-profile" (Opcional: podriamos excluir el perfil del navegador si fuera muy grande, pero lo incluiremos por defecto)
robocopy $sourcePath $destinationFolder /E /Z /MT:32 /R:5 /W:5 /TBD /NP /V

Write-Host "`n¡Copia completada!" -ForegroundColor Green
Write-Host "Los archivos están ahora en: $destinationFolder" -ForegroundColor Green
Write-Host "Asegúrate de que OneDrive sincronice esta carpeta antes de formatear." -ForegroundColor Yellow

pause
