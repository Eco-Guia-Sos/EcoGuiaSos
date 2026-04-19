# Script de Respaldo Antigravity
# Este script comprime la carpeta .gemini que contiene tu historial y contexto.

$sourcePath = "C:\Users\SergioGJ\.gemini"
$date = Get-Date -Format "yyyy-MM-dd"
$destinationFolder = "c:\Users\SergioGJ\OneDrive - Instituto Politecnico Nacional\Programacion\antigravity\ecogaiasos_pruebas\backups"
$destinationPath = Join-Path $destinationFolder "Antigravity_Backup_$date.zip"

# Crear carpeta de backups si no existe
if (-not (Test-Path $destinationFolder)) {
    New-Item -ItemType Directory -Path $destinationFolder
    Write-Host "Carpeta de backups creada en $destinationFolder" -ForegroundColor Cyan
}

Write-Host "Iniciando respaldo de $sourcePath..." -ForegroundColor Yellow

try {
    # Comprimir la carpeta (excluyendo subcarpetas temporales si fuera necesario, pero aquí la tomamos toda)
    Compress-Archive -Path $sourcePath -DestinationPath $destinationPath -Force -ErrorAction Stop
    Write-Host "¡Respaldo completado con éxito!" -ForegroundColor Green
    Write-Host "Archivo guardado en: $destinationPath" -ForegroundColor Green
    Write-Host "Asegúrate de que OneDrive sincronice este archivo antes de formatear o cambiar el disco." -ForegroundColor Cyan
} catch {
    Write-Host "Error durante el respaldo: $($_.Exception.Message)" -ForegroundColor Red
}

pause
