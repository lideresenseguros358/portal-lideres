#!/usr/bin/env python3
"""
Script para corregir emails de brokers en el JSON de importación
"""

import json
import sys
from pathlib import Path

# =====================================================
# MAPEO DE EMAILS (ACTUALIZAR CON TUS DATOS REALES)
# =====================================================

EMAIL_CORRECTIONS = {
    # ✅ CONFIRMADOS
    'angelicaramos@lideresenseguros.com': 'yiraramos@lideresenseguros.com',
    'kathrinaguirre@lideresenseguros.com': 'kathrin.aguirre@hotmail.com',
    'soniaarenas@lideresenseguros.com': 'soniaa0154@outlook.com',
    
    # ⚠️ PENDIENTES - Ejecuta OBTENER_TODOS_LOS_EMAILS_REALES.sql y completa:
    # 'ediscastillo@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'lissethvergara@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'ruthmejia@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'stheysivejarano@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'josemanuel@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'ivettemartinez@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'itzycandanedo@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'elizabetharce@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'kattiaberguido@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'veronicahenriquez@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'leormanhudgson@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'luzgonzalez@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'keniagonzalez@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'hericka@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'sebastianachiari@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'ricardojimenez@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
    # 'jazmincamilo@lideresenseguros.com': '[EMAIL_REAL_AQUI]',
}

def corregir_emails_json(json_data):
    """
    Corrige los emails en el JSON de importación
    
    Args:
        json_data: Lista de diccionarios con datos de clientes/pólizas
        
    Returns:
        Tupla (json_corregido, contador_correcciones)
    """
    correcciones = 0
    emails_no_encontrados = set()
    
    for registro in json_data:
        email_original = registro.get('broker_email', '').lower()
        
        if email_original in EMAIL_CORRECTIONS:
            email_nuevo = EMAIL_CORRECTIONS[email_original]
            registro['broker_email'] = email_nuevo
            correcciones += 1
        elif email_original.endswith('@lideresenseguros.com'):
            # Es un email con formato @lideresenseguros.com pero no está en el mapeo
            emails_no_encontrados.add(email_original)
    
    return json_data, correcciones, emails_no_encontrados

def main():
    """
    Función principal
    """
    # Leer archivo JSON de entrada
    print("🔍 Leyendo EJECUTAR_IMPORT.sql...")
    
    sql_file = Path('EJECUTAR_IMPORT.sql')
    if not sql_file.exists():
        print("❌ Error: No se encontró EJECUTAR_IMPORT.sql")
        sys.exit(1)
    
    content = sql_file.read_text(encoding='utf-8')
    
    # Extraer JSON entre $$ y $$
    start_marker = "$$\n["
    end_marker = "]\n$$"
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    if start_idx == -1 or end_idx == -1:
        print("❌ Error: No se pudo encontrar el JSON en el archivo SQL")
        sys.exit(1)
    
    json_str = content[start_idx + len("$$\n"):end_idx + 1]
    
    print("📦 Parseando JSON...")
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"❌ Error al parsear JSON: {e}")
        sys.exit(1)
    
    print(f"✅ {len(data)} registros encontrados")
    
    # Corregir emails
    print("\n🔧 Corrigiendo emails...")
    data_corregido, correcciones, emails_no_encontrados = corregir_emails_json(data)
    
    print(f"✅ {correcciones} correcciones aplicadas")
    
    if emails_no_encontrados:
        print(f"\n⚠️ {len(emails_no_encontrados)} emails sin mapeo encontrados:")
        for email in sorted(emails_no_encontrados):
            print(f"   - {email}")
        print("\n💡 Agrega estos emails al diccionario EMAIL_CORRECTIONS")
    
    # Generar SQL corregido
    print("\n💾 Generando EJECUTAR_IMPORT_CORREGIDO.sql...")
    
    json_corregido = json.dumps(data_corregido, ensure_ascii=False, separators=(',', ':'))
    
    sql_corregido = f"""-- ========================================
-- BULK IMPORT DE CLIENTES Y PÓLIZAS (CORREGIDO)
-- ========================================
-- 
-- Total de registros: {len(data_corregido)} pólizas
-- Correcciones aplicadas: {correcciones} emails
--
-- EMAILS CORREGIDOS:
"""
    
    for email_viejo, email_nuevo in EMAIL_CORRECTIONS.items():
        sql_corregido += f"-- {email_viejo} → {email_nuevo}\n"
    
    sql_corregido += f"""--
-- ========================================

SELECT * FROM bulk_import_clients_policies($$
{json_corregido}
$$::jsonb);
"""
    
    output_file = Path('EJECUTAR_IMPORT_CORREGIDO.sql')
    output_file.write_text(sql_corregido, encoding='utf-8')
    
    print(f"✅ Archivo generado: {output_file}")
    print(f"📊 Tamaño: {len(sql_corregido):,} bytes")
    
    # Resumen
    print("\n" + "="*60)
    print("📋 RESUMEN")
    print("="*60)
    print(f"Total registros: {len(data_corregido)}")
    print(f"Correcciones aplicadas: {correcciones}")
    print(f"Emails únicos corregidos: {len(EMAIL_CORRECTIONS)}")
    print(f"Emails sin mapeo: {len(emails_no_encontrados)}")
    
    if emails_no_encontrados:
        print("\n⚠️ ACCIÓN REQUERIDA:")
        print("   1. Ejecuta OBTENER_TODOS_LOS_EMAILS_REALES.sql en Supabase")
        print("   2. Agrega los emails faltantes a EMAIL_CORRECTIONS")
        print("   3. Vuelve a ejecutar este script")
    else:
        print("\n✅ ¡Listo para importar!")
        print("   Ejecuta EJECUTAR_IMPORT_CORREGIDO.sql en Supabase")
    
    print("="*60)

if __name__ == '__main__':
    main()
