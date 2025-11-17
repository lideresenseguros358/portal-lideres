#!/usr/bin/env python3
"""
Script para corregir el email de Ingrid en EJECUTAR_IMPORT.sql
"""

from pathlib import Path

def main():
    print("🔧 Corrigiendo email de Ingrid...")
    
    sql_file = Path('EJECUTAR_IMPORT.sql')
    
    if not sql_file.exists():
        print("❌ Error: No se encontró EJECUTAR_IMPORT.sql")
        return
    
    # Leer contenido
    content = sql_file.read_text(encoding='utf-8')
    
    # Contar ocurrencias
    count = content.count('ingridhim@hotmail.com')
    
    if count == 0:
        print("✅ El email ya está correcto (no se encontró ingridhim@hotmail.com)")
        return
    
    print(f"📊 Encontradas {count} ocurrencias de ingridhim@hotmail.com")
    
    # Reemplazar
    content_corregido = content.replace('ingridhim@hotmail.com', 'ingridhim@gmail.com')
    
    # Guardar
    output_file = Path('EJECUTAR_IMPORT_CORREGIDO.sql')
    output_file.write_text(content_corregido, encoding='utf-8')
    
    print(f"✅ Email corregido: ingridhim@hotmail.com → ingridhim@gmail.com")
    print(f"✅ {count} ocurrencias reemplazadas")
    print(f"📁 Archivo generado: {output_file}")
    print(f"📊 Tamaño: {len(content_corregido):,} bytes")
    
    print("\n" + "="*60)
    print("🚀 LISTO PARA IMPORTAR")
    print("="*60)
    print("1. Ejecuta BULK_IMPORT_CLIENTES.sql en Supabase")
    print("2. Ejecuta EJECUTAR_IMPORT_CORREGIDO.sql en Supabase")
    print("="*60)

if __name__ == '__main__':
    main()
