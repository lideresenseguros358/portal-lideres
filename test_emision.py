"""Test FEDPA crear_poliza_auto_cc_externos step 3 directly"""
import urllib.request, json, uuid

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
    'https://wscanales.segfedpa.com/EmisorFedpa.Api/api/Polizas/get_cotizacion',
    data=json.dumps(cot_body).encode(), headers={'Content-Type': 'application/json'}, method='POST'
)
resp = urllib.request.urlopen(req)
cot_data = json.loads(resp.read())
item = cot_data[0]
id_cot = str(item.get('COTIZACION', ''))
sub_ramo = str(item.get('SUBRAMO', '04'))
ramo = str(item.get('RAMO', '04'))
prima = sum(c.get('PRIMA_IMPUESTO', 0) for c in cot_data)
print(f"Step 1 OK: IdCotizacion={id_cot}, SubRamo={sub_ramo}, Ramo={ramo}, Prima={prima:.2f}")

# Step 2: get_nropoliza
nro_body = {'Usuario': 'SLIDERES', 'Clave': 'lider836'}
req2 = urllib.request.Request(
    'https://wscanales.segfedpa.com/EmisorFedpa.Api/api/Polizas/get_nropoliza',
    data=json.dumps(nro_body).encode(), headers={'Content-Type': 'application/json'}, method='POST'
)
resp2 = urllib.request.urlopen(req2)
nro_data = json.loads(resp2.read())
nro_poliza = str(nro_data[0].get('NUMPOL', ''))
print(f"Step 2 OK: NroPoliza={nro_poliza}")

# Step 3: crear_poliza_auto_cc_externos (multipart)
emision_data = {
    "FechaHora": "2025-06-28 10:00:00 AM",
    "Monto": f"{prima:.2f}",
    "Aprobada": "S",
    "NroTransaccion": f"P-TEST-{uuid.uuid4().hex[:8]}",
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
        "Juridico": "N",
        "NombreEmpresa": "",
        "PrimerNombre": "JUAN",
        "SegundoNombre": "",
        "PrimerApellido": "PEREZ",
        "SegundoApellido": "",
        "DocumentoIdentificacion": "CED",
        "Cedula": "8-888-1001",
        "Ruc": "",
        "FechaNacimiento": "1990-01-15",
        "Sexo": "M",
        "CodPais": "999",
        "CodProvincia": "999",
        "CodCorregimiento": "999",
        "Email": "test@test.com",
        "TelefonoOficina": "60001001",
        "Celular": "60001001",
        "Direccion": "PANAMA",
        "IdVinculo": "1"
    }],
    "Auto": {
        "CodMarca": "TOY",
        "CodModelo": "COROLLA",
        "Ano": "2022",
        "Placa": "ABC123",
        "Chasis": "VIN123456789",
        "Motor": "MOT123",
        "Color": "BLANCO"
    }
}

print(f"\nStep 3: NroPoliza in payload = '{emision_data['NroPoliza']}'")
print(f"IdCotizacion in payload = '{emision_data['IdCotizacion']}'")

# Build multipart manually
boundary = uuid.uuid4().hex
body_parts = []

# Add "data" field (text)
body_parts.append(f"--{boundary}")
body_parts.append('Content-Disposition: form-data; name="data"')
body_parts.append("")
body_parts.append(json.dumps(emision_data))

# Add dummy File1
dummy_pdf = b"%PDF-1.4 dummy"
body_parts.append(f"--{boundary}")
body_parts.append('Content-Disposition: form-data; name="File1"; filename="cedula.pdf"')
body_parts.append("Content-Type: application/pdf")
body_parts.append("")

# Close boundary placeholder — we'll build binary body
end_boundary = f"\r\n--{boundary}--\r\n"

# Build the body as bytes
text_before_file = "\r\n".join(body_parts) + "\r\n"
body_bytes = text_before_file.encode("utf-8") + dummy_pdf + end_boundary.encode("utf-8")

req3 = urllib.request.Request(
    'https://wscanales.segfedpa.com/EmisorFedpa.Api/api/Polizas/crear_poliza_auto_cc_externos',
    data=body_bytes,
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'},
    method='POST'
)

try:
    resp3 = urllib.request.urlopen(req3)
    print(f"\nStep 3 Status: {resp3.status}")
    result = resp3.read().decode()
    print(f"Response: {result[:800]}")
except urllib.error.HTTPError as e:
    print(f"\nStep 3 HTTP Error: {e.code}")
    error_body = e.read().decode()
    print(f"Response: {error_body[:800]}")
except Exception as e:
    print(f"\nStep 3 Error: {e}")
