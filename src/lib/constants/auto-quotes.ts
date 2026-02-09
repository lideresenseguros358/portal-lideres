// Tarifas de Daños a Terceros - Datos fijos por aseguradora
// Actualizado: 8 de febrero de 2026

export interface CoverageItem {
  code: string;
  name: string;
  limit: string;
  prima: number;
  primaBase?: number;
}

export interface AutoThirdPartyPlan {
  name: string;
  opcion?: string;
  coverages: {
    bodilyInjury: string;
    propertyDamage: string;
    medicalExpenses: string;
    accidentalDeathDriver: string;
    accidentalDeathPassengers: string;
    funeralExpenses: string;
    accidentAssistance: string;
    ambulance: string;
    roadAssistance: string;
    towing: string;
    legalAssistance: string;
    fedpaAsist?: string;
  };
  coverageList?: CoverageItem[];
  annualPremium: number;
  installments: {
    available: boolean;
    description?: string;
    amount?: number;
    payments?: number;
    totalWithInstallments?: number;
  };
  notes?: string;
  endoso?: string;
  endosoPdf?: string;
  endosoBenefits?: string[];
  planCode?: number;
  includedCoverages?: string[];
  idCotizacion?: string | number;
}

export interface AutoInsurer {
  id: string;
  name: string;
  color: string;
  emoji: string;
  basicPlan: AutoThirdPartyPlan;
  premiumPlan: AutoThirdPartyPlan;
}

export const AUTO_THIRD_PARTY_INSURERS: AutoInsurer[] = [
  {
    id: 'internacional',
    name: 'INTERNACIONAL de Seguros',
    color: 'bg-blue-500',
    emoji: '🟦',
    basicPlan: {
      name: 'Plan Básico',
      coverages: {
        bodilyInjury: '5,000 / 10,000',
        propertyDamage: '5,000',
        medicalExpenses: '500 / 2,500',
        accidentalDeathDriver: 'no',
        accidentalDeathPassengers: 'no',
        funeralExpenses: 'no',
        accidentAssistance: 'sí',
        ambulance: 'sí',
        roadAssistance: 'Conexión',
        towing: 'Conexión',
        legalAssistance: 'no',
      },
      annualPremium: 154.00,
      installments: {
        available: false,
        description: 'No aplica',
      },
    },
    premiumPlan: {
      name: 'Plan Premium',
      coverages: {
        bodilyInjury: '10,000 / 20,000',
        propertyDamage: '10,000',
        medicalExpenses: '2,000 / 10,000',
        accidentalDeathDriver: 'no',
        accidentalDeathPassengers: 'no',
        funeralExpenses: 'no',
        accidentAssistance: 'sí',
        ambulance: 'sí',
        roadAssistance: 'sí',
        towing: 'Por accidente o avería (hasta B/.150.00 o máximo 3 eventos por año)',
        legalAssistance: 'sí',
      },
      annualPremium: 183.00,
      installments: {
        available: true,
        description: 'Hasta 3 cuotas para pagos con TCR (tarjeta de crédito)',
        amount: 61.00,
        payments: 3,
      },
    },
  },
  {
    id: 'fedpa',
    name: 'FEDPA Seguros',
    color: 'bg-yellow-500',
    emoji: '🟨',
    basicPlan: {
      name: 'Opción A',
      opcion: 'A',
      planCode: 426,
      endoso: 'FEDPA ASIST BASICO',
      endosoPdf: '/API FEDPA/ENDOSO ASIST BASICO.pdf',
      coverages: {
        bodilyInjury: '5,000.00/10,000.00',
        propertyDamage: '5,000.00',
        medicalExpenses: 'no',
        accidentalDeathDriver: '5,000.00',
        accidentalDeathPassengers: 'no',
        funeralExpenses: '1,500.00',
        accidentAssistance: 'sí',
        ambulance: 'sí',
        roadAssistance: 'sí',
        towing: 'sí',
        legalAssistance: 'sí',
        fedpaAsist: 'FEDPA Asist Básico',
      },
      annualPremium: 161,
      installments: {
        available: true,
        description: '2 cuotas mensuales',
        amount: 98,
        payments: 2,
      },
      includedCoverages: ['A', 'B', 'FAB', 'H-1', 'K6'],
    },
    premiumPlan: {
      name: 'Opción C',
      opcion: 'C',
      planCode: 426,
      endoso: 'FEDPA ASIST VIP',
      endosoPdf: '/API FEDPA/ENDOSO ASIST VIP.pdf',
      coverages: {
        bodilyInjury: '5,000.00/10,000.00',
        propertyDamage: '10,000.00',
        medicalExpenses: '500.00/2,500.00',
        accidentalDeathDriver: '5,000.00',
        accidentalDeathPassengers: 'no',
        funeralExpenses: '1,500.00',
        accidentAssistance: 'sí',
        ambulance: 'sí',
        roadAssistance: 'sí',
        towing: 'sí',
        legalAssistance: 'sí',
        fedpaAsist: 'FEDPA Asist VIP',
      },
      annualPremium: 175,
      installments: {
        available: true,
        description: '2 cuotas mensuales',
        amount: 106,
        payments: 2,
      },
      includedCoverages: ['A', 'B', 'C', 'FAV', 'H-1', 'K6'],
    },
  },
];

export const COVERAGE_LABELS: Record<string, string> = {
  bodilyInjury: 'Lesiones corporales',
  propertyDamage: 'Daños a la propiedad',
  medicalExpenses: 'Gastos médicos',
  accidentalDeathDriver: 'Muerte accidental conductor',
  accidentalDeathPassengers: 'Muerte accidental pasajeros',
  funeralExpenses: 'Gastos funerarios',
  accidentAssistance: 'Asistencia en accidentes',
  ambulance: 'Ambulancia',
  roadAssistance: 'Asistencia vial',
  towing: 'Grúa',
  legalAssistance: 'Asistencia legal',
  fedpaAsist: 'Endoso FEDPA',
};

export const COMPREHENSIVE_COVERAGE_INSURERS = [
  'ASSA',
  'ANCÓN',
  'MAPFRE',
  'FEDPA',
  'INTERNACIONAL',
];
