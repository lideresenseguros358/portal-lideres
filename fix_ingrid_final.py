#!/usr/bin/env python3
"""
Script para corregir el email de Ingrid en el JSON del import
"""

from pathlib import Path
import json

def main():
    print("🔍 Verificando email de Ingrid en EJECUTAR_IMPORT.sql...")
    
    sql_file = Path('EJECUTAR_IMPORT.sql')
    
    if not sql_file.exists():
        print("❌ Error: No se encontró EJECUTAR_IMPORT.sql")
        return
    
    # Leer contenido
    content = sql_file.read_text(encoding='utf-8')
    
    # Extraer JSON entre $$ y $$
    start_marker = "$$\n["
    end_marker = "]\n$$"
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    if start_idx == -1 or end_idx == -1:
        print("❌ Error: No se pudo encontrar el JSON en el archivo SQL")
        return
    
    json_str = content[start_idx + len("$$\n"):end_idx + 1]
    
    print("📦 Parseando JSON...")
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"❌ Error al parsear JSON: {e}")
        return
    
    print(f"✅ {len(data)} registros encontrados")
    
    # Buscar emails de Ingrid
    hotmail_count = 0
    gmail_count = 0
    correcciones = 0
    
    for registro in data:
        email = registro.get('broker_email', '')
        if 'ingridhim@hotmail.com' in email.lower():
            hotmail_count += 1
            registro['broker_email'] = 'ingridhim@gmail.com'
            correcciones += 1
        elif 'ingridhim@gmail.com' in email.lower():
            gmail_count += 1
    
    print(f"\n📊 Resultados:")
    print(f"   ingridhim@hotmail.com: {hotmail_count} (INCORRECTO)")
    print(f"   ingridhim@gmail.com: {gmail_count} (CORRECTO)")
    
    if correcciones == 0:
        print("\n✅ No hay correcciones necesarias")
        print("✅ Todos los emails de Ingrid ya están correctos")
        return
    
    print(f"\n🔧 Corrigiendo {correcciones} registros...")
    
    # Generar SQL corregido
    json_corregido = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    
    sql_corregido = f"""-- ========================================
-- BULK IMPORT DE CLIENTES Y PÓLIZAS (CORREGIDO)
-- ========================================
-- 
-- Total de registros: {len(data)} pólizas
-- 
-- CORRECCIÓN APLICADA:
-- ingridhim@hotmail.com → ingridhim@gmail.com ({correcciones} registros)
--
-- ========================================

SELECT * FROM bulk_import_clients_policies($$
{json_corregido}
$$::jsonb);
"""
    
    output_file = Path('EJECUTAR_IMPORT_CORREGIDO.sql')
    output_file.write_text(sql_corregido, encoding='utf-8')
    
    print(f"✅ {correcciones} emails corregidos")
    print(f"📁 Archivo generado: {output_file}")
    print(f"📊 Tamaño: {len(sql_corregido):,} bytes")
    
    print("\n" + "="*60)
    print("🚀 PRÓXIMOS PASOS")
    print("="*60)
    print("1. ✅ Ejecuta BULK_IMPORT_CLIENTES.sql en Supabase")
    print("   (Actualiza la función, corrige error de ambigüedad)")
    print("")
    print("2. ✅ Ejecuta EJECUTAR_IMPORT_CORREGIDO.sql en Supabase")
    print("   (Importa las 3,443 pólizas con email corregido)")
    print("")
    print("3. ⚠️ Si aparecen más brokers no encontrados:")
    print("   - Ejecuta VERIFICAR_BROKERS_DEL_CSV.sql")
    print("   - Crea los brokers faltantes desde /brokers")
    print("="*60)

if __name__ == '__main__':
    main()
