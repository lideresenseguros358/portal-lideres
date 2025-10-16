/**
 * Mock Service: Cotización de Incendio y Contenido
 * Solo 2 aseguradoras disponibles
 */

import type { FireContentsQuoteInput, QuoteResult, QuoteOption } from '../../types';

export async function quoteFuegoTwo(input: FireContentsQuoteInput): Promise<QuoteResult> {
  // Simular delay de API
  await new Promise(resolve => setTimeout(resolve, 1500));

  const isIncendio = input.policyType === 'INCENDIO';
  const sumaAsegurada = isIncendio 
    ? (input.sumaEstructura || 100000)
    : (input.sumaContenido || 50000);

  // Tasa base según tipo de inmueble
  let baseRate = 0.002; // 0.2%
  if (input.tipoInmueble === 'CASA') baseRate = 0.0025;
  if (input.tipoInmueble === 'LOCAL') baseRate = 0.003;

  // Descuento por seguridad
  let securityDiscount = 1.0;
  if (input.seguridad.alarma) securityDiscount -= 0.05;
  if (input.seguridad.extintor) securityDiscount -= 0.03;
  if (input.seguridad.rociadores) securityDiscount -= 0.07;

  // Factor por año de construcción
  const ageFactor = input.annoConstruccion && input.annoConstruccion < 1990 ? 1.2 : 1.0;

  const options: QuoteOption[] = [
    {
      insurerId: 'mock-assa',
      insurerName: 'ASSA',
      insurerLogoUrl: undefined,
      planName: isIncendio ? 'Protección Hogar' : 'Contenido Plus',
      prima: Math.round(sumaAsegurada * baseRate * securityDiscount * ageFactor * 0.95),
      deducible: '1% del valor asegurado (mín. $500)',
      coberturasClave: isIncendio ? [
        'Incendio y rayo',
        'Explosión',
        'Daños por agua',
        'Terremoto (opcional)',
        'Responsabilidad civil'
      ] : [
        'Robo y hurto',
        'Incendio de contenido',
        'Daños por agua a contenido',
        'Remoción de escombros'
      ],
      exclusionesClave: [
        'Desgaste natural',
        'Daños por plagas',
        'Guerra y actos terroristas'
      ],
      observaciones: 'Incluye asistencia 24/7 para emergencias'
    },
    {
      insurerId: 'mock-mapfre',
      insurerName: 'MAPFRE',
      insurerLogoUrl: undefined,
      planName: isIncendio ? 'Multiriesgo Hogar' : 'Contenido Seguro',
      prima: Math.round(sumaAsegurada * baseRate * securityDiscount * ageFactor * 1.05),
      deducible: '2% del valor asegurado (mín. $750)',
      coberturasClave: isIncendio ? [
        'Incendio completo',
        'Fenómenos naturales',
        'Daños eléctricos',
        'Cristales y vidrios',
        'RC inquilinos'
      ] : [
        'Robo de contenido',
        'Daño a muebles y enseres',
        'Electrodomésticos',
        'Equipos electrónicos'
      ],
      exclusionesClave: [
        'Pérdidas indirectas',
        'Objetos de valor > $5,000 sin declaración'
      ],
      observaciones: 'Pago fraccionado sin recargo'
    }
  ];

  return {
    policyType: input.policyType,
    input,
    options,
    currency: 'USD',
    generatedAt: new Date().toISOString()
  };
}
