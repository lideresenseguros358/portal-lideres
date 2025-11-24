@echo off
echo ========================================
echo EJECUCION AUTOMATICA - FLUJO QUINCENA
echo ========================================
echo.

echo PASO 1: Regenerando database.types.ts...
echo.
call npx supabase gen types typescript --project-id kplrjslggkltuhmykqrx > src\lib\database.types.ts
if errorlevel 1 (
    echo ERROR: No se pudo regenerar types
    pause
    exit /b 1
)
echo OK: database.types.ts actualizado
echo.

echo PASO 2: Verificando TypeScript...
echo.
call npm run typecheck
if errorlevel 1 (
    echo ERROR: Hay errores de TypeScript
    pause
    exit /b 1
)
echo OK: TypeScript sin errores
echo.

echo PASO 3: Limpiando clientes duplicados...
echo.
call node scripts\clean-duplicate-clients.mjs
if errorlevel 1 (
    echo ERROR: Fallo limpieza de duplicados
    pause
    exit /b 1
)
echo OK: Duplicados limpiados
echo.

echo PASO 4: Ejecutando bulk import...
echo.
call node scripts\bulk-import-optimized.mjs
if errorlevel 1 (
    echo ERROR: Fallo bulk import
    pause
    exit /b 1
)
echo OK: Bulk import completado
echo.

echo ========================================
echo IMPLEMENTACION COMPLETADA CON EXITO
echo ========================================
echo.
echo Puedes verificar en Supabase que:
echo - fortnight_details tiene registros
echo - No hay clientes duplicados
echo - comm_items y comm_imports estan preservados
echo.
pause
