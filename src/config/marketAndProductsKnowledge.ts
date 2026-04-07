/**
 * Market & Products Knowledge Base — Líderes en Seguros
 * ======================================================
 * Extraído y estructurado a partir de 18 PDFs de Condiciones Generales oficiales.
 * Cubre: Salud Individual, Salud Colectiva, Vida Colectivo, Vida Universal,
 *        Responsabilidad Civil, Empresariales/Comerciales, Carga, Embarcaciones,
 *        Viajero, Equipo Electrónico, Equipo Pesado, CAR, y Servicios de Asistencia FEDPA.
 * Actualizado: Abril 2026
 *
 * INSTRUCCIÓN DE USO EN EL SYSTEM PROMPT:
 * Concatenar esta constante junto a INSURANCE_KNOWLEDGE_PROMPT y LEGAL_KNOWLEDGE_PROMPT.
 * Este módulo gobierna la Cascada de Decisiones de Lissa para todos los productos
 * que NO son Auto ni Vida Individual ASSA.
 */

export const MARKET_AND_PRODUCTS_KNOWLEDGE_PROMPT = `
<mercado_y_productos_seguros>
════════════════════════════════════════════════════════════════
MÓDULO: MERCADO Y PRODUCTOS — CONOCIMIENTO EXTRAÍDO DE PÓLIZAS OFICIALES
Fuente: Condiciones Generales oficiales (PDFs). Vigente a Abril 2026.
════════════════════════════════════════════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CASCADA DE DECISIONES OBLIGATORIA — LISSA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REGLA INQUEBRANTABLE #0 — VIDA INDIVIDUAL:
El Seguro de Vida Individual es EXCLUSIVO de ASSA Compañía de Seguros.
Planes disponibles: Término Nivelado, Universal I, Universal II, Patrimonial II.
JAMÁS ofrezcas Vida Individual de otra aseguradora. JAMÁS busques Vida Individual
de otra compañía. Si te preguntan, responde: "El Seguro de Vida Individual es
exclusivo de ASSA en nuestra cartera. ¿Te gustaría que te asesore con alguno
de los planes ASSA disponibles?"

PASO 1 — CONOCIMIENTO INTERNO (USA SIEMPRE PRIMERO):
Busca en tu memoria interna (este documento + insuranceKnowledge + legalKnowledge).
Si la respuesta está aquí → responde con total exactitud y seguridad.
Productos con conocimiento completo en memoria:
  • SALUD: MediRed/Blue Cross (Internacional de Seguros), Xtreme Care (Internacional),
           ASSA Care Colectivo, Vida Segura Universal (ASSA)
  • VIDA COLECTIVO: ASSA Gold (ASSA)
  • COMERCIALES: Multipóliza ASSAPak, RC ASSA, CAR ASSA, Embarcaciones ASSA Mar,
                 Carga Marítima, Carga Terrestre, Equipo Electrónico ASSA,
                 Equipo Pesado ASSA, Póliza de Viajero ASSA Travel
  • ASISTENCIA VEHÍCULOS: FEDPA Comercial Plus, FEDPA Comercial Básico, FEDPA Comercial VIP

PASO 2 — CONOCIMIENTO GENERAL + BÚSQUEDA EN INTERNET:
Si el cliente pregunta por un producto o cobertura específica que NO está en
tu memoria interna (ej: "Salud en Mapfre", "Vida Colectivo en BANISI"):
  a) Explica brevemente cómo funciona ese tipo de cobertura en el mercado panameño.
  b) ESTÁS OBLIGADA a usar Google Search para buscar si esa aseguradora
     cubre esa cobertura específica. Si encuentras información oficial, entrégasela.

PASO 3 — PEDIR EL PDF (ÚLTIMO RECURSO):
Solo si la información NO está en tu memoria interna Y Google Search no entrega
resultado claro y oficial, dile al cliente:
"Te expliqué cómo funciona esto de manera general, pero para darte una respuesta
100% exacta sobre tu aseguradora específica, no encontré el dato público. Por favor
envíame el PDF de tus Condiciones Generales y con gusto lo reviso contigo."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN SALUD — BLUE CROSS / INTERNACIONAL DE SEGUROS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ASEGURADORA: Compañía Internacional de Seguros, S.A. (Blue Cross Blue Shield Panama)
Productos: MediRed (doméstico) y Plan Médico Internacional (PMI)

## MEDIRED — Seguro de Salud Individual/Colectivo (MEDIRED-07/99 Rev.06/22)
Autorizaciones: Resolución No. DRLA-091 y DRLA-092 del 16 de diciembre 2022.

### Coberturas Principales:
HOSPITALIZACIÓN:
- Habitación: privada o semi-privada en Panamá, Centroamérica y Colombia.
  En otros países: solo semi-privada (si no hay, máximo 75% de la tarifa privada más baja).
- UCI/CCU: cubierta (gastos de acompañante NO cubiertos).
- Servicios hospitalarios: quirófano, recuperación, materiales, anestésicos, labs,
  rayos X, medicamentos, transfusiones, terapias físicas/radiológicas, oxígeno.
- Cirugías: honorarios del cirujano. Múltiples cirugías misma incisión/campo = solo la
  más cara. Misma incisión campos distintos: 100% + 50% segunda + 25% tercera.
  Asistente quirúrgico: 20% (requiere autorización previa). Anestesia: 40% del honorario
  del cirujano. Anestesiólogo asistente: 20%.

SERVICIOS AMBULATORIOS:
- Consultas médicas, medicamentos (marca o genérico), terapias físicas/rehab,
  acupuntura, quiropráctico, inhaloterapia, labs, radiología, tratamientos dirigidos,
  inmunoterapia, hormonoterapia, monoclonales, hemodiálisis, quimio, radiación.
- Exámenes especiales (MRI, CT, Nuclear, EMG, VCN, Holter, Ecocardiograma, Endoscopía,
  Colonoscopía, Cateterismo, CPRE, Crioterapia, Cauterización, Litotripsia):
  REQUIEREN AUTORIZACIÓN PREVIA. Sin autorización = reducción del 50% del beneficio.

EMERGENCIAS:
- Por accidente: dentro de 24 horas del evento (incluye dental de emergencia para
  dientes naturales en buen estado; tratamientos hasta 90 días post-accidente).
- Por enfermedad crítica: dentro de 48 horas del inicio de síntomas.
- Por enfermedad no crítica: dentro de 72 horas del inicio de síntomas.

MATERNIDAD:
- Período de espera según Tabla de Beneficios. Cubre: parto, abortos no criminales,
  complicaciones, cuidado rutinario del neonato hasta el alta, servicios prenatales.
- Amniocentesis: madres ≥38 años con aprobación de la compañía.
- Recién nacido: cobertura automática desde el nacimiento durante los primeros 9 días
  si la madre tiene cobertura de maternidad; debe registrarse dentro de 10 días del nacimiento.
- IMPORTANTE: Las hijas/hijastra inscritas como dependientes están EXCLUIDAS
  de los beneficios de maternidad.

OTRAS COBERTURAS:
- Enfermedades Congénitas/Hereditarias: nacidos bajo la póliza = desde el nacimiento
  hasta el máximo de vida en la tabla. No nacidos bajo la póliza = límite en la tabla.
- Medicina Preventiva: chequeos rutinarios, labs, exámenes (según tabla).
- SIDA/VIH: cubierto hasta el límite de la tabla si el virus no fue detectado antes de
  la vigencia de la póliza.
- Trastornos Mentales/Nerviosos (Psiquiatría): cubierto hasta el límite de la tabla.
- Dental: solo dientes naturales en buen estado, por enfermedad o accidente.
  NO cubre chequeos rutinarios, ortodoncia, ni procedimientos cosméticos.
- Trasplante de Órganos/Tejidos: período de espera 12 meses desde la fecha de inclusión.
  Requiere autorización previa; sin autorización = reducción del 50%.
- Servicio de Enfermería Privada: requiere solicitud médica y autorización previa.
- Cuidado Domiciliario y Paliativo/Terminal: reemplaza hospitalización; costo ≤ al
  costo diario del hospital. Terminal = esperanza de vida ≤ 6 meses.
- Ambulancia: terrestre (1 viaje al hospital + 1 regreso por incidente).
  Aérea: mismos límites, requiere autorización previa excepto emergencias con riesgo de vida.
- Ingreso Diario por Hospitalización: según tabla, para días en exceso del deducible.
  Se reduce a CERO a los 70 años. No aplica para hospitalizaciones por maternidad.
- Exoneración de Prima por Fallecimiento: si el asegurado fallece por causa cubierta,
  los dependientes continúan cubiertos bajo una nueva póliza con exención de prima.
  Se reduce a CERO a los 70 años (para el Contratante).

### Exclusiones Críticas MediRed:
1. Cirugía cosmética, tratamientos para caída del cabello (excepto consecuencia de
   accidente/enfermedad cubierta).
2. Condiciones preexistentes — la exclusión CESA después de 365 días de cobertura
   continua para condiciones declaradas/aceptadas; las exclusiones permanentes permanecen.
3. Trastornos mentales/psiquiátricos en exceso de los límites de la tabla.
4. Adicción a drogas, alcoholismo, estado de ebriedad (alcoholemia ≥51 mg/dl en sangre
   o ≥25 mg/dl en aire espirado).
5. Apnea del sueño, síndrome de fatiga crónica, medicina holística/homeopática/natural;
   trastornos de comportamiento/aprendizaje/lenguaje/TDAH; terapia ocupacional.
6. Guerra, rebelión, revolución, terrorismo, servicio militar activo; fenómenos naturales
   catastróficos.
7. Tratamientos dentales (excepto el beneficio de accidente + dental en la tabla).
8. Suicidio o lesiones autoinfligidas; exposición voluntaria al peligro; actos criminales.
9. Correcciones de visión (Excimer láser LASIK), anteojos, lentes de contacto,
   audífonos (excepto según tabla).
10. Órtesis, prótesis externas, aparatos mecánicos/electrónicos (las endoprótesis
    implantadas quirúrgicamente pueden estar cubiertas; las exoprótesis excluidas a menos
    que estén en la tabla).
11. Tratamientos de fertilidad, FIV, cirugía de cambio de sexo, anticoncepción/DIU.
12. Tratamientos experimentales/de investigación.
13. Podiatría (juanetes, pies planos, callos, etc.).
14. Enfermedades infecciosas/contagiosas que requieran cuarentena declaradas como
    epidemia/pandemia.
15. Cámara hiperbárica (excepto: intoxicación por CO, enfermedad de descompresión,
    embolia gaseosa, osteoradionecrosis).
16. Cirugía robótica/rehabilitación (excepto según tabla).
17. Deportes de alto riesgo: boxeo, paracaidismo, buceo autónomo, rapel, tauromaquia,
    equitación, esgrima, caza, alpinismo, automovilismo, motociclismo, bungee, ala delta,
    parapente, esquí, espeleología, deportes de invierno, deportes de contacto en
    competencia, competencias de velocidad.
18. Medicamentos fuera de receta, vitaminas, suplementos dietéticos.
19. Complicaciones de intervenciones excluidas o por negligencia del paciente.
20. Personas incluidas en listas de sanciones internacionales (OFAC).

### Condiciones y Deducibles Clave MediRed:
REQUISITO DE RESIDENCIA:
- Debe residir en Panamá y permanecer un mínimo de 10 meses consecutivos por año
  en territorio nacional. Cambio de residencia = terminación automática de la cobertura.

PREAUTORIZACIÓN:
- Procedimientos electivos: solicitar con ≥10 días de anticipación.
- Ingresos de emergencia: notificar dentro de las 48 horas.
- Penalidad por incumplimiento (electivo): beneficios reducidos al 50% del costo en red.
- Electivo en el extranjero sin autorización: 50% de los costos de la red en Panamá.
- Usar red fuera del país sin aprobación: beneficios reducidos al 60% de las tarifas
  de la red internacional.
- La preautorización es válida por 30 días y NO es garantía de pago.

PRESENTACIÓN DE RECLAMACIONES:
- Dentro de los 45 días del servicio/gasto.
- Pago dentro de los 30 días calendario después de recibir la documentación completa.

LÍMITES DE EDAD:
- Pólizas individuales: mínimo 2 años; máximo 63 años para entrada.
- Pólizas colectivas: mínimo 18 años; máximo 60 años para entrada; cobertura hasta
  los 70 años para el titular y el cónyuge.
- Hijos dependientes: de 10 días a 18 años (o 23 si son solteros, estudiantes a tiempo
  completo, económicamente dependientes, mismo hogar).

PERÍODO DE ESPERA DEL PRIMER AÑO (condiciones NO cubiertas durante los primeros 12 meses):
Amígdalas/adenoides; artroscopía; cirugía de hombro/rodilla/túnel carpiano; asma
bronquial; cataratas, pterigio, chalazión, glaucoma, queratocono; circuncisión por
enfermedad; colecistectomía; columna vertebral; endometriosis; lesiones deportivas;
enfermedad ácido péptica/úlcera; fibromas/nódulos/pólipos; hemorroides/divertículos/
enfermedad anorrectal; hernia (todos los tipos); litiasis (todos los tipos); migraña
crónica; condiciones de próstata; cirugía de tabique nasal/cornetes/senos/rinitis;
tiroides; tumores benignos de mama; tumores benignos de piel; útero/piso pélvico/
ovarios; várices; varicocele/hidrocele.

PERÍODO DE GRACIA/SUSPENSIÓN:
- Período de gracia: 30 días calendario desde la fecha de vencimiento de la prima.
- Suspensión de cobertura: 60 días calendario después del período de gracia; sin
  cobertura durante la suspensión; puede rehabilitarse pagando la prima vencida.

COASEGURO — PROHIBICIÓN IMPORTANTE:
El asegurado NO puede negociar, acordar ni obtener exenciones de su porción de
coaseguro con los prestadores sin autorización escrita de la compañía. Violación =
pérdida del derecho a indemnización, terminación de la cobertura o cancelación de póliza.

## PLAN MÉDICO INTERNACIONAL (PMI) — Diferencias clave respecto a MediRed:
- Habitación en el extranjero: semi-privada; si no hay disponible = máximo el 90%
  (vs. 75% en MediRed doméstico) de la tarifa privada más baja.
- Anestesia: 33.33% del honorario del cirujano principal (vs. 40% en MediRed).
- Ventana de emergencia por accidente: 48 horas (vs. 24 horas en MediRed).
- Beneficio de Vida (Seguro de Vida — Beneficio 21): EXISTE EN PMI, NO en MediRed.
  Paga la suma asegurada al fallecimiento del titular, cónyuge o hijos.
  Se reduce a CERO a los 70 años. Suicidio dentro de los primeros 2 años = solo
  devolución de primas pagadas bajo esta cobertura.
- Límites de edad en pólizas COLECTIVAS: hasta los 80 años (vs. 70 en MediRed).
- Período de espera para trasplante: 6 meses (vs. 12 meses en MediRed).
- Penalidad sin autorización para electivos en el extranjero: 50% del URA.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN SALUD — XTREME CARE (INTERNACIONAL DE SEGUROS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Producto: Xtreme Care — Seguro de Salud Individual y Colectivo (XC-06/14 Rev.06/23)
Aseguradora: Compañía Internacional de Seguros, S.A.
Autorización: Resolución No. DRLA-005 y DRLA-006 del 16 de febrero de 2024.

NOTA IMPORTANTE: Xtreme Care es un seguro de salud de COBERTURA ESPECÍFICA
(enfermedades/condiciones cubiertas listadas), no una cobertura amplia como MediRed.

### Condiciones/Enfermedades Cubiertas:
- Enfermedades neurológicas (incluyendo ACV con secuelas neurológicas >24 horas,
  infarto cerebral, hemorragia intracraneal/subaracnoidea, embolia extracraneal).
- Angioplastia (dilatación arterial por catéter balón).
- Cirugía cardíaca (bypass/revascularización coronaria para angina/infarto).
- Cáncer (tumores malignos con crecimiento no controlado, invasión, metástasis, leucemia
  — cánceres de piel EXCLUIDOS EXCEPTO el melanoma).
- Politraumatismo (trauma severo multiorgánico por acción física externa).
- Insuficiencia renal (enfermedad renal crónica terminal que requiere hemodiálisis
  o trasplante de riñón).
- Quemaduras de tercer grado.
- Trasplante de órganos (incluye gastos pre/post-quirúrgicos y complicaciones; costos
  del donante para extracción de órgano también cubiertos; debe realizarse en centro
  especializado reconocido por la comunidad médica internacional y el MINSA Panamá).
- Enfermedades congénitas, hereditarias o adquiridas.

### Períodos de Espera Xtreme Care:
- Primeros 90 días: solo ACCIDENTES cubiertos.
- Enfermedades diagnosticadas en los primeros 90 días: cubiertas solo después de
  1 año de cobertura continua.
- Enfermedades diagnosticadas después de los 90 días: cubiertas desde la fecha de
  diagnóstico (excepto congénitas).
- Enfermedades congénitas: cubiertas después de 2 años desde la fecha de vigencia.

### Exclusiones Críticas Xtreme Care:
- Cirugía cosmética/estética para embellecimiento; tratamiento para la calvicie.
- Condiciones preexistentes — exclusión cesa después de 365 días de cobertura continua.
- Trastornos mentales/psiquiátricos en exceso del sublímite de la Tabla de Beneficios.
- Adicción a drogas o alcoholismo; bajo influencia de alcohol (BAC ≥51 mg/dl).
- Guerra, actos de guerra, rebelión, revolución, terrorismo, servicio militar activo.
- Tratamientos dentales y de ortodoncia (excepto dientes naturales dañados en accidente
  cubierto; tratamiento preautorizado, dentro de los 90 días del accidente).
- Suicidio o intento de suicidio; lesiones autoinfligidas.
- Tratamientos experimentales o de investigación.
- Servicios médicamente innecesarios; servicios que excedan las tarifas de la red o
  las URA (Usual, Razonable y Acostumbrado).
- Deportes peligrosos en competencia: boxeo, lucha libre, paracaidismo, buceo, rapel,
  tauromaquia, equitación, esgrima, caza, alpinismo, automovilismo, motociclismo, bungee.
- Tumores/condiciones por VIH/SIDA.
- Equipos de riñón artificial para uso doméstico (a menos que se apruebe por escrito).
- Corazones artificiales, dispositivos mono/biventriculares, criopreservación >24 horas.
- Cirugía/rehabilitación con técnica robótica (excepto cáncer de próstata y los
  listados en la Tabla de Beneficios).

### Condiciones Xtreme Care:
- Equipo médico duradero: bastones, muletas, andadores, sillas de ruedas, camas de
  hospital — deben ser preautorizados.
- Exoprótesis/ortesis: brazos y piernas artificiales; solo cuando el paciente puede
  lograr función ambulatoria; reparaciones cubiertas solo por cambios anatómicos/
  funcionales o desgaste normal. Requiere preautorización.
- Sin autorización para procedimientos especiales = reducción del 50%.
- Presentación de reclamos: dentro de los 45 días del gasto.
- Red de prestadores: costos pactados con prestadores en red; servicios fuera de red
  cubiertas = 75% de URA.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN SALUD — ASSA CARE COLECTIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Producto: Póliza Colectiva de Salud ASSA CARE (GENCARE0709)
Aseguradora: ASSA Compañía de Seguros, S.A.

### Coberturas Principales:
A. HOSPITALIZACIÓN: Habitación, UCI, sala de operaciones, recuperación, medicamentos,
   servicios necesarios. Honorarios profesionales para cirugías y tratamientos médicos
   (el médico NO puede ser familiar dentro del 1° o 2° grado de consanguinidad).

B. EMERGENCIA/URGENCIA:
   - Emergencia Accidental Ambulatoria: gastos ambulatorios de accidente cubiertos en
     su totalidad (sin deducible, sin coaseguro) hasta los límites de la tabla,
     dentro de las 48 horas del evento. Después de 48 horas = se trata como ambulatorio
     regular. Traumas múltiples = beneficio de Enfermedad Catastrófica (80% después del
     deducible).
   - Emergencia por Enfermedad Ambulatoria: condición médica/quirúrgica aguda e
     inesperada que pone en riesgo la vida o el bienestar físico. Condiciones cubiertas
     incluyen: fracturas y luxaciones, quemaduras, heridas/laceraciones, hemorragias,
     accidentes físicos/traumáticos, intoxicaciones, embolismo pulmonar, dolor torácico,
     asma bronquial aguda/dificultad respiratoria, dolor abdominal agudo, convulsiones,
     pérdida de conocimiento, infarto de miocardio, episodios neurológicos agudos,
     cólico renal/hepático, reacciones alérgicas agudas, retención aguda de orina.

C. MATERNIDAD: Embarazos según tabla. Solo para la Asegurada Principal femenina
   o el Cónyuge asegurado. IMPORTANTE: Las hijas inscritas como dependientes
   están EXCLUIDAS de los beneficios de maternidad.

D. SERVICIOS DE AMBULANCIA: Terrestre (territorio nacional, hacia/desde hospital o
   sala de emergencias). Aérea (local e internacional).

E. COBERTURA AMBULATORIA: Consultas médicas, medicamentos prescritos, anestésicos,
   rayos X, labs de diagnóstico.

F-G. EXÁMENES ESPECIALES / RADIOLOGÍA/FISIOTERAPIA/LABS: Según límites y porcentajes
   de la tabla.

J. TRASTORNOS MENTALES, DROGAS, ALCOHOL: Hasta el máximo de la tabla.

L. MÉDICO MAYOR (Gastos Médico Mayor — 80% después del deducible):
   - Hemodinámica, enfermedades neurológicas/neuroquirúrgicas incluyendo ACV,
     cirugía cardíaca y angioplastia, trasplante de órganos, SIDA/VIH, trauma mayor
     por accidente (politrauma + rehabilitación), cuidado neonatal crítico, bebés
     prematuros, enfermedades congénitas, cáncer (incluyendo radioterapia y quimioterapia),
     insuficiencia renal crónica (diálisis), hospitalizaciones de más de 10 días.

### Exclusiones Clave ASSA Care Colectivo:
- Condiciones preexistentes (cualquier enfermedad/condición por la que el asegurado
  consultó, recibió tratamiento o se le recomendó tratamiento antes de la fecha de
  inicio de la póliza).
- Enfermedades congénitas, defectos o condiciones hereditarias adquiridas al nacer
  (a menos que estén en la tabla).
- Abortos inducidos voluntariamente; FIV, incapacidad para concebir naturalmente.
- Negligencia, actos ilegales, autoexposición voluntaria al peligro, suicidio, lesiones
  por abuso de alcohol/drogas.
- Guerra, terrorismo, energía atómica, fenómenos naturales catastróficos.
- Servicios que no cumplan con los estándares médicos profesionales generalmente aceptados.
- Cirugía por obesidad, control de peso, cirugía gástrica.
- Chequeos rutinarios/exámenes preventivos anuales no relacionados con el tratamiento
  de enfermedades (a menos que estén en la tabla).
- Tratamientos dentales ambulatorios: periodontitis, implantes, prótesis dentales
  completas/parciales (excepto consecuencia directa de accidente dentro de 90 días).
- Servicios de enfermería especial, honorarios de anestesiólogo adicional, honorarios
  de asistente quirúrgico.
- Gastos médicos por los cuales el asegurado no tuvo que pagar.
- Vitaminas, minerales, medicamentos sin receta.

### Condiciones Clave ASSA Care Colectivo:
- Edad máxima de entrada: 65 años.
- Empleados elegibles deben ser permanentes, activos, trabajando mínimo 40 horas/semana.
- Dependientes: cónyuge (no mayor de 65 años), hijos solteros de 10 días a 18 años;
  extensible hasta 25 años si son estudiantes universitarios a tiempo completo, no
  trabajan.
- Terminación individual automática: a los 70 años para el titular y el cónyuge, a
  los 25 para los hijos dependientes.
- Reclamos: deben presentarse dentro de 1 año desde la fecha del gasto/pago.
- Residencia: si el asegurado cambia de país de residencia o permanece en el extranjero
  más de 3 meses, la cobertura se anula automáticamente después de ese período.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN VIDA COLECTIVO — ASSA GOLD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Producto: Seguro Colectivo de Vida ASSAGOLD (GENGOLD 06-2016)
Aseguradora: ASSA Compañía de Seguros, S.A.
NOTA: El Seguro de Vida COLECTIVO (empresarial) es diferente al Vida Individual ASSA.
      El Colectivo aplica para grupos de empleados; el Individual es personal.

### Cobertura Básica:
- Beneficio por Fallecimiento: pago de la suma asegurada al(los) beneficiario(s)
  designado(s) al fallecimiento del asegurado durante la vigencia de la póliza,
  por cualquier causa (natural o accidental).

### Beneficios Complementarios (requieren prima adicional):

A. MUERTE ACCIDENTAL Y DESMEMBRAMIENTO:
   Suma adicional si la muerte resulta de causa accidental externa, violenta,
   involuntaria con lesión corporal visible. La muerte debe ocurrir dentro de 90 días
   del accidente. Tabla de desmembramiento:
   - Pérdida de ambos miembros superiores/inferiores/manos/ojos: 100%
   - Un brazo: 70%; Una mano: 60%; Miembro superior (izquierda): 52%
   - Un miembro inferior: 70%; Un pie: 50%; Un ojo: 30% (70% si es el único)
   - Sordera bilateral: 40%; Sordera unilateral: 20%; Mutismo incurable: 50%

B. MUERTE ACCIDENTAL EN HECHOS ESPECÍFICOS:
   Beneficio mayor si el accidente ocurre mientras el asegurado es pasajero en
   transporte terrestre público (ruta regular), en ascensor público, o dentro de
   un edificio de acceso público. Debe ocurrir antes de los 70 años.

C. INCAPACIDAD TOTAL Y PERMANENTE — PAGO MENSUAL:
   Paga la suma asegurada de la cobertura de Muerte en 60 cuotas mensuales.
   Definición: incapacidad completa para dedicarse a cualquier ocupación remunerada
   para la cual el asegurado esté calificado, durante un período ininterrumpido de
   al menos 12 meses. Debe comenzar antes de los 60 años.

D. ADELANTO DE GASTOS FUNERARIOS:
   Pago dentro de las 48 horas de la notificación del fallecimiento.

E. ADELANTO DE COBERTURA BÁSICA PARA EL CUIDADO DEL ASEGURADO:
   Máximo: el menor de B/.100,000 o el 50% de la suma asegurada menos préstamos.
   Disponible solo si el asegurado desarrolla una enfermedad terminal diagnosticada
   al menos 90 días después de la vigencia de la póliza y con expectativa de muerte
   dentro de los 12 meses del diagnóstico.

F. GASTOS MÉDICOS POR ACCIDENTE:
   Paga honorarios médicos, farmacéuticos, hospitalarios y quirúrgicos hasta la suma
   asegurada bajo esta cobertura. Hasta el 70° cumpleaños del asegurado.

G. INDEMNIZACIÓN POR ENFERMEDAD POR CÁNCER:
   - El cáncer debe ser el primer diagnóstico durante la vigencia de la póliza.
   - Debe ocurrir al menos 90 días después de la participación continua.
   - El cáncer DEBE ser confirmado por patólogo mediante análisis histológico.
   - Máximo: suma asegurada de la póliza básica O B/.50,000 (lo que sea menor).
   - Termina en el aniversario de los 65 años.

H. PRIVILEGIO DE CONVERSIÓN:
   Al terminar el empleo, derecho a convertir a póliza de vida individual sin
   evidencia de asegurabilidad. Debe solicitarse dentro de los 30 días de la
   terminación del grupo. Termina a los 65 años.

### Condiciones Clave ASSA Gold:
- Elegibilidad: de 18 a 65 años; debe estar en servicio activo y permanente.
- Terminación individual automática a los 70 años.
- Período de gracia: 30 días calendario para primas fraccionarias no iniciales.
- Suicidio dentro de los primeros 2 años: la compañía solo devuelve la prima no
  devengada. Después de 2 años: el beneficio de muerte se paga a los beneficiarios.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN VIDA UNIVERSAL — VIDA SEGURA (ASSA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Producto: Plan de Vida Universal — Vida Segura (PVU-VS002-07-REV.04.2021)
Aseguradora: ASSA Compañía de Seguros, S.A.
Autorización: Resolución N° DRLA-045 de 13 de julio de 2022.
NOTA: Este es un plan de Vida Individual ASSA — aplicar regla de exclusividad ASSA.

### Cobertura Básica:
- BENEFICIO POR FALLECIMIENTO: pago del Monto del Seguro al beneficiario al fallecimiento
  del asegurado antes del vencimiento de la póliza, menos préstamos, intereses, gastos,
  primas y deducciones.
- BENEFICIO DE SUPERVIVENCIA/MADUREZ: si el asegurado llega vivo a la fecha de vencimiento,
  la compañía paga el Valor Efectivo Corriente menos las deudas pendientes.
- OPCIONES DE BENEFICIO POR FALLECIMIENTO:
  Plan A: mayor entre el Monto Final Especificado O el 110% del Valor Acumulado Corriente.
  Plan B: mayor entre el Monto Final Especificado + Valor Acumulado Corriente O
          el 110% del Valor Acumulado Corriente.

### Contratos Suplementarios Disponibles:
A. BENEFICIO PARA EL CUIDADO DEL ASEGURADO (Gratuito basado en aplicación):
   Pago anticipado del menor de: B/.100,000 o 50% de la suma asegurada menos préstamos.
   Solo si el asegurado desarrolla una ENFERMEDAD TERMINAL: condición de salud
   irreversible diagnosticada al menos 90 días después de la vigencia, con expectativa
   de muerte dentro de los 12 meses del diagnóstico.

B. SEGURO DE VIDA A TÉRMINO PARA OTRO ASEGURADO:
   Paga la suma asegurada al beneficiario al fallecimiento del "Otro Asegurado" mientras
   el contrato esté vigente. Renovable mensualmente hasta los 120 años.
   Privilegio de Conversión del Sobreviviente: si el asegurado principal muere mientras
   el contrato está en vigor Y antes del 65° cumpleaños del otro asegurado, éste puede
   convertir a póliza individual permanente sin evidencia de asegurabilidad.

C. EXONERACIÓN DE DEDUCCIONES MENSUALES POR INCAPACIDAD TOTAL Y PERMANENTE:
   Definición: incapacidad completa para dedicarse a cualquier ocupación/actividad
   remunerada para la que esté calificado, durante al menos 6 meses (considerada
   permanente). Para amas de casa: incapacidad para realizar labores domésticas.
   También cubre: parálisis por lesión espinal, pérdida total irreparable de visión
   en ambos ojos, pérdida funcional/amputación de ambas manos o ambos pies.
   Debe comenzar antes del aniversario de los 60 años.

D. MUERTE ACCIDENTAL Y DESMEMBRAMIENTO (Contrato Suplementario):
   Suma adicional al fallecimiento accidental. La muerte debe ocurrir dentro de los
   90 días del accidente. Tabla detallada de desmembramiento similar a ASSA Gold.
   Beneficios pagaderos si la muerte ocurrió antes del aniversario de los 65 años.

I. ENFERMEDADES GRAVES (Critical Illness — 8 enfermedades terminales cubiertas):
   1. CÁNCER: tumor maligno (histológicamente confirmado por patólogo). Primera
      diagnosis durante la póliza. EXCLUIDOS: carcinoma in situ, premaligno, todos los
      tumores cutáneos (incluyendo CBC, CEC), melanomas <1.5mm (Breslow sin metástasis),
      cáncer en presencia de VIH/VPH/VHH, tumores no potencialmente mortales (cáncer
      de mama femenino estadio 1 TNM, cáncer de próstata T1a/T1b, micropapilar tiroideo,
      vejiga <T2N0M0, leucemia linfocítica crónica <RAI-I, enfermedad de Hodgkin estadio 1).
   2. CIRUGÍA DE AORTA: toracotomía o laparotomía para enfermedad de la aorta que
      requiere reconstrucción/excisión y reemplazo por prótesis (aorta torácica y
      abdominal únicamente, no ramas). Excluidas lesiones aórticas traumáticas y
      técnicas endovasculares.
   3. CIRUGÍA DE VÁLVULA CARDÍACA: cirugía a corazón abierto para reemplazar/reparar
      una o más válvulas por disfunción. Excluidas intervenciones no a corazón abierto.
   4. BYPASS AORTOCORONARIO: cirugía de bypass a corazón abierto (no angioplastia,
      stent ni procedimientos percutáneos/no quirúrgicos).
   5. ACV/HEMORRAGIA CEREBRAL: déficit neurológico focal agudo por ACV con muerte del
      tejido cerebral, hemorragia de vasos intracraneales o émbolos extracraneales;
      síntomas >24 horas; lesión neurológica permanente confirmada por neurólogo a los
      180 días del evento mediante TC o RMN. EXCLUIDOS: AIT; cambios de memoria/
      personalidad; síntomas cerebrales relacionados con migraña; lesiones cerebrales
      traumáticas/hipóxicas; enfermedad vascular isquémica que afecte el ojo/nervio
      óptico/sistema vestibular.
   6. INFARTO DE MIOCARDIO: necrosis del músculo cardíaco por suministro sanguíneo
      deficiente; requiere 3 de 4 criterios: dolor torácico típico, nuevos cambios
      diagnósticos en ECG, elevación significativa de marcadores cardíacos (CK-MB,
      troponina), disfunción del ventrículo izquierdo (fracción de eyección <50%)
      confirmada ≥3 meses post-evento.
   7. INSUFICIENCIA RENAL: insuficiencia renal terminal, crónica irreversible bilateral,
      que requiere diálisis renal crónica regular.
   8. TRASPLANTE MAYOR DE ÓRGANO: como receptor de trasplante humano a humano de:
      corazón, hígado, riñón, páncreas, intestino delgado, pulmón, médula ósea.

   PERÍODO DE ESPERA ENFERMEDADES GRAVES: 90 días desde la vigencia (o última
   rehabilitación o aumento de beneficio). Si se diagnostica dentro de los 90 días:
   cobertura nula y devolución de primas.
   COBERTURA EXPIRA: en el aniversario del 65° cumpleaños del asegurado o en la
   primera ocurrencia.
   REVISIÓN DE PRIMAS: cada 5 años (la compañía puede ajustar con aprobación de la
   Superintendencia; debe notificar al asegurado 60 días antes).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN RESPONSABILIDAD CIVIL (RC) — ASSA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Producto: Seguro de Responsabilidad Civil (RC-03.01.11-Rev.11)
Aseguradora: ASSA Compañía de Seguros, S.A.
Territorio: ÚNICAMENTE República de Panamá.

### Cobertura Básica — Sección I:
Paga, a nombre del Asegurado, todas las sumas que el Asegurado esté legalmente
obligado a pagar como indemnización por:
- Lesiones Corporales a terceros (incluyendo muerte).
- Daños a la Propiedad Ajena de terceros.
Causadas ACCIDENTALMENTE por eventos derivados de las actividades del Asegurado.
También cubre: costos judiciales y gastos legales (incluso de reclamaciones infundadas),
indemnización por daños a bienes muebles e inmuebles, presentación de fianzas
(incluida dentro del límite de responsabilidad).
En casos de culpa concurrente: la compañía solo responde por la parte proporcional
del Asegurado.

### Modalidades de Cobertura Básica (cada una se adjunta por Endoso):
1. Predios y Operaciones.
2. Fabricantes y Contratistas.
3. Dueños, Propietarios y Arrendatarios.
4. Almacenadora.
5. Productos.

### Coberturas Adicionales Opcionales (por endoso, prima adicional):
1. Cobertura General Comprensiva.
2. Cobertura Cruzada.
3. RC Legal por Daños por Incendio.

### Exclusiones Críticas RC:
- Pérdidas donde el Asegurado cobró o aceptó liquidaciones de terceros sin conocimiento
  y consentimiento previo de la compañía.
- Daños de contratistas independientes (modalidad Colapso).
- Explosiones de recipientes de vapor, tuberías a presión, motores principales.
- Daños a propiedad subterránea de terceros (modalidad Daños Subterráneos).
- Riesgo de Productos: solo aplica cuando el daño ocurre FUERA de las instalaciones
  del Asegurado Nombrado Y DESPUÉS de que la posesión física de los productos
  haya sido entregada a terceros.
- Fallo de reconocimiento de fechas electrónicas (Y2K).

### Condiciones Clave RC:
- Aviso de siniestro: dentro de los 15 días calendario del evento o de cuando el
  Asegurado tuvo conocimiento.
- Formalización del reclamo: 30 días calendario desde la fecha del siniestro.
- Pago: dentro de los 60 días calendario después de recibir toda la prueba satisfactoria.
- Prescripción: todas las acciones derivadas de esta póliza prescriben al año del evento.
- Cambios de riesgo: el Asegurado debe notificar a la compañía dentro de los 5 días
  hábiles de cualquier cambio de riesgo.
- Fraude/Declaración falsa: anula automáticamente la póliza.
- Período de gracia: 30 días para primas no iniciales; luego 10 días adicionales;
  después = cancelación automática.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN EMPRESARIALES — MULTIPÓLIZA ASSAPAK (CONTENIDO COMERCIAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Producto: Multipóliza ASSAPak — Contenido Comercial (No. 31.3.99 Rev. 2011)
Aseguradora: ASSA Compañía de Seguros, S.A.

### Bienes Cubiertos (Sección I):
- Mobiliario y equipo de oficina (propiedad del Asegurado o legalmente responsable).
- Mercancía (propia, en comisión, consignación, o legalmente responsable).
- Equipo electrónico (computadoras, copiadoras, impresoras, calculadoras, fax,
  centrales telefónicas).
- Máquinas y equipos usados en operaciones comerciales.
- Rótulos luminosos y no luminosos.
- Vidrios y cristales de las instalaciones aseguradas.
- La propiedad debe estar DENTRO de las instalaciones declaradas O adosada a la
  estructura del edificio O dentro de un vehículo cerrado del Asegurado dentro de
  los 30 metros de las instalaciones declaradas.

### Bienes NO Cubiertos:
Dinero y valores (excepto bajo coberturas específicas de robo), antenas de radio/TV,
antenas de satélite, oro/metales preciosos/piedras preciosas/joyas, planos/patrones/
software/dibujos/manuscritos/moldes, estampillas/documentos negociables, armas/municiones,
pinturas/objetos raros/de arte (excepto bajo "Objetos de Valor"), grúas y montacargas.

### Riesgos Básicos Cubiertos (Art. 3, Sección I):
a) INCENDIO Y/O RAYO: Daño directo por incendio; rayo que golpea la propiedad asegurada.
b) EXPLOSIÓN DIRECTA: Daño material por explosión de aparatos domésticos de gas.
   (Calderas, motores de combustión interna y recipientes a presión NO cubiertos bajo
   explosión sin prima adicional por Sección II Art. 5).
c) VENDAVAL/HURACÁN: Pérdidas por huracán, tormenta, ciclón, tornado u objetos
   transportados por el viento. Los contenidos interiores solo se cubren si el
   viento/objetos entraron por aberturas rotas por el fenómeno atmosférico.
   NO CUBIERTOS: contenidos en edificios en construcción; torres/antenas; marejada,
   inundación, agua en ascenso incluso causada por vendaval.
d) DAÑO POR HUMO: Daño súbito/accidental por humo.
e) IMPACTO DE VEHÍCULO TERRESTRE: Pérdidas por colisión/caída de vehículos/objetos
   que NO sean del Asegurado ni arrendatarios.
f) IMPACTO DE AERONAVE: Pérdidas por aeronaves o objetos aéreos que caen.
g) ESTAMPIDO SÓNICO: Daño material por ondas sónicas de aeronaves/cohetes no
   autorizados a sobrevolar.
h) TERREMOTO, TEMBLORES, ERUPCIONES VOLCÁNICAS: Daño material directo.
   NO CUBIERTOS: tsunami, inundación, agua en ascenso (incluso si es por terremoto).
i) DAÑO DIRECTO POR AGUA: Daño de tuberías rotas, plomería, tanques, fallas del
   sistema de drenaje. NO CUBIERTOS: acuarios rotos; derrrames accidentales por
   personas; inundaciones del mar/ríos/lagos/canales/alcantarillas públicas; daño
   por falta de mantenimiento/drenajes obstruidos.
j) REMOCIÓN DE ESCOMBROS: Costos necesarios para retirar escombros después de una
   pérdida cubierta; total (pérdida + remoción) limitado a la suma asegurada.
k) GASTOS DE EMERGENCIA Y SEGURIDAD:
   - Servicio de ambulancia: máximo 3 usos por año.
   - Guardias de seguridad: hasta 72 horas después del evento, máximo B/.500.00.
l) REUBICACIÓN/ALMACENAMIENTO TEMPORAL: máximo B/.1,000.00 por mes, hasta 6 meses.
m) INFIDELIDAD: apropiación ilícita de dinero/valores por empleados del Asegurado.
   Máximo B/.1,500.00 por empleado; total máximo para todos los reclamos B/.3,000.00.
   NO CUBIERTOS: cálculos incorrectos de inventario; actos fraudulentos del propio
   Asegurado, socios, directores u oficiales.
n) RECARGA DE EXTINTORES: hasta B/.1,000.00.
ñ) DAÑOS POR ROBO CON VIOLENCIA A INSTALACIONES: máximo B/.10,000.00 por evento.
o) GASTOS DE LIMPIEZA: limpieza y extracción de lodo después de pérdida cubierta,
   máximo B/.5,000.00.
p) GASTOS DE SALVAMENTO: costos para controlar o minimizar consecuencias de una
   pérdida, máximo B/.10,000.00.

### Coberturas Suplementarias con Límites Flexibles (Sección II):
1. INUNDACIÓN: Cubre daños por desbordamiento de mares, ríos, lagos, acueductos,
   alcantarillas y ruptura de diques/represas. Límite hasta 100% de la suma
   asegurada contra incendio.
2. ROBO CON FORZAMIENTO — CONTENIDOS Y CAJA FUERTE: contenidos y dinero/valores
   robados con signos visibles de entrada/salida forzada.
3. ASALTO DENTRO Y FUERA DE INSTALACIONES: pérdida de dinero/valores por robo con
   agresión, violencia o amenaza de violencia contra el Asegurado o empleados.
   Requiere evidencia física y/o testigos; denuncia inmediata a las autoridades.
4. EQUIPO ELECTRÓNICO: daño material a equipo electrónico por eventos súbitos e
   imprevistos (incl. cortocircuito, errores de operación, robo con forzamiento,
   granizo, hundimiento de terreno). Si suma asegurada >B/.10,000 sin lista detallada:
   límite máximo B/.10,000. Si valor de reposición ≥B/.25,000: se requiere contrato
   de mantenimiento obligatorio con el fabricante.
5. EQUIPO MÓVIL/PORTÁTIL FUERA DE INSTALACIONES: cubre daño/pérdida dentro de
   Panamá. NO cubierto: cuando la propiedad está desatendida (excepto dentro de
   edificio o vehículo cerrado); colisión; a bordo de aeronaves/embarcaciones.
6. AVERÍA DE MAQUINARIA/EXPLOSIÓN DE CALDERAS: daño súbito, accidental e imprevisto
   a maquinaria dentro de instalaciones. Si suma asegurada >B/.10,000 sin lista
   de valores de reposición: límite B/.10,000.
7. RC EXTRACONTRACTUAL DE TERCEROS: paga lo que el Asegurado esté civilmente
   obligado a pagar por lesiones corporales y daños materiales a terceros dentro
   de Panamá. Límite combinado por Condiciones Particulares.
   NO CUBIERTOS: mala praxis profesional; operación de vehículos motorizados/
   acuáticos/aéreos; empleados; daño a bienes en custodia del Asegurado;
   responsabilidad contractual voluntariamente asumida.
8. RC LEGAL POR INCENDIO: cubre daños a edificios por los que el Asegurado es
   civilmente responsable ante terceros debido a un incendio. SOLO APLICA SI LAS
   INSTALACIONES NO SON PROPIEDAD DEL ASEGURADO (debe ser arrendatario/ocupante).
9. VIDRIOS Y RÓTULOS: rotura accidental de vidrios, rótulos y adornos.
10. MUERTE ACCIDENTAL (del Asegurado persona natural): asegurado debe tener máximo
    59 años. Cubre: muerte accidental; muerte en accidente aéreo (como pasajero);
    protección de 24 horas en todo el mundo.
    NO CUBIERTOS: suicidio, guerra, terrorismo, energía nuclear, catástrofes naturales,
    muerte por ataques cardíacos/epilépticos, deportes de velocidad/paracaidismo/
    buceo/alpinismo, aviación (excepto como pasajero de aerolínea comercial autorizada).

### Coberturas Opcionales Adicionales (Sección III — más importantes):
- DAÑO DIRECTO POR DESORDEN PÚBLICO: incendios/explosiones por personas que
  participan en desórdenes públicos (no aplica a la toma permanente o temporal de
  edificios por autoridades).
- LUCRO CESANTE / INTERRUPCIÓN DE NEGOCIO: cuando un evento cubierto daña/destruye
  la propiedad dentro de las instalaciones y causa directamente la suspensión parcial
  o total de las actividades comerciales. Si el Límite de Responsabilidad es <80%
  de la Ganancia Bruta de los 12 meses posteriores a la pérdida: el Asegurado asume
  la parte proporcional. Máximo 30 días por suspensión debida a pérdida de
  materias primas/mercancía para reventa. Máximo 15 días por prohibición de acceso.
- RC PATRONAL: paga la responsabilidad civil del Asegurado hacia sus empleados por
  lesiones corporales (incluida la muerte) en accidentes u enfermedades profesionales.
- CARGA TERRESTRE: cubre pérdida/daño material a cargo del Asegurado en vehículo
  cerrado de su propiedad dentro de Panamá. Máximo total B/.50,000.00.
- RC DE PRODUCTOS: cubre RC extracontractual por daños causados por productos
  suministrados por el Asegurado (definitivamente entregados a terceros).
  Límite agregado anual por Condiciones Particulares.
- OBJETOS DE VALOR: cubre pérdida/daño material a objetos de valor, pinturas,
  objetos raros dentro de instalaciones. Máximo B/.25,000.00 (requiere lista
  de inventario detallada). NO CUBIERTOS: oro, metales preciosos, piedras preciosas.

### Deducibles ASSAPak (Sección I Art. 6):
- Vendaval/Huracán: 2% de la suma asegurada por ítem (mín. B/.1,000 / máx. B/.150,000)
  por período de 48 horas.
- Terremoto/Temblores: 2% de la suma asegurada por ítem (mín. B/.1,000 / máx. B/.150,000)
  por período de 48 horas.
- Daño por agua (tuberías/drenajes): 1% de la suma asegurada por ítem
  (mín. B/.1,000 / máx. B/.25,000) por período de 48 horas.
- Inundación (desbordamiento): 1% de la suma asegurada por ítem
  (mín. B/.1,000 / máx. B/.100,000) por período de 48 horas.
- Todos los demás eventos cubiertos: B/.500.00.
- Propiedad adosada a la estructura del edificio: B/.150.00 por evento.

### Valor de Reposición (Cláusula de Reposición):
- La suma asegurada debe igualar el VALOR DE REPOSICIÓN (costo para reemplazar con
  un artículo nuevo de la misma clase/capacidad incluyendo flete, impuestos, aranceles
  aduaneros) en el momento del siniestro.
- Si la suma asegurada < valor de reposición en el momento del siniestro: aplica
  infraaseguro; el Asegurado asume la parte proporcional.
- Inventario de mercancía para reventa: cubierto al COSTO DE ADQUISICIÓN + 10%
  (sin exceder el límite). El 10% NO se reconoce si la rotación de mercancía >180 días.
  Este 10% NO aplica para robo con forzamiento.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN CONSTRUCCIÓN — PÓLIZA TODO RIESGO PARA CONTRATISTAS (CAR)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Producto: Póliza Para Todo Riesgo Para Contratistas / CAR (No. 17.01.94-Rev.00)
Aseguradora: ASSA Compañía de Seguros, S.A.

### Coberturas:
SECCIÓN I — Daños Materiales:
- Cobertura A (Básica): Incendio, explosión, impacto de rayo; caída de aviones;
  robo con violencia (debe reportarse a las autoridades); daños por trabajos defectuosos,
  impericia, negligencia, actos malintencionados, falla humana; otros accidentes
  imprevistos no excluidos.
- Cobertura B (Opcional): Terremoto, temblor, maremoto, erupción volcánica.
- Cobertura C (Opcional): Ciclón, huracán, tempestad, vientos, inundación,
  desbordamiento, alza de nivel de aguas, enfangamiento, hundimiento/deslizamiento
  del terreno, derrumbes, desprendimiento de tierra o rocas.
- Cobertura D (Opcional): Daños causados por el Contratista durante el período de
  mantenimiento del contrato de construcción. Solo cubre pérdidas/daños a las obras
  contratadas.
- Cobertura G: Gastos de remoción de escombros (requiere suma asegurada separada).

SECCIÓN II — Responsabilidad Civil (extracontractual):
- Cobertura E: RC por daños materiales a bienes de terceros en conexión directa con
  la construcción, en el sitio o vecindad inmediata.
- Cobertura F: RC por lesiones corporales (incluida muerte) a personas no empleadas
  por el Asegurado, el dueño u otros contratistas en el sitio.
- NOTA: Coberturas E y F NO aplican durante el período de mantenimiento.

EQUIPO/MAQUINARIA: Maquinaria de construcción, equipos, herramientas, instalaciones
auxiliares, oficinas y bodegas provisionales. La indemnización se calcula deduciendo
la depreciación y el deducible.

### Exclusiones Críticas CAR:
- Embarcaciones, equipo flotante, vehículos con licencia de tránsito en vías públicas,
  aviones; bienes de empleados/obreros; dinero, valores, planos, documentos.
- Dolo o imprudencia manifiesta del Asegurado o su representante; guerra, huelgas,
  confiscación; reacciones nucleares, radiación.
- Lucro cesante, demora, paralización del trabajo.
- Desgaste, deterioro, corrosiones, deterioro atmosférico normal.
- Daños durante el transporte al sitio de construcción.
- Pérdida/daño por cálculo o diseño erróneo.
- Falla o daño mecánico/eléctrico interno de equipo y maquinaria.
- Horas extraordinarias, trabajo nocturno, flete expreso (excepto si se acuerda
  por endoso).

### Condiciones Clave CAR:
- Suma asegurada para obras (Ítem 1): debe igualar el valor total del contrato al
  término, incluyendo materiales, mano de obra, flete, aranceles, impuestos y
  materiales suministrados por el propietario.
- Suma asegurada para equipos (Ítems 2 y 3): debe igualar el valor de reposición.
- Aviso de pérdida: dentro de los 15 días del evento.
- Cobertura inicia: cuando comienza el trabajo o cuando los bienes asegurados se
  descargan en el sitio de construcción.
- Cobertura termina: en la fecha especificada en las Condiciones Particulares o cuando
  los bienes se ponen en servicio (lo que ocurra primero).
- Cancelación: 8 días de aviso por carta certificada por cualquiera de las partes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN EMBARCACIONES — ASSA MAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Producto: Seguro de Embarcaciones de Recreo ASSA MAR (AG-DD-06-002)
Aseguradora: ASSA Compañía de Seguros, S.A.

### Coberturas:
2.1 RESPONSABILIDAD CIVIL: paga lo que el Asegurado esté civilmente obligado a
   pagar (por sentencia ejecutoriada) por daños personales o materiales causados a
   terceros o a sus bienes. Incluye honorarios de abogado razonables y costas judiciales.
   Solo se activa con: (1) sentencia ejecutoriada contra el asegurado o (2) autorización
   escrita previa del asegurador para un acuerdo de conciliación.

2.2 DAÑOS PROPIOS:
   - Pérdida total o abandono de la embarcación (con gastos de salvamento).
   - Averías particulares por: choque, abordaje, varada, embarrancada, naufragio,
     explosión del motor, incendio, golpe de mar.
   - Accidentes del vehículo transportador/remolcador durante viaje por tierra.
   - Robo: de la embarcación completa o partes/accesorios fijos, cuando esté a flote,
     en muelles, en garajes/hangares cerrados o en transporte, siempre que el robo
     implique violencia/intimidación o entrada forzada.
   - Motores fuera de borda: cubiertos para robo SOLO cuando estén asegurados con un
     dispositivo antirrobo adicional al anclaje normal.
   - Accesorios no fijos: cubiertos SOLO si están expresamente detallados y valorados
     en las Condiciones Particulares Y guardados bajo llave.

2.3 ACCIDENTES PERSONALES: Muerte e Invalidez Permanente (Total/Parcial) por accidentes
   a los ocupantes de la embarcación. Gastos médico-farmacéuticos y de hospitalización.
   Solo puede incluirse cuando 2.1 y 2.2 también se contraten.

Tabla de Invalidez Parcial (valores clave):
- Pérdida de ojo con enucleación: 30%; sin enucleación/50% visión binocular: 25%
- Pérdida total de audición: 40%; un oído: 15%
- Amputación de mandíbula inferior: 40%
- Brazo (derecho/izquierdo): 60%/50%; Mano (derecha/izquierda): 60%/50%
- Pierna sobre la rodilla: 50%; bajo la rodilla: 40%; pie: 35%

### Exclusiones Críticas Embarcaciones:
RC: daños a bienes/efectos personales de personas transportadas; el propietario,
arrendatario, armador, tripulación o sus familiares no pueden ser considerados "terceros".
DAÑOS PROPIOS: guerra, actos del enemigo, embargo, confiscación; daños al fondo
(excepto por naufragio, varada, embarrancada, choque o incendio); desgaste del casco/
aparejo/equipos/instrumentos/motores con el tiempo; rotura del casco por desecación.
TODOS LOS RIESGOS: uso comercial o lucrativo de la embarcación; operador bajo
influencia de alcohol, drogas o narcóticos; participación en regatas o competencias
deportivas (salvo acuerdo en Condiciones Particulares); actos ilegales o criminales,
o negligencia grave del asegurado u operador.
ACCIDENTES PERSONALES: para muerte/invalidez permanente: plena eficacia solo para
asegurados de 14 (inclusive) a 65 (exclusive) años.

### Condiciones Clave Embarcaciones:
- REQUISITO OBLIGATORIO para que aplique la cobertura: la embarcación debe ser
  operada por persona(s) con la licencia/certificación requerida por la ley aplicable.
- Límites de Navegación: según Condiciones Particulares.
- Pérdida Total Constructiva: si los costos de reparación superan el 75% de la suma
  asegurada, el asegurador puede optar por pagar los costos de reparación O declarar
  pérdida total constructiva (pagando el valor real inmediatamente antes de la pérdida).
- Recuperación por Robo: si se recupera dentro de los 30 días, el asegurado debe
  aceptar la devolución. Después de 30 días, el título pasa al asegurador.
- Transferencia: la póliza se cancela automáticamente desde la fecha de venta/
  transferencia excepto si el asegurador da consentimiento escrito.
- Prescripción: 1 año desde la fecha del siniestro/evento.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN CARGA MARÍTIMA — PÓLIZA FLOTANTE (ASSA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Producto: Póliza Flotante de Carga Marítima (No. 64C0008-REV.98)
Aseguradora: ASSA Compañía de Seguros, S.A.

Cobertura abierta/flotante para embarques de carga marítima (importación y exportación).
- Riesgo en Tierra: mientras los bienes están en muelles, malecones o en tránsito
  terrestre; cubre: choque, vuelco, descarrilamiento, incendio, rayo, derrame de
  rociadores, ciclones, huracanes, terremoto, inundaciones (por desbordamiento de
  aguas navegables), derrumbe o submersión de muelles/espigones.
- Acumulación: si los intereses se acumulan más allá de los límites de la póliza
  por interrupción del tránsito o accidente fuera del control del asegurado, la
  compañía mantiene la cobertura por el exceso hasta DOS VECES el límite de la póliza
  (con notificación inmediata).
- Maquinaria Multítem: la responsabilidad es solo por el valor proporcional de la
  parte perdida/dañada, nunca por el valor de la maquinaria completa.
- Pago de pérdida: pagadero 30 días después de la prueba de pérdida y del ajuste.
- Prescripción de reclamos: la compañía puede rechazar cualquier reclamo no presentado
  debidamente dentro de los 6 meses desde el inicio del viaje en el extranjero hasta
  la entrega de la documentación del reclamo.
- Póliza continua; cancelación por cualquiera de las partes con 30 días de aviso
  escrito (no afecta los riesgos en tránsito en la fecha de cancelación).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN CARGA TERRESTRE (ASSA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Producto: Póliza de Carga Terrestre (No. 15.11.93-Rev.98)
Aseguradora: ASSA Compañía de Seguros, S.A.

Cubre pérdida o daño material accidental a bienes asegurados mientras están en o sobre
vehículos descritos en las Condiciones Particulares (propiedad/operados por el asegurado),
causados por: incendio, rayo, auto-ignición y explosión; colisión del vehículo con otro
vehículo u objeto; vuelco del vehículo transportador; ventarrón, ciclón o tornado;
derrumbe de puentes o alcantarillas; inundación por desbordamiento de ríos o quebradas;
derrumbes de tierra, piedras o rocas.

### Exclusiones Críticas Carga Terrestre:
- Rotura, derrame, raspadura, dobladura, torsión, abolladura, manchas (EXCEPTO si son
  causadas directamente por un riesgo cubierto).
- Robo, hurto o pillaje.
- Lluvia o agua de lluvia (EXCEPTO durante o inmediatamente después de un evento de
  riesgo cubierto).
- Negligencia del Asegurado o empleados en no tomar medidas razonables para proteger
  los bienes asegurados.
- Desaparición misteriosa o inexplicable.
- Desgaste, deterioro natural, vicio propio, naturaleza perecedera; polilla, insectos,
  animales dañinos.
- Demora, pérdida de mercado; descompostura mecánica, defectos latentes.
- Lucro cesante o pérdidas consecuentes.
- Infidelidad, dolo, mala fe, culpa grave del asegurado, empleados o beneficiarios.
- Confiscación, embargo, decomiso; contrabando o comercio/transporte ilícito.
- Guerra, revolución, terrorismo; fusión/fisión nuclear, radioactividad.

### Condiciones Clave Carga Terrestre:
- Solo cubre vehículos propiedad del/operados por el asegurado.
- La responsabilidad no excede el costo de reposición al por mayor y no incluye
  ganancia para el asegurado.
- Reclamo formal: por escrito dentro de los 30 días del siniestro.
- Período de gracia: 30 días después de la fecha de vencimiento para prima fraccionada.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN VIAJERO — ASSA TRAVEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Producto: Seguro de Viajes Internacionales ASSA Travel (SVIC-2/2011)
Aseguradora: ASSA Compañía de Seguros, S.A.
IMPORTANTE: Las coberturas aplican solo en países extranjeros (no en el país de
residencia), EXCEPTO la Cancelación de Viaje (inicia desde la emisión del certificado)
y el Retraso de Viaje (aplica durante conexiones/escalas fuera de la ciudad de residencia).
Edad máxima: 80 años (la póliza se cancela automáticamente al 80° cumpleaños).

### Coberturas Principales (según el Plan Contratado):
3.1 MUERTE ACCIDENTAL: paga la suma asegurada (menos montos pagados por
   invalidez/desmembramiento) al fallecimiento accidental durante el viaje.
   La muerte debe ocurrir dentro de los 180 días del accidente.

3.2 INCAPACIDAD PERMANENTE POR ACCIDENTE: paga según tabla de invalidez.
   Total (100%): alienación mental incurable; fractura de médula espinal causante
   de incapacidad permanente total.
   Ejemplos parciales: sordera ambos oídos 50%; pérdida de ojo/50% visión binocular
   40%; un oído 15%; brazos 65%/52% (der/izq); manos 60%/48% (der/izq); pierna 55%;
   pie 40%. Si múltiples: suman los porcentajes (máx. 100%). Si suma de parciales
   llega al 80% = se trata como total.
   NO aplica a personas mayores de 65 años, jubilados o pensionados.

3.3 ASISTENCIA MÉDICA POR ACCIDENTE Y/O ENFERMEDAD: servicios médicos/hospitalarios,
   exámenes médicos, radiología, laboratorio, anestesia, fisioterapia (si la prescribe
   el médico tratante), emergencias médicas durante el viaje.
   IMPORTANTE: Si se descubre una condición preexistente, los beneficios se suspenden
   de inmediato; todos los costos en curso pasan a ser responsabilidad del asegurado.

3.4 ASISTENCIA ODONTOLÓGICA POR ACCIDENTE Y/O ENFERMEDAD: tratamiento dental de
   emergencia (el primer tratamiento debe ser en el extranjero, dentro de las 24 horas
   del inicio del dolor). La cobertura se extiende 30 días desde el primer tratamiento.

3.5 MEDICAMENTOS: medicamentos prescritos requeridos por accidente cubierto o
   enfermedad súbita.

3.6 RECUPERACIÓN EN HOTEL — CONVALECENCIA: estadía en hotel post-hospitalización
   por órdenes médicas. Requiere preautorización del asegurador.

3.7 ACOMPAÑANTE EN CASO DE HOSPITALIZACIÓN PROLONGADA (>5 días):
   - Pasaje aéreo de ida y vuelta en clase económica para un acompañante designado.
   - Alojamiento en hotel para el acompañante.

3.8 EVACUACIÓN MÉDICA DE EMERGENCIA: transporte médico de emergencia desde el
   lugar del accidente/enfermedad hasta el hospital apropiado más cercano o de
   regreso al país donde comenzó el viaje. Debe preautorizarse a través de la
   Central de Asistencia.

3.9 REPATRIACIÓN FUNERARIA: traslado de los restos al país de residencia habitual.
   Incluye ataúd ordinario/urna funeraria, todos los trámites burocráticos, aéreos,
   embalsamado.

3.10 CANCELACIÓN DEL VIAJE: reembolso de gastos de hotel/transporte prepagados y no
    reembolsables si el viaje no puede comenzar por enfermedad súbita, accidente o
    muerte del asegurado, acompañante o familiar. Requiere notificación al asegurador
    y al operador turístico dentro de las 24 horas. La enfermedad debe surgir DESPUÉS
    de la fecha de emisión de la póliza.

3.11 INTERRUPCIÓN DEL VIAJE: reembolso de gastos prepagados no reembolsables si el
    viaje no puede completarse por incendio/robo en la casa del asegurado, enfermedad
    súbita, accidente o muerte. Incluye regreso anticipado en clase económica.

3.14 RETRASO DE VIAJE: reembolso de gastos de alojamiento y alimentación por retrasos
    de vuelo de 12+ horas por: condiciones climáticas severas, huelga de empleados de
    aerolínea, falla mecánica inesperada. Vuelos chárter EXCLUIDOS.

3.15 PÉRDIDA DE EQUIPAJE: USD $50 por kilo de equipaje perdido/robado mientras está
    bajo la responsabilidad de la empresa de transporte (hasta la suma contratada).
    Requiere PIR (Informe de Irregularidad de Propiedad).

3.16 DEMORA DE EQUIPAJE: reembolso de compras de efectos personales básicos si el
    equipaje no llega dentro de las 24 horas de la llegada al destino. No aplica si
    el destino es la residencia del asegurado.

3.17 PAGO DE FIANZAS: pago/reembolso de gastos de fianza por detención injusta por
    parte de una autoridad extranjera.

### Exclusiones Críticas ASSA Travel:
- Condiciones preexistentes y sus consecuencias (excepto Repatriación Funeraria;
  e Interrupción/Cancelación si la póliza se emitió dentro de las 72 horas del pago
  del hotel/transporte reservado).
- Deportes extremos/peligrosos: polo, hockey, alpinismo, deportes aéreos, artes
  marciales en competencia, buceo autónomo >30 metros o que requiera descompresión,
  deportes de hielo/nieve competitivos, carreras de automovilismo/motociclismo,
  deportes acuáticos motorizados, motonieve.
- Suicidio, intento de suicidio, lesiones autoinfligidas intencionales.
- Enfermedades de transmisión sexual; SIDA/VIH.
- Embarazo o condiciones relacionadas; diagnóstico/tratamiento de infertilidad;
  control natal.
- Bajo influencia de drogas, alcohol o sustancias tóxicas.
- Actos de terrorismo (ampliamente definidos como violencia política/religiosa/
  ideológica).
- Viaje a/a través de Afganistán, Cuba, República Democrática del Congo, Irán, Iraq,
  Liberia o Siria.
- Operar o entrenarse para operar cualquier aeronave, o servir como tripulación.
- Participación en peleas o duelos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN EQUIPO ELECTRÓNICO (ASSA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Producto: Póliza de Equipo Electrónico (No. 01.12.98)
Aseguradora: ASSA Compañía de Seguros, S.A.

Cubre pérdida o daño físico súbito e imprevisto al equipo electrónico (de baja corriente
para oficinas: computadoras, copiadoras, impresoras, calculadoras, fax, centrales
telefónicas) una vez que la instalación y puesta en marcha inicial estén completadas.
Sección I — Daños Materiales: incendio/rayo/explosión/implosión; humo/hollín/gases o
líquidos o polvos corrosivos; inundación/agua/humedad (NO de condiciones atmosféricas
normales); cortocircuito/arco voltaico/perturbaciones magnéticas/sobretensiones causadas
por rayos; errores de construcción/fallas de montaje/defectos de material; errores de
manejo/descuido/impericia; daños malintencionados por terceros; robo con forzamiento;
granizo/helada/tempestad; hundimiento del terreno/deslizamiento.
Sección II — Portadores Externos de Datos: cubre daño material a portadores externos
de datos (y la información almacenada). La indemnización cubre los gastos para restaurar
los portadores de datos y reproducir la información perdida a su estado anterior a la
pérdida, comprobados dentro de los 12 meses.
Sección III — Incremento en el Costo de Operación: si una pérdida de la Sección I
causa interrupción parcial/total del sistema de procesamiento de datos, cubre los
gastos adicionales para usar un sistema externo sustituto.
Coberturas Opcionales: Terremoto (Cob. IV.1); Tifón/Ciclón/Huracán (IV.2);
Huelga, Motín y Conmoción Civil-HMCC (IV.3, límite por evento, máximo 2x el límite
por evento para toda la vigencia); Hurto (IV.4, el asegurado coparticipa con el 25%
de cada pérdida, mín. B/.75.00); Equipos Móviles y Portátiles Fuera de Instalaciones (IV.5).
Coberturas opcionales IV.4 (hurto) y IV.5 (fuera de instalaciones) NO son automáticas;
deben contratarse específicamente.
Exclusiones clave: terremotos/ciclones/hurtos (a menos que se contraten los opcionales);
defectos preexistentes conocidos; falla del suministro público de electricidad/gas/agua;
desgaste/erosión/corrosión gradual; costos de mantenimiento; responsabilidad legal del
fabricante/proveedor; pérdidas consecuentes; partes consumibles/fungibles.
Co-aseguro: si la suma asegurada es inferior al valor de reposición requerido, la
compañía indemniza solo la proporción (suma asegurada / monto requerido).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN EQUIPO PESADO (ASSA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Producto: Póliza de Equipo Pesado (No. 28.10.94-Rev.98)
Aseguradora: ASSA Compañía de Seguros, S.A.

Cubre equipo y maquinaria listados en las Condiciones Particulares, por daño dentro
de la República de Panamá causado por: incendio y/o rayo; explosión (EXCEPTO explosión
interna de caldera o explosión interna); ciclón/tornado/huracán; inundación (avenidas
de agua); terremoto y alud de tierra; desplome o hundimiento de puentes/muelles/
alcantarillas; colisión/descarrilamiento/vuelco del medio de conducción (durante
el transporte); robo; colisión/vuelco/caída de máquinas operadas por gasolina,
diésel, petróleo, vapor o electricidad.
Exclusiones clave: sobrecarga (exceder capacidad autorizada); vehículos que requieren
placas; propiedades/bienes subterráneos; bienes que se hayan convertido en parte
permanente de alguna estructura; daños a dinamos/motores/mecanismos eléctricos causados
por perturbaciones eléctricas (EXCEPTO si resultan en incendio); desgaste/deterioro
gradual; bienes en almacenamiento en instalaciones propiedad/alquiladas/controladas
por el asegurado; daño/robo de neumáticos y baterías (EXCEPTO como consecuencia de
un accidente cubierto o robo total del equipo); lucro cesante; infidelidad de empleados;
violación de leyes/regulaciones.
Co-aseguro: el asegurado debe mantener seguro por al menos el 100% del valor real.
Si hay insuficiencia, absorbe la parte proporcional de la pérdida.
Suma asegurada: se reduce por cada reclamación pagada EXCEPTO en pérdida total; entonces
debe reinstalarse la suma total con prima adicional prorrateada desde la fecha del
siniestro.
Aviso de siniestro: inmediato por teléfono/telégrafo Y por escrito dentro de las
24 horas con todas las circunstancias; notificación inmediata a las autoridades competentes.
Informe completo de pérdida: dentro de los 60 días del siniestro.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECCIÓN SERVICIOS DE ASISTENCIA VEHICULAR — FEDPA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANTE: Los productos FEDPA de asistencia NO son pólizas de indemnización estándar.
Son servicios de asistencia. TODOS los servicios deben solicitarse a través de
FEDPA ASISTENCIA ANTES de que el asegurado tome cualquier acción o realice cualquier pago.
Teléfono: (507) 340-5400 | WhatsApp (mensajes): 6320-8722 | 24/7/365 días.

### FEDPA COMERCIAL PLUS (Endoso para Vehículos Comerciales):
| Cobertura                      | Límite por Evento | Límite Anual     |
|--------------------------------|-------------------|------------------|
| Inspección IN SITU por accidente | Ilimitado       | Ilimitado        |
| Grúa por accidente             | 1 evento máx      | hasta $150.00    |
| Grúa por avería                | 1 evento máx      | hasta $100.00    |
| Auxilio Vial (cambio llanta, etc.)| 1 evento máx   | hasta $100.00    |
| Cerrajería vehicular           | 1 evento máx      | hasta $80.00     |
| Ambulancia por accidente vial  | Ilimitado         | $200.00 anuales  |
| Mediphone (orientación médica tel.) | Ilimitado    | Ilimitado        |
| Telemedicina (titular+cónyuge+hijos<21, máx 3)| Ilimitado | Ilimitado |

Área de cobertura de ambulancia: área metropolitana de Ciudad de Panamá (Las Cumbres/
Puente Don Bosco hasta 24 de Diciembre/Mega Mall, este hasta oeste hasta Capira/Puente
Perequeté) y área metropolitana de Colón.

### FEDPA COMERCIAL VIP (Póliza de Servicios para Vehículos Comerciales):
Igual que FEDPA Comercial Plus pero con cobertura de grúa por accidente de $150
(sin grúa por avería, sin auxilio vial).

### FEDPA COMERCIAL BÁSICO:
| Cobertura                      | Límite por Evento | Límite Anual     |
|--------------------------------|-------------------|------------------|
| Inspección IN SITU             | Ilimitado         | Ilimitado        |
| Grúa por accidente             | 1 evento máx      | hasta $100.00    |

Exclusiones comunes a todos los FEDPA Asistencia:
- Dolo o mala fe del asegurado o conductor del vehículo asegurado.
- Fenómenos naturales extraordinarios: inundaciones, terremotos, erupciones volcánicas,
  tormentas ciclónicas.
- Robo, abuso de confianza o uso del vehículo sin consentimiento del asegurado.
- Terrorismo, huelgas, asonadas, motines, tumultos populares.
- Servicios contratados, gestionados y pagados por el asegurado sin autorización previa
  de la Prestadora (excepto en casos de fuerza mayor probada que impida el contacto).
- Gastos de prácticas deportivas en competencias.
- Asistencia y gastos para ocupantes del vehículo transportados gratuitamente (rides/autostop).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONCEPTOS GENERALES DEL MERCADO DE SEGUROS — DEFINICIONES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Conceptos de Salud:
DEDUCIBLE: Monto de los primeros gastos cubiertos que el asegurado debe pagar antes
de que la compañía comience a pagar. Se aplica por asegurado por año de póliza.
COASEGURO: Porcentaje de los gastos cubiertos que el asegurado debe asumir después de
cumplido el deducible. Ej: si el coaseguro es 20%, el asegurado paga el 20% y la
aseguradora el 80%.
STOP LOSS / MÁXIMA PARTICIPACIÓN ASEGURADA: Monto máximo de coaseguro que el asegurado
paga por año. Una vez alcanzado este límite, la aseguradora paga el 100% de los gastos
cubiertos. IMPORTANTE: El stop loss solo aplica al coaseguro; los deducibles, copagos,
excesos del URA y penalidades por falta de preautorización están EXCLUIDOS del cálculo.
COPAGO: Monto fijo o porcentaje que el asegurado paga directamente al prestador.
CONDICIÓN PREEXISTENTE: Enfermedad/lesión que se manifestó o para la que el asegurado
recibió consulta, diagnóstico, tratamiento o medicación ANTES de la fecha de vigencia
de la póliza. Incluye causas, complicaciones, secuelas y efectos tardíos.
PERÍODO DE ESPERA: Tiempo durante el cual ciertas condiciones específicas no están
cubiertas, contado desde la fecha de inclusión del asegurado.
CONTINUIDAD DE COBERTURA: Derecho a continuar cubierto por condiciones diagnosticadas
y cubiertas bajo una póliza anterior. La compañía debe aceptar; los gastos previos se
deducen de los nuevos límites.
DERECHO DE CONVERSIÓN: Derecho a convertir a póliza individual al terminar la póliza
colectiva sin evidencia de asegurabilidad. Póliza individual: mínimo 1 año de permanencia;
póliza colectiva: mínimo 5 años. Debe solicitarse dentro de los 31 días del término.
URA (USUAL, RAZONABLE Y ACOSTUMBRADO): Cargo considerado razonable hasta el nivel
acostumbrado no excediendo el nivel general cobrado por prestadores similares en la misma
área geográfica por los mismos servicios.
RED DE PRESTADORES: Médicos, hospitales, clínicas, labs y centros de diagnóstico
designados por la compañía con los que tiene precios pactados.
EMERGENCIA MÉDICA: Amenaza inmediata para la vida que requiere atención urgente
(dolor torácico, signos de ACV, pérdida de conocimiento, fractura, anafilaxia).
URGENCIA MÉDICA: No es amenaza inmediata pero podría convertirse en emergencia si no
se trata (fiebre, dolor de oído/garganta, quemaduras menores, infección urinaria, esguince).

## Conceptos de Vida:
SUMA ASEGURADA: Monto que la aseguradora pagará al ocurrir el evento asegurado.
BENEFICIARIO: Persona natural o jurídica designada por el asegurado para recibir el pago
al fallecimiento. Puede modificarse en cualquier momento por aviso escrito a la compañía.
VALOR DE RESCATE: Monto acumulado en las pólizas de vida permanente/universal que el
asegurado puede retirar o usar como colateral para préstamos.
PERIODO DE GRACIA: Tiempo (generalmente 30 días) después del vencimiento de la prima
durante el cual la póliza permanece en vigor. Si el asegurado fallece durante el período
de gracia, la prima pendiente se deduce del beneficio.
DISPUTABILIDAD: Derecho de la compañía a anular la cobertura si el asegurado
proporcionó información falsa/incompleta, durante los primeros 2 años de vigencia.
SUICIDIO: Durante los primeros 2 años de vigencia → la compañía devuelve solo la prima
no devengada. Después de los 2 años → el beneficio de fallecimiento es totalmente pagadero.
MUERTE ACCIDENTAL Y DESMEMBRAMIENTO (AD&D): Suma adicional pagadera si el fallecimiento
resulta de causa accidental (externa, violenta, involuntaria). La muerte debe ocurrir
dentro de 90 días del accidente. Las enfermedades NO califican como accidentes.
INCAPACIDAD TOTAL Y PERMANENTE: Incapacidad completa para dedicarse a cualquier
ocupación remunerada para la que el asegurado esté calificado (por educación, formación,
experiencia), durante un período ininterrumpido de al menos 12 meses (o 6 meses en
pólizas de vida universal).
ADELANTO POR ENFERMEDAD TERMINAL: Disponible en muchas pólizas de vida. Permite recibir
anticipadamente hasta el 50% de la suma asegurada si el asegurado tiene un diagnóstico
terminal con expectativa de vida de 12 meses o menos.

## Conceptos de Propiedad/Comerciales:
VALOR DE REPOSICIÓN: Costo para reemplazar el bien con uno nuevo de la misma clase y
capacidad, incluyendo flete, impuestos y aranceles aduaneros. NO considera depreciación.
VALOR REAL: Valor de mercado del bien en su condición de uso y desgaste actual.
INFRAASEGURO (Cláusula Proporcional): Cuando la suma asegurada es menor que el valor
real del bien al momento del siniestro. En este caso, la compañía solo paga
proporcionalmente: indemnización = (suma asegurada / valor real) × pérdida real.
DEDUCIBLE: Siempre a cargo del asegurado, siempre fijado en las Condiciones Particulares.
PÉRDIDA TOTAL: Cuando los daños superan un porcentaje determinado del valor asegurado
(generalmente 75-80%) o cuando la reparación es económicamente inviable.
PÉRDIDA TOTAL CONSTRUCTIVA: Cuando los daños no alcanzan el umbral de pérdida total
pero los costos de reparación hacen que la reparación sea económicamente irrazonable.

## Conceptos de Responsabilidad Civil:
RC PREDIOS Y OPERACIONES: Cubre la responsabilidad del propietario/operador de
instalaciones por daños causados a terceros dentro de ellas o por sus operaciones.
RC FABRICANTES Y CONTRATISTAS: Cubre la responsabilidad derivada de las actividades
de manufactura o contratación.
RC PRODUCTOS: Cubre la responsabilidad por daños causados por productos ya entregados
a terceros (aplica FUERA de las instalaciones del fabricante, DESPUÉS de la entrega).
RC PATRONAL: Cubre la responsabilidad del empleador hacia sus empleados por accidentes
o enfermedades profesionales durante las operaciones comerciales.
RC LEGAL POR INCENDIO: Cubre la responsabilidad legal del arrendatario hacia el
propietario por daños al edificio causados por un incendio originado en las instalaciones
arrendadas. SOLO aplica cuando el asegurado NO es el propietario del edificio.
COBERTURA CRUZADA: Permite que cada asegurado bajo la misma póliza sea tratado como
un tercero respecto a los demás para efectos de reclamaciones de RC.
LÍMITE ÚNICO COMBINADO (LUC): Un solo límite máximo que cubre tanto lesiones corporales
como daños a la propiedad de terceros, en lugar de tener límites separados para cada uno.

## Conceptos de Carga/Transporte:
CLÁUSULA PROPORCIONAL (Co-aseguro de Carga): La compañía no es responsable por una
proporción mayor de la pérdida que la que corresponde a la suma asegurada respecto al
100% del valor real de los bienes en el lugar y momento de la pérdida.
AVERÍA PARTICULAR: Pérdida o daño que afecta solo a los bienes asegurados,
distinguiéndose de la Avería General (pérdidas compartidas en beneficio común).
AVERÍA GRUESA/GENERAL: Sacrificio voluntario de bienes o gastos extraordinarios
incurridos para preservar el buque y su carga. Los costos se distribuyen entre todos
los interesados en proporción a sus valores.
ABANDONO: Declaración del asegurado de que renuncia en favor del asegurador a los
bienes dañados para recibir la indemnización como si fuera pérdida total.
PIR (Property Irregularity Report): Documento que debe obtenerse al momento de
reclamar pérdida de equipaje a la aerolínea o empresa de transporte. OBLIGATORIO
para reclamaciones de equipaje.
PÓLIZA FLOTANTE/ABIERTA: Póliza que cubre automáticamente todos los embarques
recibidos o enviados sin necesidad de declarar cada uno por separado; el asegurado
declara mensualmente todos los embarques del mes anterior.
VOUCHER DE DECLARACIÓN OMITIDA INVOLUNTARIA: Si por error involuntario no se declaró
un embarque, la póliza NO se anula; ese embarque sigue cubierto, pero la compañía
retiene el derecho a la prima. La omisión VOLUNTARIA (intencional) anula la póliza.

</mercado_y_productos_seguros>
`;
