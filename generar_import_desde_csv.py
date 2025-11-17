#!/usr/bin/env python3
"""
Script para generar EJECUTAR_IMPORT.sql desde public/TODA.csv
"""

import csv
import json
from pathlib import Path
from datetime import datetime

def parse_date(date_str):
    """
    Convierte fecha del CSV a formato YYYY-MM-DD
    Formatos soportados: DD/MM/YY, DD/MM/YYYY
    """
    if not date_str or date_str.strip() == '':
        return None
    
    date_str = date_str.strip()
    
    # Intentar varios formatos
    formats = ['%d/%m/%y', '%d/%m/%Y', '%Y-%m-%d']
    
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            # Si el año es menor a 100, ajustar
            if dt.year < 100:
                if dt.year > 50:
                    dt = dt.replace(year=dt.year + 1900)
                else:
                    dt = dt.replace(year=dt.year + 2000)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            continue
    
    # Si no se pudo parsear, retornar la fecha original
    print(f"⚠️ No se pudo parsear fecha: {date_str}")
    return date_str

def clean_value(value):
    """Limpia un valor del CSV"""
    if value is None:
        return None
    value = str(value).strip()
    return None if value == '' else value

def main():
    print("🔍 Leyendo public/TODA.csv...")
    
    csv_file = Path('public/TODA.csv')
    
    if not csv_file.exists():
        print("❌ Error: No se encontró public/TODA.csv")
        return
    
    # Leer CSV
    registros = []
    errores = []
    linea = 0
    
    # Leer con utf-8-sig para manejar BOM automáticamente
    try:
        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            content = f.read()
            print(f"✅ Archivo leído correctamente (con manejo de BOM)")
    except Exception as e:
        print(f"❌ Error al leer archivo: {e}")
        return
    
    # Procesar CSV desde el contenido
    from io import StringIO
    reader = csv.DictReader(StringIO(content))
    
    # Debug: Mostrar nombres de columnas
    print(f"📋 Columnas detectadas: {reader.fieldnames}")
    
    for row in reader:
        linea += 1
        
        try:
            # Extraer datos
            client_name = clean_value(row.get('client_name'))
            policy_number = clean_value(row.get('policy_number'))
            broker_email = clean_value(row.get('broker_email'))
            insurer_name = clean_value(row.get('insurer_name'))
            ramo = clean_value(row.get('ramo'))
            start_date_str = clean_value(row.get('start_date'))
            renewal_date_str = clean_value(row.get('renewal_date'))
            
            # Campos opcionales
            national_id = clean_value(row.get('national_id'))
            email = clean_value(row.get('email'))
            phone = clean_value(row.get('phone'))
            percent_override = clean_value(row.get('percent_override'))
                
            # Validar campos obligatorios
            if not client_name:
                errores.append(f"Línea {linea}: Falta client_name")
                continue
            
            if not policy_number:
                errores.append(f"Línea {linea}: Falta policy_number")
                continue
            
            if not broker_email:
                errores.append(f"Línea {linea}: Falta broker_email")
                continue
            
            if not insurer_name:
                errores.append(f"Línea {linea}: Falta insurer_name")
                continue
            
            if not start_date_str:
                errores.append(f"Línea {linea}: Falta start_date")
                continue
            
            if not renewal_date_str:
                errores.append(f"Línea {linea}: Falta renewal_date")
                continue
                
            # Parsear fechas
            start_date = parse_date(start_date_str)
            renewal_date = parse_date(renewal_date_str)
            
            # Crear registro
            registro = {
                'client_name': client_name.upper(),
                'policy_number': policy_number.upper(),
                'broker_email': broker_email.lower(),
                'insurer_name': insurer_name.upper(),
                'start_date': start_date,
                'renewal_date': renewal_date,
            }
            
            # Agregar campos opcionales
            if ramo:
                registro['ramo'] = ramo.upper()
            if national_id:
                registro['national_id'] = national_id.upper()
            if email:
                registro['email'] = email.lower()
            if phone:
                registro['phone'] = phone
            if percent_override:
                try:
                    registro['percent_override'] = float(percent_override)
                except:
                    pass
            
            registros.append(registro)
            
        except Exception as e:
            errores.append(f"Línea {linea}: Error al procesar - {str(e)}")
    
    print(f"✅ {len(registros)} registros procesados correctamente")
    
    if errores:
        print(f"⚠️ {len(errores)} errores encontrados:")
        for error in errores[:10]:  # Mostrar solo los primeros 10
            print(f"   {error}")
        if len(errores) > 10:
            print(f"   ... y {len(errores) - 10} errores más")
    
    # Obtener emails únicos
    emails_unicos = sorted(set(r['broker_email'] for r in registros))
    print(f"\n📊 {len(emails_unicos)} brokers únicos en el CSV")
    
    # Obtener aseguradoras únicas
    insurers_unicos = sorted(set(r['insurer_name'] for r in registros))
    print(f"📊 {len(insurers_unicos)} aseguradoras: {', '.join(insurers_unicos)}")
    
    # Generar JSON
    print("\n💾 Generando EJECUTAR_IMPORT.sql...")
    
    json_str = json.dumps(registros, ensure_ascii=False, separators=(',', ':'))
    
    sql_content = f"""-- ========================================
-- BULK IMPORT DE CLIENTES Y PÓLIZAS
-- ========================================
-- 
-- Generado desde: public/TODA.csv
-- Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
-- 
-- Total de registros: {len(registros):,} pólizas
-- Brokers únicos: {len(emails_unicos)}
-- Aseguradoras: {', '.join(insurers_unicos)}
--
-- INSTRUCCIONES:
-- 1. Ejecuta BULK_IMPORT_CLIENTES.sql primero (actualiza la función)
-- 2. Ejecuta este archivo completo en Supabase SQL Editor
-- 3. Revisa los resultados (success/error en cada fila)
--
-- Si aparece "Broker no encontrado":
-- - Ejecuta VERIFICAR_BROKERS_DEL_CSV.sql para ver quiénes faltan
-- - Crea los brokers faltantes desde /brokers en tu app
-- - Vuelve a ejecutar este import
--
-- ========================================

SELECT * FROM bulk_import_clients_policies($$
{json_str}
$$::jsonb);
"""
    
    output_file = Path('EJECUTAR_IMPORT.sql')
    output_file.write_text(sql_content, encoding='utf-8')
    
    print(f"✅ Archivo generado: {output_file}")
    print(f"📊 Tamaño: {len(sql_content):,} bytes")
    
    # Mostrar primeros emails para verificación
    print("\n📧 Primeros 10 brokers en el CSV:")
    for email in emails_unicos[:10]:
        count = sum(1 for r in registros if r['broker_email'] == email)
        print(f"   {email} ({count} pólizas)")
    if len(emails_unicos) > 10:
        print(f"   ... y {len(emails_unicos) - 10} brokers más")
    
    print("\n" + "="*60)
    print("🚀 PRÓXIMOS PASOS")
    print("="*60)
    print("1. ✅ Ejecuta BULK_IMPORT_CLIENTES.sql en Supabase")
    print("   (Actualiza la función para corregir error de ambigüedad)")
    print("")
    print("2. 🔍 Ejecuta VERIFICAR_BROKERS_DEL_CSV.sql en Supabase")
    print("   (Verifica qué brokers existen y cuáles faltan)")
    print("")
    print("3. 👥 Crea los brokers faltantes desde /brokers")
    print("   (Solo los que no existan en la BD)")
    print("")
    print("4. ▶️ Ejecuta EJECUTAR_IMPORT.sql en Supabase")
    print(f"   (Importa las {len(registros):,} pólizas)")
    print("="*60)

if __name__ == '__main__':
    main()
