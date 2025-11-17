#!/usr/bin/env python3
"""
Script para parsear el bulk import de clientes y pólizas
Procesa el archivo de texto con formato de columnas y genera JSON
"""

import json
import re
from datetime import datetime
from collections import defaultdict

def parse_date(date_str):
    """Convierte DD/MM/YY a YYYY-MM-DD"""
    if not date_str or date_str.strip() == '':
        return None
    
    try:
        # Formato DD/MM/YY
        parts = date_str.strip().split('/')
        if len(parts) != 3:
            return None
        
        day, month, year = parts
        
        # Convertir año de 2 dígitos a 4 dígitos
        if len(year) == 2:
            year_num = int(year)
            # Si es mayor a 50, asumimos 1900s, sino 2000s
            year = f"19{year}" if year_num > 50 else f"20{year}"
        
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    except:
        print(f"⚠️  Error parseando fecha: {date_str}")
        return None

def clean_field(field):
    """Limpia un campo eliminando espacios extras"""
    if not field:
        return None
    field = field.strip()
    return field if field != '' else None

def parse_line(line, line_num):
    """Parsea una línea de datos"""
    # Dividir por múltiples espacios (2 o más)
    parts = [p.strip() for p in re.split(r'\s{2,}', line.strip()) if p.strip()]
    
    if len(parts) < 10:
        print(f"⚠️  Línea {line_num}: Pocos campos ({len(parts)})")
        return None
    
    # Extraer campos en orden esperado
    try:
        idx = 0
        client_name = parts[idx]; idx += 1
        national_id = parts[idx] if len(parts[idx]) < 30 else ''; idx += 1 if len(parts[idx]) < 30 else 0
        email = parts[idx] if '@' in parts[idx] else ''; idx += 1 if '@' in parts[idx] else 0
        phone = parts[idx] if len(parts[idx]) < 20 and re.match(r'^[\d-]+$', parts[idx]) else ''; idx += 1 if len(parts[idx]) < 20 and re.match(r'^[\d-]+$', parts[idx]) else 0
        
        # Saltar dirección si existe
        if idx < len(parts) and not re.match(r'^[A-Z0-9-]+$', parts[idx]):
            idx += 1
        
        policy_number = parts[idx]; idx += 1
        insurer_name = parts[idx]; idx += 1
        ramo = parts[idx]; idx += 1
        start_date = parts[idx]; idx += 1
        renewal_date = parts[idx]; idx += 1
        
        # Status (siempre parece ser "1")
        status = parts[idx] if idx < len(parts) else '1'; idx += 1 if idx < len(parts) else 0
        
        # Los últimos 2 campos son broker_email y commission
        broker_email = parts[-2] if len(parts) >= 2 else ''
        commission = parts[-1] if len(parts) >= 1 else ''
        
        # Validar campos obligatorios
        if not client_name or not policy_number or not insurer_name or not broker_email or '@' not in broker_email:
            print(f"⚠️  Línea {line_num}: Faltan campos obligatorios")
            return None
        
        # Parsear commission
        percent_override = None
        try:
            if commission and commission.replace('.', '').replace(',', '').isdigit():
                percent_override = float(commission.replace(',', '.'))
        except:
            pass
        
        return {
            'client_name': client_name.strip().upper(),
            'national_id': clean_field(national_id),
            'email': clean_field(email) if email and '@' in email else None,
            'phone': clean_field(phone),
            'policy_number': policy_number.strip(),
            'insurer_name': insurer_name.strip().upper(),
            'ramo': clean_field(ramo),
            'start_date': parse_date(start_date),
            'renewal_date': parse_date(renewal_date),
            'broker_email': broker_email.strip().lower(),
            'percent_override': percent_override,
        }
    except Exception as e:
        print(f"❌ Error en línea {line_num}: {str(e)}")
        print(f"   Campos: {parts}")
        return None

def main():
    print("📖 Leyendo archivo de datos...")
    
    with open('DATOS_IMPORT_RAW.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    print(f"📊 Total de líneas: {len(lines)}")
    
    parsed = []
    skipped = 0
    
    for i, line in enumerate(lines, 1):
        # Saltar líneas vacías o de encabezado
        if not line.strip() or 'client_name' in line.lower():
            continue
        
        record = parse_line(line, i)
        if record:
            parsed.append(record)
        else:
            skipped += 1
    
    print(f"\n✅ Registros parseados: {len(parsed)}")
    print(f"⚠️  Registros omitidos: {skipped}")
    
    # Agrupar por broker
    by_broker = defaultdict(list)
    for record in parsed:
        by_broker[record['broker_email']].append(record)
    
    print(f"\n👥 Brokers únicos: {len(by_broker)}")
    for email, records in sorted(by_broker.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"   - {email}: {len(records)} pólizas")
    
    # Aseguradoras únicas
    insurers = sorted(set(r['insurer_name'] for r in parsed))
    print(f"\n🏢 Aseguradoras únicas ({len(insurers)}):")
    for ins in insurers:
        count = sum(1 for r in parsed if r['insurer_name'] == ins)
        print(f"   - {ins}: {count} pólizas")
    
    # Ramos únicos
    ramos = sorted(set(r['ramo'] for r in parsed if r['ramo']))
    print(f"\n📋 Ramos únicos ({len(ramos)}):")
    for ramo in ramos:
        count = sum(1 for r in parsed if r['ramo'] == ramo)
        print(f"   - {ramo}: {count} pólizas")
    
    # Guardar JSON completo
    with open('DATOS_IMPORT.json', 'w', encoding='utf-8') as f:
        json.dump(parsed, f, indent=2, ensure_ascii=False)
    print(f"\n💾 JSON guardado: DATOS_IMPORT.json")
    
    # Estadísticas
    print('\n📊 ESTADÍSTICAS:')
    print(f"   Total registros: {len(parsed)}")
    print(f"   Con national_id: {sum(1 for r in parsed if r['national_id'])}")
    print(f"   Con email: {sum(1 for r in parsed if r['email'])}")
    print(f"   Con phone: {sum(1 for r in parsed if r['phone'])}")
    print(f"   Con ramo: {sum(1 for r in parsed if r['ramo'])}")
    print(f"   Con start_date: {sum(1 for r in parsed if r['start_date'])}")
    print(f"   Con renewal_date: {sum(1 for r in parsed if r['renewal_date'])}")
    print(f"   Con percent_override: {sum(1 for r in parsed if r['percent_override'])}")
    
    # Validar fechas
    invalid_dates = []
    for r in parsed:
        if r['start_date'] and not re.match(r'^\d{4}-\d{2}-\d{2}$', r['start_date']):
            invalid_dates.append((r['policy_number'], r['start_date']))
        if r['renewal_date'] and not re.match(r'^\d{4}-\d{2}-\d{2}$', r['renewal_date']):
            invalid_dates.append((r['policy_number'], r['renewal_date']))
    
    if invalid_dates:
        print(f"\n⚠️  Fechas inválidas encontradas: {len(invalid_dates)}")
        for pol, date in invalid_dates[:5]:
            print(f"   - {pol}: {date}")
    
    print('\n✅ Proceso completado!')
    print('\n🔄 Siguiente paso:')
    print('   1. Revisa el archivo DATOS_IMPORT.json')
    print('   2. Copia su contenido')
    print('   3. Ejecuta en Supabase SQL Editor:')
    print('      SELECT * FROM bulk_import_clients_policies(\'[... pega el JSON ...]\'::jsonb);')

if __name__ == '__main__':
    main()
