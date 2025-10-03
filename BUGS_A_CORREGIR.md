# BUGS A CORREGIR URGENTE

## ✅ COMPLETADOS
1. ✅ SQL brokers: campos bancarios (tipo_cuenta, numero_cuenta, numero_cedula, nombre_completo)
2. ✅ CSV Banco General con headers correctos
3. ✅ Adelantos: agregar filtro por año
4. ✅ Etiquetas Filtrar: diseño arreglado
5. ✅ Import aseguradoras: acepta .xls

## 🔴 PENDIENTES URGENTES

### 6. Request Auth: Wizard 3 pasos
- **Paso 1**: Email + Contraseña (auth.users)
- **Paso 2**: Datos personales (cedula, fecha_nacimiento, telefono, licencia)
- **Paso 3**: Datos bancarios (tipo_cuenta, numero_cuenta, numero_cedula, nombre_completo)
- Checkbox "ayuda a llenar" para no repetir datos
- Master acepta → trigger crea profiles + brokers

### 7. Ajustes: CSV + botón Pagados
- Agregar botón "Descargar CSV Banco"
- Agregar botón "Marcar como Pagados"
- Los marcados pasan a tabla de pagados

### 8. Comisiones: Eliminar no funciona
- actionDeleteImport debe funcionar (revisar conexión frontend)
- actionDeleteDraft debe funcionar (revisar conexión frontend)
- Verificar que los botones llamen correctamente

### 9. Adelantos: No se muestran en pantalla
- actionGetAdvances funciona pero componente no muestra
- Revisar render en AdvancesTab.tsx
- Verificar que datos llegan correctamente

### 10. Pendientes sin identificar: No aparecen
- Al importar reportes, no se muestran pendientes
- Revisar actionGetPendingGroups
- Verificar que query trae broker_id = NULL

### 11. Cheques Import Historial: No detecta
- parseBankHistoryXLSX funciona
- Componente no muestra preview
- Revisar estado en ImportBankHistoryModal.tsx

### 12. Registro Pagos Pendientes: No funciona
- actionCreatePendingPayment debe funcionar
- actionMarkPaymentsAsPaidNew debe funcionar
- Revisar conexión con wizard

### 13. Dashboard Broker: Gráficas y calendario
- Alinear tamaño de gráficas ASSA/Convivio
- Calendario debe mostrar eventos
- Mock data debe funcionar

### 14. Trigger temp_client_imports: No copia
- Verifica que broker_email sea válido
- Verifica que insurer_name exista
- Trigger no está eliminando después de procesar

## ORDEN DE PRIORIDAD
1. Eliminar imports/borrador (8)
2. Mostrar adelantos (9)
3. Pendientes sin identificar (10)
4. Request Auth Wizard (6)
5. Ajustes CSV (7)
6. Cheques import (11)
7. Registro pagos (12)
8. Dashboard (13)
9. Trigger temp (14)
