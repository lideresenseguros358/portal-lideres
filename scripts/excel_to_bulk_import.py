#!/usr/bin/env python3
"""
Script para convertir Excel/CSV a formato JSON para bulk import
Requiere: pip install pandas openpyxl
"""

import pandas as pd
import json
import sys
from datetime import datetime
import re

def clean_field(value):
    """Limpia un campo eliminando espacios y valores vacíos"""
    if pd.isna(value) or value == '' or str(value).strip() == '':
        return None
    return str(value).strip()

def parse_date(value):
    """Convierte fecha a formato YYYY-MM-DD"""
    if pd.isna(value):
        return None
    
    # Si ya es datetime
    if isinstance(value, datetime):
        return value.strftime('%Y-%m-%d')
    
    # Si es string
    value_str = str(value).strip()
    if not value_str:
        return None
    
    # Intentar varios formatos
    formats = [
        '%d/%m/%Y',  # 02/06/2025
        '%d/%m/%y',  # 02/06/25
        '%Y-%m-%d',  # 2025-06-02
        '%m/%d/%Y',  # 06/02/2025
        '%m/%d/%y',  # 06/02/25
    ]
    
    for fmt in formats:
        try:
            date_obj = datetime.strptime(value_str, fmt)
            # Si el año es menor a 100, ajustar (año 2 dígitos)
            if date_obj.year < 100:
                date_obj = date_obj.replace(year=date_obj.year + 2000 if date_obj.year < 50 else date_obj.year + 1900)
            return date_obj.strftime('%Y-%m-%d')
        except ValueError:
            continue
    
    print(f"⚠️  No se pudo parsear fecha: {value_str}")
    return None

def parse_commission(value):
    """Convierte comisión a float"""
    if pd.isna(value) or value == '':
        return None
    
    try:
        # Convertir a string y reemplazar coma por punto
        value_str = str(value).replace(',', '.')
        return float(value_str)
    except:
        print(f"⚠️  No se pudo parsear comisión: {value}")
        return None

def process_excel(file_path):
    """Procesa archivo Excel/CSV y genera JSON"""
    print(f"📖 Leyendo archivo: {file_path}")
    
    # Detectar tipo de archivo y leer
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path, encoding='utf-8')
    else:
        df = pd.read_excel(file_path)
    
    print(f"📊 Filas leídas: {len(df)}")
    print(f"📋 Columnas: {list(df.columns)}")
    
    # Mapeo de columnas (ajusta según tus nombres de columnas)
    column_mapping = {
        # Nombres posibles → nombre estándar
        'client_name': 'client_name',
        'nombre_cliente': 'client_name',
        'nombre': 'client_name',
        'client': 'client_name',
        
        'national_id': 'national_id',
        'cedula': 'national_id',
        'cédula': 'national_id',
        'ruc': 'national_id',
        'id': 'national_id',
        
        'email': 'email',
        'correo': 'email',
        'email_cliente': 'email',
        
        'phone': 'phone',
        'telefono': 'phone',
        'teléfono': 'phone',
        'cel': 'phone',
        'celular': 'phone',
        
        'policy_number': 'policy_number',
        'numero_poliza': 'policy_number',
        'número_póliza': 'policy_number',
        'poliza': 'policy_number',
        'póliza': 'policy_number',
        'no_poliza': 'policy_number',
        
        'insurer_name': 'insurer_name',
        'aseguradora': 'insurer_name',
        'insurer': 'insurer_name',
        'compañia': 'insurer_name',
        
        'ramo': 'ramo',
        'tipo_poliza': 'ramo',
        'tipo_póliza': 'ramo',
        'tipo': 'ramo',
        
        'start_date': 'start_date',
        'fecha_inicio': 'start_date',
        'inicio': 'start_date',
        
        'renewal_date': 'renewal_date',
        'fecha_renovacion': 'renewal_date',
        'renovacion': 'renewal_date',
        'renovación': 'renewal_date',
        
        'broker_email': 'broker_email',
        'email_broker': 'broker_email',
        'correo_broker': 'broker_email',
        'broker': 'broker_email',
        
        'percent_override': 'percent_override',
        'comision': 'percent_override',
        'comisión': 'percent_override',
        'porcentaje': 'percent_override',
        'commission': 'percent_override',
    }
    
    # Normalizar nombres de columnas
    df.columns = df.columns.str.strip().str.lower()
    
    # Renombrar columnas según mapeo
    for old_name, new_name in column_mapping.items():
        if old_name in df.columns:
            df = df.rename(columns={old_name: new_name})
    
    print(f"\n📋 Columnas después de normalizar: {list(df.columns)}")
    
    # Verificar columnas obligatorias
    required_cols = ['client_name', 'policy_number', 'insurer_name', 'broker_email', 'start_date', 'renewal_date']
    missing_cols = [col for col in required_cols if col not in df.columns]
    
    if missing_cols:
        print(f"\n❌ ERROR: Faltan columnas obligatorias: {missing_cols}")
        print(f"\n💡 TIP: Asegúrate de que tu archivo tenga estas columnas:")
        print(f"   - client_name (nombre del cliente)")
        print(f"   - policy_number (número de póliza)")
        print(f"   - insurer_name (aseguradora)")
        print(f"   - broker_email (email del broker)")
        print(f"   - start_date (fecha inicio)")
        print(f"   - renewal_date (fecha renovación)")
        sys.exit(1)
    
    # Procesar cada fila
    records = []
    skipped = 0
    
    for idx, row in df.iterrows():
        # Campos obligatorios
        client_name = clean_field(row.get('client_name'))
        policy_number = clean_field(row.get('policy_number'))
        insurer_name = clean_field(row.get('insurer_name'))
        broker_email = clean_field(row.get('broker_email'))
        start_date = parse_date(row.get('start_date'))
        renewal_date = parse_date(row.get('renewal_date'))
        
        # Validar campos obligatorios
        if not all([client_name, policy_number, insurer_name, broker_email]):
            print(f"⚠️  Fila {idx + 2}: Faltan campos obligatorios - OMITIDA")
            skipped += 1
            continue
        
        if not broker_email or '@' not in broker_email:
            print(f"⚠️  Fila {idx + 2}: Email de broker inválido '{broker_email}' - OMITIDA")
            skipped += 1
            continue
        
        # Campos opcionales
        national_id = clean_field(row.get('national_id'))
        email = clean_field(row.get('email'))
        phone = clean_field(row.get('phone'))
        ramo = clean_field(row.get('ramo'))
        percent_override = parse_commission(row.get('percent_override'))
        
        record = {
            'client_name': client_name.upper(),
            'national_id': national_id,
            'email': email.lower() if email and '@' in email else None,
            'phone': phone,
            'policy_number': policy_number,
            'insurer_name': insurer_name.upper(),
            'ramo': ramo.upper() if ramo else None,
            'start_date': start_date,
            'renewal_date': renewal_date,
            'broker_email': broker_email.lower(),
            'percent_override': percent_override,
        }
        
        records.append(record)
    
    print(f"\n✅ Registros procesados: {len(records)}")
    print(f"⚠️  Registros omitidos: {skipped}")
    
    # Estadísticas
    by_broker = {}
    by_insurer = {}
    by_ramo = {}
    
    for r in records:
        # Por broker
        by_broker[r['broker_email']] = by_broker.get(r['broker_email'], 0) + 1
        # Por aseguradora
        by_insurer[r['insurer_name']] = by_insurer.get(r['insurer_name'], 0) + 1
        # Por ramo
        if r['ramo']:
            by_ramo[r['ramo']] = by_ramo.get(r['ramo'], 0) + 1
    
    print(f"\n👥 Brokers únicos: {len(by_broker)}")
    for email, count in sorted(by_broker.items(), key=lambda x: x[1], reverse=True):
        print(f"   - {email}: {count} pólizas")
    
    print(f"\n🏢 Aseguradoras: {len(by_insurer)}")
    for insurer, count in sorted(by_insurer.items(), key=lambda x: x[1], reverse=True):
        print(f"   - {insurer}: {count} pólizas")
    
    if by_ramo:
        print(f"\n📋 Ramos: {len(by_ramo)}")
        for ramo, count in sorted(by_ramo.items(), key=lambda x: x[1], reverse=True):
            print(f"   - {ramo}: {count} pólizas")
    
    # Guardar JSON
    output_file = file_path.rsplit('.', 1)[0] + '_IMPORT.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 JSON guardado: {output_file}")
    
    # Guardar también una versión compacta (para copiar/pegar en SQL)
    output_file_compact = file_path.rsplit('.', 1)[0] + '_IMPORT_COMPACT.json'
    with open(output_file_compact, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, separators=(',', ':'))
    
    print(f"💾 JSON compacto: {output_file_compact}")
    
    # Validaciones finales
    print(f"\n📊 ESTADÍSTICAS FINALES:")
    print(f"   Con national_id: {sum(1 for r in records if r['national_id'])}")
    print(f"   Con email: {sum(1 for r in records if r['email'])}")
    print(f"   Con phone: {sum(1 for r in records if r['phone'])}")
    print(f"   Con ramo: {sum(1 for r in records if r['ramo'])}")
    print(f"   Con percent_override: {sum(1 for r in records if r['percent_override'])}")
    
    print(f"\n✅ LISTO! Ahora puedes:")
    print(f"   1. Abrir: {output_file}")
    print(f"   2. Copiar su contenido")
    print(f"   3. Ejecutar en Supabase SQL Editor:")
    print(f"      SELECT * FROM bulk_import_clients_policies('[PEGA AQUÍ]'::jsonb);")
    
    return records

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("❌ ERROR: Debes especificar el archivo a procesar")
        print("\n📖 USO:")
        print("   python excel_to_bulk_import.py archivo.xlsx")
        print("   python excel_to_bulk_import.py archivo.csv")
        print("\n💡 COLUMNAS REQUERIDAS EN TU ARCHIVO:")
        print("   - client_name (nombre del cliente)")
        print("   - policy_number (número de póliza)")
        print("   - insurer_name (aseguradora: ASSA, FEDPA, etc.)")
        print("   - broker_email (email del broker)")
        print("   - start_date (fecha inicio: DD/MM/YYYY)")
        print("   - renewal_date (fecha renovación: DD/MM/YYYY)")
        print("\n📝 COLUMNAS OPCIONALES:")
        print("   - national_id (cédula)")
        print("   - email (email cliente)")
        print("   - phone (teléfono)")
        print("   - ramo (tipo de póliza: AUTO, VIDA, etc.)")
        print("   - percent_override (comisión: 0.94, 1.0, etc.)")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    try:
        process_excel(file_path)
    except FileNotFoundError:
        print(f"❌ ERROR: Archivo no encontrado: {file_path}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
