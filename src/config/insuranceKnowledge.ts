/**
 * Insurance Knowledge Base — Líderes en Seguros
 * ===============================================
 * Extraído y estructurado a partir de las Condiciones Generales oficiales de 19 PDFs.
 * Actualizado: Abril 2025
 *
 * REGLAS DE NEGOCIO INAMOVIBLES:
 * 1. AUTO: Solo 4 aseguradoras oficiales → Ancón, Internacional, La Regional, FEDPA
 * 2. VIDA: EXCLUSIVAMENTE ASSA. Solo 4 planes: Término Nivelado, Universal I, Universal II, Patrimonial II.
 *    PROHIBIDO dar respuestas genéricas de vida o inventar planes.
 * 3. INCENDIO/MULTIRRIESGO: Condiciones de Ancón como base representativa.
 *    "Incendio" (estructura) ≠ "Multirriesgo/Contenido/Hogar" (bienes muebles).
 * 4. OTRAS ASEGURADORAS: Si el cliente pregunta por producto/aseguradora no en esta base →
 *    "Para darte una asesoría exacta sobre esa aseguradora, por favor envíame el documento PDF
 *     de tus Condiciones Generales y con gusto te aclaro cualquier duda."
 */

export const INSURANCE_KNOWLEDGE_PROMPT = `
<base_de_conocimientos_seguros>
════════════════════════════════════════════════════════════
BASE DE CONOCIMIENTOS — CONDICIONES GENERALES OFICIALES
Fuente: Documentos PDF oficiales de aseguradoras. Vigente a Abril 2025.
════════════════════════════════════════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN AUTO — COBERTURAS ESTÁNDAR (4 ASEGURADORAS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REGLA: Solo manejamos 4 aseguradoras para auto: Ancón, Internacional, La Regional y FEDPA.

## Coberturas del Mercado (nomenclatura uniforme A–G)
Todas las aseguradoras ofrecen las siguientes coberturas (se activan solo si se contratan en Condiciones Particulares):

A) RC LESIONES CORPORALES: Paga lo que el asegurado sea civilmente obligado a pagar por lesiones/muerte de terceros. NO cubre al propio asegurado, parientes que conviven, empleados ni ocupantes del vehículo asegurado.

B) RC DAÑOS A PROPIEDAD AJENA: Paga daños a bienes de terceros. Excluye: bienes del asegurado, bienes de familiares que conviven, bienes transportados por el vehículo.

A+B) LÍMITE ÚNICO COMBINADO (LUC): Suma única máxima por accidente que cubre A y B combinadas.

C) GASTOS MÉDICOS: Paga gastos razonables (médicos, quirúrgicos, ambulancia, hospital, funerarios) para personas lesionadas en el vehículo asegurado. Plazo: dentro de 1 año del accidente.

D) COMPRENSIVO: Cubre pérdida/daño al vehículo por incendio, rayo, hurto/robo, terremoto, derrumbe, erupción volcánica, vendaval, tornado, inundación, explosión, desórdenes públicos, daños por maldad, caída de objetos e impacto de proyectiles. NO incluye colisión ni vuelco.

E) COLISIÓN O VUELCO: Cubre daños al vehículo por colisión con otro vehículo/objeto, o vuelco. NO incluye objetos que caigan sobre el vehículo (eso es Comprensivo).

→ Recordatorio: Comprensivo = te roban o fenómenos naturales. Colisión = chocas. Son coberturas distintas.

F) INCENDIO O RAYO (cobertura reducida): Solo cubre pérdida/daño directamente causado por incendio o rayo. Sin comprensivo ni colisión.

G) ROBO O HURTO: Cubre pérdida del vehículo por robo/hurto y daños con que aparezca tras el robo. NO cubre accesorios especiales (radios, rines de lujo, A/C, lonas) salvo que se declaren y paguen por separado.

## Condiciones comunes a todas las aseguradoras de auto:
- Deducible: siempre fijado en Condiciones Particulares. El asegurado lo paga antes de recibir indemnización.
- Período de gracia: ~30 días después del vencimiento (confirmar por aseguradora).
- Territorio: República de Panamá (extensión a Costa Rica disponible via endoso).
- Pérdida total: se considera cuando los daños superan el % del valor asegurado establecido en póliza.

## ASEGURADORA ANCÓN — Detalles específicos
Documento base: Condiciones Generales AU-1097 (actualizado mayo 2023).
- Cancelación por la compañía: 10 días hábiles de anticipación; prima devuelta a prorrata.
- Cancelación por el asegurado: en cualquier momento; prima a corto plazo (no a prorrata).
- En pérdida total o total convenida: prima totalmente devengada, sin devolución. Asegurado entrega póliza + título; salvamento pasa a la compañía.

## ASEGURADORA INTERNACIONAL — Detalles específicos
Documento base: Código 030-00001-0001/2017.
- Incluye cobertura SOBAT integrada en la póliza.
- Automóvil sustituto ocasional: coberturas A, B y C se aplican a auto sustituto (que no sea del asegurado ni cónyuge) mientras el vehículo principal esté en reparación/pérdida.
- FUD: Formato Único y Definitivo se reconoce como documento válido para determinar responsabilidad.

## LA REGIONAL DE SEGUROS — Detalles específicos
Documento base: 2013-LRDS-AUTO.
- La compañía NO paga si el asegurado fue privado del vehículo por robo, hurto o apropiación indebida.
- RC Daños Propiedad: excluye daños a vehículos de empleados, daños previsibles por el giro del negocio, honorarios de abogados asumidos por cuenta propia.

## FEDPA — Detalles específicos
- Condiciones generales estándar del mercado panameño.
- Amplia variedad de endosos/paquetes (ver sección Endosos).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN VIDA — EXCLUSIVAMENTE ASSA (4 PLANES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REGLA CRÍTICA: Somos EXCLUSIVOS de ASSA en Vida. SOLO existen estos 4 planes. PROHIBIDO inventar planes, mencionar otras aseguradoras de vida, ni dar respuestas genéricas. Toda consulta de vida = uno de estos 4 planes.

## CONCEPTO FUNDAMENTAL — OPCIONES DE BENEFICIO POR FALLECIMIENTO (aplica a Universal I, Universal II y Patrimonial II):
Los tres planes universales pueden configurarse bajo DOS opciones de beneficio por fallecimiento. Son opciones de configuración, NO son planes distintos:
- OPCIÓN A: El valor acumulado (ahorro) ya está INCLUIDO dentro de la suma asegurada que se paga al fallecer. La compañía paga la Suma Asegurada total; el ahorro es la porción del cliente dentro de ese monto, y la compañía cubre el "riesgo neto" (la diferencia).
- OPCIÓN B: Se paga la Suma Asegurada MÁS el valor acumulado (ahorro) de forma SEPARADA. Los beneficiarios reciben ambos montos sumados.
ADVERTENCIA CRÍTICA: La diferencia entre Opción A y Opción B NO es la diferencia entre Universal I y Universal II. Son conceptos distintos. No confundir.

## Plan 1: VIDA A TÉRMINO NIVELADO (ASSA Term Plus)
Registro: Resolución DRLA-012 del 13 de marzo de 2024. Código TN-2.12.03-REV.11.2023.
- Naturaleza: Seguro de vida puro a plazo fijo. SIN componente de ahorro. SIN valor de rescate.
- Prima: Nivelada (no cambia) durante todo el plazo contratado. Si sobrevives al plazo, no hay devolución.
- Ideal para: Protección pura al menor costo. Personas que quieren el mayor beneficio de muerte por el menor precio.
- Privilegio de conversión: Se puede convertir a un plan permanente sin nuevo examen médico.
- Disputabilidad: Los primeros 2 años la compañía puede disputar la póliza por falsedad en declaraciones.
- Suicidio: Excluido en los primeros 2 años; cubierto a partir del tercer año.
- Beneficiarios: Asegurado puede cambiarlos en cualquier momento (salvo beneficiario irrevocable). Si el beneficiario muere antes, el capital va a los herederos legales del asegurado.
- Documentos en siniestro: Certificado de defunción + información médica de la causa de muerte + póliza original.

## Plan 2: UNIVERSAL I (Plan ASSA Universal)
Registro: NoAU 15.05.04.
- Naturaleza: Vida universal con componente de ahorro (valor acumulado). Configurable bajo Opción A u Opción B (ver concepto fundamental arriba).
- DIFERENCIA CLAVE vs Universal II — CLÁUSULA DE MADURACIÓN A LOS 95 AÑOS: Si el asegurado llega con vida a los 95 años, ASSA le paga en vida la suma asegurada más el valor acumulado, y la póliza se cancela automáticamente. Este es un beneficio en vida que no tiene el Universal II.
- IMPACTO EN COSTO: La cláusula de maduración hace que el costo de seguro del Universal I sea más alto que el del Universal II. Consecuencia: si un cliente paga la misma prima mensual en ambos planes, el Universal I generará MENOS ahorro acumulado a largo plazo, porque una mayor porción de la prima se destina al costo del seguro.
- Tasa de interés garantizada: mínimo 3.5% anual sobre el valor acumulado.
- Tasa corriente: puede ser mayor a la garantizada según las inversiones de ASSA.
- Rescate parcial: Disponible hasta el valor de rescate menos $1,000.00.
- Cargo por rescate: Se aplica durante los primeros 10 años.
- Primas flexibles: Prima mínima o depósitos adicionales en cualquier momento.
- Deducción mensual del valor acumulado: costo de mortalidad + cargos sobre prima + cargo por derecho de póliza.
- Préstamos: disponibles sobre el valor de rescate.

## Plan 3: UNIVERSAL II
Registro: AUII 15.05.07.
- Naturaleza: Vida universal con componente de ahorro (valor acumulado). Configurable bajo Opción A u Opción B (ver concepto fundamental arriba).
- DIFERENCIA CLAVE vs Universal I: El Universal II NO tiene cláusula de maduración a los 95 años. No existe un pago garantizado en vida al llegar a esa edad. El seguro simplemente vence.
- IMPACTO EN COSTO: Al no tener la cláusula de maduración, el costo de seguro del Universal II es más bajo que el del Universal I. Consecuencia: con la misma prima mensual, el Universal II acumula MÁS ahorro a largo plazo que el Universal I.
- Tasa de interés garantizada: mínimo 3.5% anual sobre el valor acumulado.
- Rescate parcial: Hasta el valor de rescate menos $1,000.00.
- Cargo por rescate: Primeros 10 años.
- Vencimiento: Al cumplir 95 años.
- Primas flexibles: Prima mínima + depósitos adicionales en cualquier momento.

## Plan 4: PATRIMONIAL II
Registro: APII 15.05.07.
- Naturaleza: Vida universal con mayor énfasis en ahorro/inversión. Configurable bajo Opción A u Opción B.
- Tasa de interés garantizada: mínimo 4.5% anual (la más alta de los 3 planes universales).
- Ideal para: Acumulación de patrimonio + protección. El plan más orientado al ahorro a largo plazo.
- Rescate parcial: Hasta el valor de rescate menos $2,500.00 (umbral más alto que Universal I y II).
- Cargo por rescate: Primeros 10 años.
- Vencimiento: Al cumplir 95 años.
- Primas flexibles: Prima mínima + depósitos adicionales.

## Características comunes a los 3 Planes Universales (I, II, Patrimonial II):
- Disputabilidad: Primeros 2 años.
- Suicidio: Excluido en los primeros 2 años.
- Condiciones preexistentes: Excluidas — enfermedades conocidas antes del inicio de la cobertura.
- Préstamos: Disponibles sobre el valor de rescate.
- Exámenes médicos: Requeridos antes de otorgar cobertura.

## Tabla comparativa de los 4 planes ASSA:
| Plan             | Ahorro | Tasa garantizada | Cláusula maduración 95 años | Rescate parcial mín.  | Ideal para                          |
|------------------|:------:|:----------------:|:---------------------------:|:---------------------:|-------------------------------------|
| Término Nivelado | No     | N/A              | No                          | N/A (sin valor)       | Protección pura, menor costo        |
| Universal I      | Sí     | 3.5%             | SÍ — paga SA + ahorro en vida | Valor rescate -$1,000 | Protección + pago garantizado a 95  |
| Universal II     | Sí     | 3.5%             | No                          | Valor rescate -$1,000 | Mayor ahorro acumulado a igual prima |
| Patrimonial II   | Sí     | 4.5%             | No                          | Valor rescate -$2,500 | Máximo ahorro / patrimonio           |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN INCENDIO / MULTIRRIESGO (BASE: ANCÓN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DISTINCIÓN CRÍTICA: Son dos productos distintos. Siempre aclarar cuál necesita el cliente.
→ INCENDIO = asegura la ESTRUCTURA / EDIFICIO / INMUEBLE (las paredes, el techo, la construcción).
→ MULTIRRIESGO / CONTENIDO / HOGAR = asegura los BIENES MUEBLES dentro (muebles, equipos, electrodomésticos, mercancía, enseres).

## INCENDIO (Estructura / Edificio) — Condiciones Ancón
¿Qué cubre?
- Destrucción o daño material al inmueble/estructura causado por: incendio directo, rayo que caiga sobre los bienes, y esfuerzos para controlar un siniestro amparado (ej: daño por agua al apagar el fuego).

¿Qué NO cubre?
- Energía atómica/nuclear.
- Explosión (EXCEPCIÓN: aparatos domésticos a gas sí están cubiertos).
- Terremoto, temblor, erupción volcánica u otra convulsión de la corteza terrestre.
- Guerra, revolución, terrorismo, desórdenes públicos.
- Actos fraudulentos o criminales del asegurado.
- Corrientes eléctricas que dañen aparatos eléctricos (EXCEPCIÓN: si generan incendio, cubre el daño del incendio resultante — no el equipo eléctrico en sí).
- Bienes robados.
- Pérdidas consecuentes: interrupción del negocio, pérdida de utilidades, daño por falta de refrigeración.
- Si el edificio se hunde, raja o desploma (cobertura se suspende automáticamente).

Bienes NO asegurables bajo Incendio:
- Planos, patrones, manuscritos, moldes, modelos.
- Dinero, timbres, estampillas, documentos, libros de comercio.
- Piedras de joyería sueltas, perlas no engarzadas.
- Obras de arte/objetos raros en exceso de B/.300.00.

Cálculo de indemnización (Incendio):
La compañía paga el menor de: (a) valor real efectivo al momento del siniestro, (b) costo de reposición menos depreciación, (c) monto de pérdida sufrida, (d) límite de responsabilidad de la póliza.

REGLA DEL 80% (Coaseguro): Si el valor asegurado es menor al 80% del valor real de los bienes antes del siniestro, el asegurado se convierte en co-asegurador proporcional de la diferencia. Importante: asegurar al valor real para evitar esta penalización.

Plazo de notificación: 30 días calendarios siguientes al siniestro.

## MULTIRRIESGO / CONTENIDO / HOGAR (Ancón Plus - MR-COM-AA-2021)
¿Qué cubre?
- Bienes muebles, enseres, equipos de oficina, equipo electrónico, maquinarias, mobiliario, artículos de decoración, mercancía propia/en comisión dentro del local/negocio.
- Coberturas básicas: incendio y rayo sobre el CONTENIDO + múltiples riesgos adicionales (robo, daño por agua, RC, etc. según el condicionado específico contratado).

Vigencia y pago:
- Período de gracia: 30 días para fracciones de prima subsiguientes.
- Mora más de 30 días: cobertura suspendida hasta 60 días.
- Falta de pago de primera fracción: nulidad absoluta del contrato desde el inicio.
- Cancelación por compañía: 15 días de aviso escrito + devolución prima proporcional.
- Cancelación por asegurado: prima a corto plazo.

## Recomendación de asesoría:
Si el cliente dice "quiero asegurar mi casa" o "quiero un seguro del hogar": SIEMPRE preguntar si quiere asegurar la ESTRUCTURA (Incendio), el CONTENIDO/muebles (Multirriesgo/Hogar), o ambos. Son productos distintos con pólizas separadas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOAT — SEGURO OBLIGATORIO BÁSICO DE ACCIDENTES DE TRÁNSITO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Marco legal: Ley 68 de 13 de diciembre de 2016. Obligatorio para todo vehículo motorizado en Panamá.
Disponible en: Ancón y FEDPA (entre otras). Los límites son iguales en todas (los fija la ley).

¿Qué cubre?
Responsabilidad Civil hacia TERCEROS AFECTADOS (personas externas al vehículo asegurado) por:
- Muerte, lesiones corporales (incapacidad parcial temporal, incapacidad permanente).
- Daños a la propiedad ajena.
Solo aplica si el responsable es el contratante/asegurado/conductor.

Límites obligatorios (Art. 236 Reglamento de Tránsito):
- Lesiones corporales: B/.5,000 por persona / B/.10,000 por evento.
- Daños a propiedad ajena: B/.5,000 por evento.
El pago de una indemnización NO reduce las sumas; se mantienen vigentes toda la póliza.

Quién NO es "Tercero Afectado" (no puede cobrar por SOAT):
- Ocupantes del propio vehículo asegurado.
- Parientes hasta 4to grado de consanguinidad / 2do de afinidad del contratante/conductor.
- Convivientes del contratante/conductor.

Cómo funciona en un accidente:
1. Accidente menor → llenar FUD (Formato Único y Definitivo) entre las partes.
2. Accidente mayor o heridos → llamar a Tránsito para resolución de autoridad competente.
3. El tercero afectado presenta el reclamo a la aseguradora con FUD o resolución en firme.
4. La aseguradora indemniza hasta los límites legales.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENDOSOS / PAQUETES ADICIONALES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ANCÓN — ENDOSO EXTRA PLUS 2025
Base: Póliza de autos particulares Ancón (AU-1097).
Beneficios principales:
- Sin depreciación para autos NUEVOS: durante los primeros 24 MESES (2 años) desde la compra. Requiere proforma del vehículo nuevo. (Nota: 24 meses es más largo que las demás aseguradoras que ofrecen solo 12 meses)
- Muerte accidental: B/.5,000/persona y B/.25,000/accidente. Adelanto funerario: hasta B/.2,000 (se deduce del beneficio de muerte).
- Alquiler de auto: Colisión hasta 15 días; Robo hasta 30 días; Comprensivo hasta 5 días. Autos ≤B/.31,999 → modelo económico; ≥B/.32,000 → SUV o Standard.
- Grúa/Ancón Asistencia Plus por antigüedad: 0–4 años: 4 eventos/año; 5–6 años: 3 eventos; 7–10 años: 2 eventos (1 colisión + 1 avería); +10 años: 1 evento. Hasta B/.150/evento + maniobra.
- Efectos personales: hasta B/.300/evento.
- RC auto sustituto (dentro de Panamá).
- Cobertura extraterritorial Costa Rica: 30 días, previa notificación.
- Defensa penal + asistencia legal.
- Reembolso 100% del deducible en no culpabilidad (requiere resolución en firme o FUD original con ambas partes identificadas + confirmación de cobertura de la otra aseguradora).
- Descuento deducible colisión/vuelco: 50% si la conductora es dama al momento del accidente; 20% si el conductor es varón ≥35 años.
- Exoneración del deducible si no hubo reclamo en vigencia anterior (colisión con otro vehículo, 1 evento/año, solo pérdidas parciales, con FUD original).
- Pérdida de efectos personales hasta B/.300/evento.
- Set de palos de golf: hasta B/.250/evento.
- RC para remolques pequeños.

## INTERNACIONAL — ENDOSO PLUS (Básico)
Base: Póliza auto Cía. Internacional. Asistencia: 265-2881 / 6666-2881 (WhatsApp).
- Sin depreciación en autos nuevos: primer AÑO únicamente.
- Muerte accidental: B/.10,000 a herederos/beneficiarios.
- Alquiler por robo: 30 días (desde 72 horas de notificación). Por colisión: 10 días.
- Grúa y auxilio vial: B/.150/año, máx. 3 eventos (avería + colisión).
- Efectos personales: B/.100/año (excluye dinero, joyas, valores).
- Reembolso 100% deducible colisión si conductor declarado inocente (30 días para reembolsar).
- Descuento 50% deducible colisión para damas conductoras.
- Adelanto gastos médicos hospitalización: B/.500/persona (conductor + máx. 6 ocupantes).
- RC auto sustituto.
- Ambulancia Grupo Vive (Ciudad de Panamá).
- Defensa penal (B/.500 si asegurado elige abogado; ilimitada si lo asigna la compañía).

## INTERNACIONAL — ENDOSO PLUS CENTENARIO (Premium)
Base: Póliza auto Cía. Internacional.
- Sin depreciación en autos nuevos: primer AÑO.
- Muerte accidental: B/.15,000 (la más alta entre todos los endosos del mercado).
- Adelanto funerario: hasta B/.1,500 conductor + B/.500/pasajero (máx. 4 pasajeros).
- Alquiler por robo: 30 días (+ 10 días extra si aparece en mal estado). Por colisión: 15 días.
- Efectos personales: B/.350/año (la más alta entre los endosos).
- Grúa: B/.150/año, varios eventos.
- Reembolso 100% deducible colisión si declarado inocente + sin reclamo previo.
- Descuento deducible: 50% para damas; hasta 10% si no hubo reclamo anterior; 20% en robo si tiene GPS.
- Cobertura extraterritorial Costa Rica: 30 días (3 días hábiles de notificación anticipada).
- Gastos médicos extensivos: asegurado + cónyuge + hijos <25 años que convivan, en otro vehículo de 4 ruedas.
- Hospedaje/transporte si el incidente ocurre a +30 km del domicilio.
- Asistencia Express (inspector en escena) + Auxilio Vial.

## FEDPA — ENDOSO PORCELANA (Premium)
Base: Autos particulares FEDPA. Costo del endoso: B/.60.00 + 6% impuesto. Asistencia: 303-2466 / 265-8255.
- Sin depreciación en autos 0 km: durante el PRIMER AÑO, por pérdida total (robo, colisión, vuelco, incendio).
- Inspector in situ 24h: sin límite de eventos.
- Grúa por colisión/vuelco: sin límite de eventos/año. Por avería: hasta B/.150/año.
- Muerte accidental conductor: B/.5,000.
- Alquiler por robo total: reembolso B/.20/día hasta 30 días (máx. B/.600) o alquiler directo. Por colisión: hasta 15 días (SUV si vehículo ≥B/.30,000 o 4x4).
- Efectos personales: hasta B/.300/evento (requiere factura de adquisición + denuncia).
- Defensa Penal: hasta B/.2,000.
- Cobertura CR: 30 días (3 días de anticipación).
- Atención expedita en un solo taller (sin necesidad de 3 cotizaciones, salvo pérdida total).
- Reembolso 100% deducible en no culpabilidad.

## FEDPA — ENDOSO FULL EXTRAS
Base: Autos particulares FEDPA con cobertura COMPLETA únicamente.
- Inspector in situ 24h: sin límite.
- Grúa por colisión/vuelco: sin límite de eventos. Por avería: hasta B/.150/año.
- Sin depreciación 0 km: primer año por pérdida total.
- Muerte accidental conductor: B/.5,000.
- Alquiler por robo total: B/.20/día hasta 30 días (máx. B/.600). Por colisión: hasta 10 días (sedan compacto).
- Efectos personales: hasta B/.100/evento.
- Defensa Penal: hasta B/.2,000.
- Cobertura CR: 30 días.
- Ambulancia 24/7.

Diferencia Porcelana vs Full Extras: Porcelana (B/.300 efectos, 15 días alquiler colisión) > Full Extras (B/.100 efectos, 10 días alquiler colisión). Ambos $5,000 muerte accidental.

## FEDPA — ENDOSO FAP (Solo para Daños a Terceros)
Base: Solo para pólizas FEDPA de Daños a Terceros. Asistencia: 303-2466 / WhatsApp 6380-8722.
- Inspección in situ.
- Ambulancia: hasta US$200/año, sin límite de eventos (Ciudad de Panamá + Colón Metro).
- Grúa por accidente: hasta US$100/año, máx. 1 evento.
- Auxilio vial (cambio llanta, corriente, combustible): hasta US$100/evento, 1 evento/año.
- Cerrajería: hasta US$80, 1 evento/año.
LIMITACIÓN: Solo asistencia. NO incluye alquiler, muerte accidental ni efectos personales.

## FEDPA — ENDOSO VIP / FAVIP (Solo para Daños a Terceros)
Base: Solo para pólizas FEDPA de Daños a Terceros. Asistencia: 303-2466 / WhatsApp 6380-8722.
- Todo lo del FAP PLUS:
- Grúa mejorada: hasta US$150/año, 2 eventos (1 accidente + 1 avería). FAP solo 1 evento.
- Asistencia médica telefónica 24 horas: sin límite económico, sin límite de eventos. Único endoso de terceros con este beneficio.

## FEDPA — PACK COMERCIAL (Vehículos comerciales)
Base: Vehículos comerciales con Daños a Terceros Y/O cobertura completa. Asistencia: 340-5400 / WhatsApp 6320-8722.
- Grúa: hasta US$150/evento, 2 eventos/año (accidente + avería), dentro de 48 horas.
- Auxilio vial: hasta US$150/evento, 1 evento/año.
- Asistencia médica telefónica 24h: sin límite.
- Llamadas nacionales e internacionales ilimitadas gratuitas relacionadas con siniestros.
- Inspector in situ.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TABLA COMPARATIVA DE ENDOSOS (RESUMEN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Beneficio                  | Ancón ExtraPlus | Intl Plus | Intl Plus Centenario | FEDPA Porcelana | FEDPA Full Extras |
|----------------------------|:---------------:|:---------:|:--------------------:|:---------------:|:-----------------:|
| Sin depreciación 0km       | 24 meses        | 12 meses  | 12 meses             | 12 meses        | 12 meses          |
| Muerte accidental          | $5,000/$25,000  | $10,000   | $15,000              | $5,000          | $5,000            |
| Alquiler robo              | 30 días         | 30 días   | 30 días              | 30 días/$600    | 30 días/$600      |
| Alquiler colisión          | 15 días         | 10 días   | 15 días              | 15 días         | 10 días           |
| Efectos personales         | $300/evento     | $100/año  | $350/año             | $300/evento     | $100/evento       |
| Cobertura Costa Rica       | 30 días         | No        | 30 días              | 30 días         | 30 días           |
| Defensa penal              | Sí              | $500-ilim | Sí                   | $2,000          | $2,000            |
| Asistencia médica tel. 24h | No              | No        | No                   | No              | No                |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLA: ASEGURADORAS O PRODUCTOS FUERA DE ESTA BASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Si el cliente pregunta por una aseguradora o producto que NO está en esta base de conocimientos (por ejemplo: Mapfre, SURA, Banistmo Seguros, Sagicor, General de Seguros, PALIC, Mundial, ACE, u otras), la respuesta obligatoria es:

"Para darte una asesoría exacta sobre esa aseguradora, por favor envíame el documento PDF de tus Condiciones Generales y con gusto te aclaro cualquier duda."

PROHIBIDO inventar coberturas, deducibles ni condiciones para productos no documentados en esta base.

════════════════════════════════════════════════════════════
FIN BASE DE CONOCIMIENTOS — CONDICIONES GENERALES
════════════════════════════════════════════════════════════
</base_de_conocimientos_seguros>`;
