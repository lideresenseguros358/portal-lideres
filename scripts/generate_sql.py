#!/usr/bin/env python3
"""
Script para generar el archivo SQL completo con el JSON embebido
"""

import json

# Leer el JSON compacto
with open('public/TODA_FINAL_IMPORT_COMPACT.json', 'r', encoding='utf-8') as f:
    json_data = f.read()

# Crear el SQL usando dollar-quoted strings para evitar problemas con comillas
sql_content = f"""-- ========================================
-- BULK IMPORT DE CLIENTES Y PÓLIZAS
-- ========================================
-- 
-- Total de registros: 3,443 pólizas
-- Brokers únicos: 80
-- Aseguradoras: 6
--
-- INSTRUCCIONES:
-- 1. Verifica que la función bulk_import_clients_policies existe
-- 2. Verifica que los brokers existen en la tabla brokers
-- 3. Ejecuta este SQL completo en Supabase SQL Editor
-- 4. Revisa los resultados (success/warning/error)
--
-- NOTA: Usa $$ para delimitar el JSON y evitar problemas con comillas
--
-- ========================================

SELECT * FROM bulk_import_clients_policies($$
{json_data}
$$::jsonb);
"""

# Guardar el SQL
with open('EJECUTAR_IMPORT.sql', 'w', encoding='utf-8') as f:
    f.write(sql_content)

print("✅ Archivo SQL generado: EJECUTAR_IMPORT.sql")
print(f"📊 Tamaño del archivo: {len(sql_content):,} bytes")
print("\n🚀 LISTO PARA EJECUTAR:")
print("   1. Abre: EJECUTAR_IMPORT.sql")
print("   2. Copia TODO el contenido")
print("   3. Pega en Supabase SQL Editor")
print("   4. Click en 'Run' (F5)")
