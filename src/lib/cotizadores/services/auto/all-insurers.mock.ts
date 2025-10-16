/**
 * Mock Service: Cotización de Auto
 * Retorna opciones de TODAS las aseguradoras disponibles
 */

import type { AutoQuoteInput, QuoteResult, QuoteOption } from '../../types';

export async function quoteAuto(input: AutoQuoteInput): Promise<QuoteResult> {
  // Simular delay de API
  await new Promise(resolve => setTimeout(resolve, 1500));

  const isCompleta = input.cobertura === 'COMPLETA';
  const basePrice = input.valor ? input.valor * 0.05 : 1200;
  
  // Factor por edad del conductor
  const ageFactor = input.conductorEdad && input.conductorEdad < 25 ? 1.3 : 1.0;
  
  // Factor por siniestros
  const claimsFactor = input.siniestrosUltimos3 ? 1 + (input.siniestrosUltimos3 * 0.15) : 1.0;
  
  // Factor por cobertura
  const coverageFactor = isCompleta ? 1.8 : 1.0;

  const options: QuoteOption[] = [
    {
      insurerId: 'mock-assa',
      insurerName: 'ASSA',
      insurerLogoUrl: undefined, // Se obtiene del sistema
      planName: isCompleta ? 'Auto Plus' : 'Responsabilidad Civil',
      prima: Math.round(basePrice * coverageFactor * ageFactor * claimsFactor * 0.95),
      deducible: isCompleta ? '$500' : 'N/A',
      coberturasClave: isCompleta 
        ? ['Daños propios', 'Daños a terceros', 'Robo total', 'Asistencia vial 24/7']
        : ['Daños a terceros', 'Lesiones corporales'],
      exclusionesClave: ['Daños intencionales', 'Conductor sin licencia'],
      observaciones: 'Incluye descuento por garaje nocturno'
    },
    {
      insurerId: 'mock-mapfre',
      insurerName: 'MAPFRE',
      insurerLogoUrl: undefined,
      planName: isCompleta ? 'Todo Riesgo' : 'Terceros Ampliado',
      prima: Math.round(basePrice * coverageFactor * ageFactor * claimsFactor * 1.05),
      deducible: isCompleta ? '$750' : 'N/A',
      coberturasClave: isCompleta
        ? ['Daños propios', 'Daños a terceros', 'Robo total', 'Cristales', 'Auto sustituto']
        : ['Daños a terceros', 'Lesiones', 'Defensa legal'],
      exclusionesClave: ['Competencias', 'Conductores menores de 21'],
      observaciones: 'Prima incluye impuestos'
    },
    {
      insurerId: 'mock-ace',
      insurerName: 'ACE',
      insurerLogoUrl: undefined,
      planName: isCompleta ? 'Protección Total' : 'Básico Legal',
      prima: Math.round(basePrice * coverageFactor * ageFactor * claimsFactor * 1.1),
      deducible: isCompleta ? '$1000' : 'N/A',
      coberturasClave: isCompleta
        ? ['Cobertura amplia', 'Robo', 'Desastres naturales', 'Asistencia premium']
        : ['Responsabilidad civil', 'Gastos médicos'],
      exclusionesClave: ['Uso comercial no declarado'],
      observaciones: 'Descuento por buen historial'
    },
    {
      insurerId: 'mock-fedpa',
      insurerName: 'FEDPA',
      insurerLogoUrl: undefined,
      planName: isCompleta ? 'Full Coverage' : 'Terceros',
      prima: Math.round(basePrice * coverageFactor * ageFactor * claimsFactor * 0.98),
      deducible: isCompleta ? '$600' : 'N/A',
      coberturasClave: isCompleta
        ? ['Daños propios', 'Terceros', 'Robo', 'Eventos naturales']
        : ['Daños a terceros', 'Defensa legal'],
      exclusionesClave: ['Conductores no autorizados'],
      observaciones: 'Pago anual con descuento del 10%'
    }
  ];

  return {
    policyType: 'AUTO',
    input,
    options,
    currency: 'USD',
    generatedAt: new Date().toISOString()
  };
}
