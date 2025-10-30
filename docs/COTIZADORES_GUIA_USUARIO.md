# Guía de Usuario - Sistema de Cotizadores

**Versión:** 1.0  
**Fecha:** 30 de octubre de 2025

---

## 🎯 ¿Qué es el Sistema de Cotizadores?

El Sistema de Cotizadores permite a los clientes obtener cotizaciones y solicitar emisión de seguros de auto directamente desde el portal web, sin necesidad de contactar telefónicamente.

**Beneficios:**
- ✅ Cotización instantánea 24/7
- ✅ Comparación de múltiples aseguradoras
- ✅ Proceso 100% digital
- ✅ Sin llamadas ni reuniones presenciales

---

## 📱 Cómo Acceder

1. Inicia sesión en el portal
2. Ve al menú principal
3. Busca la sección "Cotizadores" o accede directamente a `/quotes`

---

## 🚗 MÓDULO 1: DAÑOS A TERCEROS

### ¿Qué es?

Seguro obligatorio que cubre:
- Lesiones corporales a terceros
- Daños a la propiedad de terceros
- Gastos médicos (según plan)
- Asistencia legal y vial (según plan)

**Ideal para:** Cumplir con requisitos legales al menor costo

### Paso a Paso

#### 1️⃣ **Seleccionar Cobertura**
- En la página principal, click en "Daños a Terceros"
- Verás las ventajas: cobertura legal, emisión inmediata, desde B/.115/año

#### 2️⃣ **Comparar Planes**
Verás 5 aseguradoras con 2 planes cada una:

**Desktop:** Tabla comparativa completa
```
┌────────────────────────────────────────┐
│ INTER | FEDPA | MAPFRE | ASSA | ANCÓN │
│ Básico Premium Básico Premium...      │
│ B/.154 B/.183  B/.115  B/.150 ...     │
│ ✓/✗ para cada cobertura                │
└────────────────────────────────────────┘
```

**Mobile:** Cards individuales para cada aseguradora
- Scroll vertical
- Toda la información visible
- Botones grandes táctiles

**Características a comparar:**
- ✅ = Cobertura incluida
- ❌ = No incluida
- Texto = Detalles específicos (ej: "Hasta B/.150")

#### 3️⃣ **Seleccionar Plan**

Click en "Seleccionar" del plan que prefieras.

**Si tiene cuotas disponibles:**
- Aparece modal automáticamente
- Muestra dos opciones:
  * Pago anual (precio estándar)
  * Pago en cuotas (precio total + detalle de cuotas)
- Click en la opción deseada

#### 4️⃣ **Llenar Formulario (3 Pasos)**

**Paso 1: Datos Personales** ⏱️ 3 min
- Nombre y apellido *
- Cédula o pasaporte *
- Fecha de nacimiento *
- Correo electrónico *
- Estado civil *
- Dirección de residencia *
- Ocupación (opcional)

**Paso 2: Datos del Vehículo** ⏱️ 3 min
- Número de placa *
- Marca * (dropdown con opciones comunes)
- Modelo *
- Año *
- Color *
- Tipo de transmisión * (Manual/Automático)
- Cantidad de ocupantes *
- Mes de renovación de placa *
- Número VIN (opcional)
- Número de motor (opcional)

**Paso 3: Datos del Conductor** ⏱️ 1-3 min
- Checkbox: "El conductor es el mismo que el contratante"
  * Si ✅ → Auto-completa todo
  * Si ❌ → Solicita:
    - Nombre del conductor *
    - Apellido *
    - Cédula *
    - Fecha de nacimiento *

**Indicador de progreso:**
```
[1✓]───[2]───[3]
```
- Verde = Completado
- Azul = Actual
- Gris = Pendiente

#### 5️⃣ **Enviar Solicitud**

Click en "Enviar Solicitud"

**Validaciones automáticas:**
- Todos los campos obligatorios (*) deben estar llenos
- Email válido
- Año del vehículo razonable
- Fechas de nacimiento válidas

#### 6️⃣ **Confirmación**

Verás pantalla de éxito con:
- ✅ Mensaje de confirmación
- 📋 Plan seleccionado
- 💰 Prima anual
- 📞 Próximos pasos

**Qué sigue:**
1. Asesor revisa tu solicitud (2-24 horas)
2. Recibes email de confirmación
3. Te contactan para coordinar pago
4. Emisión de póliza

**Tu solicitud ya está en el sistema** como caso "PENDIENTE_REVISION"

---

## 🛡️ MÓDULO 2: COBERTURA COMPLETA

### ¿Qué es?

Seguro completo que cubre:
- TODO lo de Daños a Terceros
- Daños propios por colisión
- Robo total del vehículo
- Incendio
- Fenómenos naturales

**Ideal para:** Protección total del vehículo

### Paso a Paso

#### 1️⃣ **Seleccionar Cobertura**
- En página principal, click en "Cobertura Completa"
- Verás que requiere cotización personalizada

#### 2️⃣ **Formulario de Cotización** ⏱️ 2 min

Datos simplificados:
- Nombre y apellido *
- Fecha de nacimiento *
- Estado civil *
- Suma asegurada del vehículo * (valor en B/.)
- Marca *
- Modelo *
- Año *

**⚠️ Nota:** Banner amarillo indica que las tarifas son preliminares (integración API en proceso)

#### 3️⃣ **Ver Resultados**

Recibes 5 cotizaciones:
```
┌────────────────────────────┐
│ 1. ASSA - B/.850/año      │
│    ✓ Recomendado           │
│    [Seleccionar]           │
├────────────────────────────┤
│ 2. ANCÓN - B/.920/año     │
│    [Seleccionar]           │
└────────────────────────────┘
```

**Incluyen:** Colisión • Robo • Incendio • Más

#### 4️⃣ **Seleccionar Aseguradora**

Click en "Seleccionar" de la opción preferida

#### 5️⃣ **Formulario Completo + Fotos**

**Parte 1: Formulario (igual que Daños a Terceros)**
- 3 pasos con todos los datos
- Validaciones automáticas
- Al finalizar → Pasa a Parte 2

**Parte 2: Fotos del Vehículo** ⏱️ 10 min

**6 fotos obligatorias:**

1. **Foto Frontal**
   - Vista completa del frente
   - Placa visible
   - Bien iluminada

2. **Foto Trasera**
   - Vista completa de atrás
   - Placa visible
   - Sin obstrucciones

3. **Foto Lateral Izquierda**
   - Lado izquierdo completo
   - Puertas y ventanas visibles
   - Desde frente hasta atrás

4. **Foto Lateral Derecha**
   - Lado derecho completo
   - Mismo criterio que izquierda

5. **Foto del Tablero**
   - Tablero de instrumentos
   - Kilometraje legible
   - Sin reflejos

6. **Foto Serial del Motor**
   - Número de serial visible
   - Enfocado y legible
   - Bajo el capó

**Requisitos técnicos:**
- Formato: JPG, PNG o WebP
- Tamaño máximo: 5MB por foto
- Resolución mínima: Suficiente para leer textos

**Cómo subir:**
1. Click en el cuadro de la foto
2. Selecciona imagen de tu dispositivo
3. Preview aparece automáticamente
4. Repite para las 6 fotos
5. Barra de progreso muestra avance

**Indicador:**
```
Fotos: [■■■■□□] 4/6
```

#### 6️⃣ **Enviar Solicitud Completa**

Botón se activa solo cuando:
- ✅ Formulario completo
- ✅ 6 fotos subidas

Click en "Enviar Solicitud"

#### 7️⃣ **Confirmación**

Pantalla de éxito similar a Daños a Terceros, pero:
- Menciona revisión de fotos
- Tiempo de respuesta: 24-48 horas
- Cotización final por correo

---

## 💡 CONSEJOS Y MEJORES PRÁCTICAS

### Para Mejores Fotos

1. **Iluminación**
   - Luz natural de día
   - Evita contra-luz
   - Sin sombras fuertes

2. **Encuadre**
   - Vehículo completo en imagen
   - Sin cortes
   - Placas y números legibles

3. **Limpieza**
   - Lava el vehículo si está muy sucio
   - Limpia parabrisas para foto del tablero
   - Motor sin exceso de polvo

4. **Técnica**
   - Sostén el teléfono firmemente
   - No uses zoom digital
   - Toma varias y elige la mejor

### Para Cotización Más Precisa

- **Suma asegurada:** Valor actual de mercado del vehículo
- **Año:** Año modelo, no año de compra
- **Datos reales:** Información precisa evita rechazos

### Errores Comunes a Evitar

❌ Email inválido → No recibirás confirmación
❌ Placas incorrectas → Retrasa emisión
❌ Fotos borrosas → Requiere reenvío
❌ VIN incorrecto → Problema en emisión
❌ Fecha de nacimiento errónea → Afecta prima

---

## 📊 COMPARACIÓN DE MÓDULOS

| Característica | Daños a Terceros | Cobertura Completa |
|----------------|------------------|-------------------|
| **Cotización** | Inmediata | Preliminar (API pendiente) |
| **Tiempo** | 10 min | 20 min |
| **Fotos** | No requeridas | 6 fotos obligatorias |
| **Emisión** | Rápida | Requiere inspección fotos |
| **Precio** | Desde B/.115/año | Desde B/.850/año |
| **Coberturas** | Básicas (legal) | Completas (todo riesgo) |
| **Inspección** | No | Sí (por fotos) |

---

## ❓ PREGUNTAS FRECUENTES

### General

**P: ¿Necesito tener cuenta para cotizar?**
R: Sí, debes iniciar sesión en el portal.

**P: ¿Puedo cotizar para alguien más?**
R: Sí, pero debes tener todos sus datos correctos.

**P: ¿Cuánto tarda la emisión?**
R: Daños a Terceros: 1-3 días. Cobertura Completa: 3-7 días.

**P: ¿Puedo cambiar de plan después?**
R: Sí, contacta a tu asesor para modificar.

### Daños a Terceros

**P: ¿Qué diferencia hay entre Básico y Premium?**
R: Premium tiene mayores límites de cobertura y servicios adicionales (grúa, asistencia vial).

**P: ¿El conductor debe ser el dueño?**
R: No, pero debes proporcionar datos del conductor habitual.

**P: ¿Puedo agregar más conductores después?**
R: Sí, consulta con tu aseguradora los costos adicionales.

### Cobertura Completa

**P: ¿Por qué necesitan fotos?**
R: Para verificar el estado actual del vehículo y evitar fraudes.

**P: ¿Qué pasa si mi vehículo tiene daños?**
R: Debes reportarlos. Los daños previos no son cubiertos.

**P: ¿Puedo tomar las fotos en cualquier momento?**
R: Sí, pero mejor con luz natural de día.

**P: ¿Qué pasa si rechazan las fotos?**
R: Te contactarán para que envíes nuevas fotos.

### Técnicas

**P: ¿Puedo guardar y continuar después?**
R: No actualmente. Completa todo en una sesión (próxima versión tendrá auto-guardado).

**P: ¿Qué navegadores funcionan?**
R: Chrome, Firefox, Safari, Edge (versiones recientes).

**P: ¿Funciona en móvil?**
R: Sí, completamente optimizado para móvil.

**P: ¿Puedo editar después de enviar?**
R: No, pero contacta inmediatamente a tu asesor para correcciones.

---

## 🆘 PROBLEMAS Y SOLUCIONES

### "No puedo subir fotos"

**Causas posibles:**
- Archivo muy grande (>5MB)
- Formato no soportado
- Conexión lenta

**Soluciones:**
1. Reduce tamaño de imagen antes de subir
2. Usa JPG en vez de PNG
3. Verifica tu conexión a internet
4. Intenta desde otro dispositivo

### "Formulario no avanza al siguiente paso"

**Causas:**
- Campos obligatorios vacíos
- Formato de datos incorrecto

**Soluciones:**
1. Revisa que todos los campos con * estén llenos
2. Verifica formato de email
3. Revisa que fechas sean válidas
4. Mira si hay mensajes de error en rojo

### "No recibí confirmación"

**Soluciones:**
1. Revisa carpeta de spam
2. Verifica que el email ingresado sea correcto
3. Contacta soporte con tu número de referencia
4. Espera 24 horas antes de preocuparte

### "El precio es diferente al mostrado"

**Razones:**
- Cotización Cobertura Completa es preliminar
- Inspección reveló información adicional
- Datos proporcionados incompletos

**Acción:**
Habla con tu asesor para entender las diferencias

---

## 📞 CONTACTO Y SOPORTE

**Si tienes problemas técnicos:**
- Email: soporte@portal.com
- Teléfono: +507 XXXX-XXXX
- Horario: Lunes a Viernes 8am - 5pm

**Si tienes dudas sobre tu cotización:**
- Tu asesor asignado te contactará
- O llama al número arriba

**Emergencias:**
- Fuera de horario: +507 XXXX-XXXX (emergencias)

---

## 🎉 CONCLUSIÓN

El Sistema de Cotizadores te permite:
- ✅ Comparar múltiples opciones en minutos
- ✅ Solicitar emisión 24/7 desde cualquier lugar
- ✅ Proceso digital sin papeleos

**Tiempo total:**
- Daños a Terceros: ~10 minutos
- Cobertura Completa: ~20 minutos

**¡Empieza ahora!** → `/quotes`

---

**Versión del documento:** 1.0  
**Última actualización:** 30 de octubre de 2025  
**Próxima revisión:** Cuando se integren APIs reales
