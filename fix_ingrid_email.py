#!/usr/bin/env python3
"""
Script para asegurar que el email de Ingrid esté correcto
"""

from pathlib import Path
import re

def main():
    print("🔍 Verificando email de Ingrid en EJECUTAR_IMPORT.sql...")
    
    sql_file = Path('EJECUTAR_IMPORT.sql')
    
    if not sql_file.exists():
        print("❌ Error: No se encontró EJECUTAR_IMPORT.sql")
        return
    
    # Leer contenido
    content = sql_file.read_text(encoding='utf-8')
    
    # Buscar ambas variantes
    hotmail_count = content.count('ingridhim@hotmail.com')
    gmail_count = content.count('ingridhim@gmail.com')
    
    print(f"📊 ingridhim@hotmail.com: {hotmail_count} ocurrencias")
    print(f"📊 ingridhim@gmail.com: {gmail_count} ocurrencias")
    
    if hotmail_count == 0:
        print("✅ No se encontró ingridhim@hotmail.com")
        print("✅ El archivo ya está correcto")
        return
    
    print(f"\n🔧 Corrigiendo {hotmail_count} ocurrencias...")
    
    # Reemplazar hotmail por gmail
    content_corregido = content.replace('ingridhim@hotmail.com', 'ingridhim@gmail.com')
    
    # Verificar cambio
    new_gmail_count = content_corregido.count('ingridhim@gmail.com')
    
    # Guardar
    output_file = Path('EJECUTAR_IMPORT_CORREGIDO.sql')
    output_file.write_text(content_corregido, encoding='utf-8')
    
    print(f"✅ Email corregido: ingridhim@hotmail.com → ingridhim@gmail.com")
    print(f"✅ Total de ingridhim@gmail.com ahora: {new_gmail_count}")
    print(f"📁 Archivo generado: {output_file}")
    print(f"📊 Tamaño: {len(content_corregido):,} bytes")
    
    print("\n" + "="*60)
    print("🚀 PRÓXIMOS PASOS")
    print("="*60)
    print("1. Ejecuta BULK_IMPORT_CLIENTES.sql en Supabase")
    print("   (Actualiza la función para corregir error de ambigüedad)")
    print("")
    print("2. Ejecuta EJECUTAR_IMPORT_CORREGIDO.sql en Supabase")
    print("   (Importa las 3,443 pólizas)")
    print("")
    print("3. Si sigue fallando por brokers no encontrados:")
    print("   - Ejecuta VERIFICAR_BROKERS_DEL_CSV.sql")
    print("   - Crea los brokers faltantes desde /brokers")
    print("="*60)

if __name__ == '__main__':
    main()
