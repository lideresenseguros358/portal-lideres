/**
 * Mock Service: Cotización de Vida
 * Solo ASSA (vida no web por ahora)
 */

import type { VidaQuoteInput, QuoteResult, QuoteOption } from '../../types';

export async function quoteVidaASSA(input: VidaQuoteInput): Promise<QuoteResult> {
  // Simular delay de API
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Cálculo de prima basado en edad, fumador y suma asegurada
  const baseRate = 0.003; // 0.3% de la suma asegurada
  
  // Factor por edad
  let ageFactor = 1.0;
  if (input.edad > 50) ageFactor = 2.0;
  else if (input.edad > 40) ageFactor = 1.5;
  else if (input.edad > 30) ageFactor = 1.2;
  
  // Factor por fumador
  const smokingFactor = input.fumador ? 1.5 : 1.0;
  
  // Prima anual
  const primaAnual = Math.round(
    input.sumaAsegurada * baseRate * ageFactor * smokingFactor
  );

  const options: QuoteOption[] = [
    {
      insurerId: 'mock-assa',
      insurerName: 'ASSA',
      insurerLogoUrl: undefined,
      planName: 'Vida Individual',
      prima: primaAnual,
      deducible: 'N/A',
      coberturasClave: [
        `Muerte natural: $${input.sumaAsegurada.toLocaleString()}`,
        `Muerte accidental: $${(input.sumaAsegurada * 2).toLocaleString()}`,
        'Invalidez total y permanente',
        'Enfermedades graves (opcional)'
      ],
      exclusionesClave: [
        'Suicidio en primer año',
        'Enfermedades preexistentes no declaradas',
        'Actividades de alto riesgo'
      ],
      observaciones: input.fumador 
        ? 'Prima ajustada por condición de fumador'
        : 'Prima preferencial por no fumador'
    }
  ];

  // Si la edad es mayor a 65 o la suma es muy alta, agregar nota
  if (input.edad > 65 || input.sumaAsegurada > 500000) {
    if (options[0]) {
      options[0].observaciones = (options[0].observaciones || '') + '. Requiere evaluación médica adicional';
    }
  }

  return {
    policyType: 'VIDA',
    input,
    options,
    currency: 'USD',
    generatedAt: new Date().toISOString()
  };
}
