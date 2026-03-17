"""Debug: test crear_poliza_auto_cc_externos with different multipart formats"""
import urllib.request, json, uuid, os, tempfile

BASE = 'https://wscanales.segfedpa.com/EmisorFedpa.Api/api'
CREDS = {'Usuario': 'SLIDERES', 'Clave': 'lider836'}

# Step 1: get_cotizacion
cot_body = {
    'Ano': 2022, 'Uso': '10', 'CantidadPasajeros': 5, 'SumaAsegurada': '15000',
    'CodLimiteLesiones': '1', 'CodLimitePropiedad': '1', 'CodLimiteGastosMedico': '1',
    'EndosoIncluido': 'S', 'CodPlan': '461', 'CodMarca': 'TOY', 'CodModelo': 'COROLLA',
    'Nombre': 'JUAN', 'Apellido': 'PEREZ', 'Cedula': '8-888-1001',
    'Telefono': '60001001', 'Email': 'test@test.com',
    'Usuario': 'SLIDERES', 'Clave': 'lider836'
}
req = urllib.request.Request(
    f'{BASE}/Polizas/get_cotizacion',
    data=json.dumps(cot_body).encode(), headers={'Content-Type': 'application/json'}, method='POST'
)
resp = urllib.request.urlopen(req)
cot_data = json.loads(resp.read())
item = cot_data[0]
id_cot = str(item.get('COTIZACION', ''))
sub_ramo = str(item.get('SUBRAMO', '04'))
ramo = str(item.get('RAMO', '04'))
prima = sum(c.get('PRIMA_IMPUESTO', 0) for c in cot_data)
print(f"Step 1: IdCotizacion={id_cot}, SubRamo={sub_ramo}, Ramo={ramo}, Prima={prima:.2f}")

# Step 2: get_nropoliza
req2 = urllib.request.Request(
    f'{BASE}/Polizas/get_nropoliza',
    data=json.dumps(CREDS).encode(), headers={'Content-Type': 'application/json'}, method='POST'
)
resp2 = urllib.request.urlopen(req2)
nro_data = json.loads(resp2.read())
nro_poliza = str(nro_data[0].get('NUMPOL', ''))
print(f"Step 2: NroPoliza={nro_poliza}")

# Build emission data matching manual EXACTLY
emision_data = {
    "FechaHora": "2025-06-28 10:00:00 AM",
    "Monto": f"{prima:.2f}",
    "Aprobada": "S",
    "NroTransaccion": f"P-{uuid.uuid4().hex[:8]}",
    "FechaAprobada": "2025-06-28 10:00:00 AM",
    "Ramo": ramo,
    "SubRamo": sub_ramo,
    "IdCotizacion": id_cot,
    "NroPoliza": nro_poliza,
    "FechaDesde": "2025-06-28",
    "FechaHasta": "2026-06-28",
    "Opcion": "A",
    "Usuario": "SLIDERES",
    "Clave": "lider836",
    "Entidad": [{
        "Juridico": "N", "NombreEmpresa": "", "PrimerNombre": "JUAN",
        "SegundoNombre": "", "PrimerApellido": "PEREZ", "SegundoApellido": "",
        "DocumentoIdentificacion": "CED", "Cedula": "8-888-1001", "Ruc": "",
        "FechaNacimiento": "1990-01-15", "Sexo": "M", "CodPais": "999",
        "CodProvincia": "999", "CodCorregimiento": "999", "Email": "test@test.com",
        "TelefonoOficina": "60001001", "Celular": "60001001",
        "Direccion": "PANAMA", "IdVinculo": "1"
    }],
    "Auto": {
        "CodMarca": "TOY", "CodModelo": "COROLLA", "Ano": "2022",
        "Placa": "ABC123", "Chasis": "VIN123456789", "Motor": "MOT123", "Color": "BLANCO"
    }
}

emision_json = json.dumps(emision_data)
print(f"\nJSON payload:\n{json.dumps(emision_data, indent=2)[:600]}")

# Create dummy files to mimic what Postman shows in page 10
dummy_pdf = b'%PDF-1.4\ndummy file content for testing'

def make_multipart(boundary, data_str, include_files=False, file_field_names=None):
    """Build multipart body manually"""
    parts = []
    # Add data field
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="data"\r\n\r\n{data_str}\r\n')
    
    if include_files and file_field_names:
        for fname in file_field_names:
            parts.append(
                f'--{boundary}\r\n'
                f'Content-Disposition: form-data; name="{fname}"; filename="dummy.pdf"\r\n'
                f'Content-Type: application/pdf\r\n\r\n'
            )
    
    parts.append(f'--{boundary}--\r\n')
    
    if include_files:
        # Need binary assembly for file parts
        body = b''
        for i, part in enumerate(parts):
            body += part.encode('utf-8')
            # After each file header, add the file content
            if include_files and i > 0 and i < len(parts) - 1:
                body += dummy_pdf + b'\r\n'
        return body
    else:
        return ''.join(parts).encode('utf-8')

def try_emission(label, body_bytes, content_type):
    print(f"\n{'='*60}")
    print(f"TEST: {label}")
    print(f"Content-Type: {content_type}")
    print(f"Body size: {len(body_bytes)} bytes")
    req = urllib.request.Request(
        f'{BASE}/Polizas/crear_poliza_auto_cc_externos',
        data=body_bytes, headers={'Content-Type': content_type}, method='POST'
    )
    try:
        resp = urllib.request.urlopen(req)
        result = resp.read().decode()
        print(f"SUCCESS! Status: {resp.status}")
        print(f"Response: {result[:500]}")
        return True
    except urllib.error.HTTPError as e:
        error = e.read().decode()
        print(f"FAILED: HTTP {e.code}")
        print(f"Error: {error[:300]}")
        return False

# Test 1: data only, no files
b1 = uuid.uuid4().hex
body1 = make_multipart(b1, emision_json, include_files=False)
try_emission("Multipart data only (no files)", body1, f'multipart/form-data; boundary={b1}')

# Test 2: data + 3 dummy files (File1, File2, File3) like Postman
b2 = uuid.uuid4().hex
body2 = make_multipart(b2, emision_json, include_files=True, file_field_names=['File1', 'File2', 'File3'])
try_emission("Multipart data + File1/File2/File3 (dummy)", body2, f'multipart/form-data; boundary={b2}')

# Test 3: Each JSON field as a SEPARATE form field (not nested in "data")
# Maybe the API expects flat form fields, not a single "data" JSON string?
b3 = uuid.uuid4().hex
flat_parts = []
for key, val in emision_data.items():
    if isinstance(val, (dict, list)):
        val_str = json.dumps(val)
    else:
        val_str = str(val)
    flat_parts.append(f'--{b3}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{val_str}\r\n')
flat_parts.append(f'--{b3}--\r\n')
body3 = ''.join(flat_parts).encode('utf-8')
try_emission("Flat form fields (each key separate)", body3, f'multipart/form-data; boundary={b3}')

# Test 4: Try with the JSON as a TEXT field explicitly with Content-Type
b4 = uuid.uuid4().hex
body4_str = (
    f'--{b4}\r\n'
    f'Content-Disposition: form-data; name="data"\r\n'
    f'Content-Type: application/json\r\n'
    f'\r\n'
    f'{emision_json}\r\n'
    f'--{b4}--\r\n'
)
body4 = body4_str.encode('utf-8')
try_emission("data field with Content-Type: application/json", body4, f'multipart/form-data; boundary={b4}')
