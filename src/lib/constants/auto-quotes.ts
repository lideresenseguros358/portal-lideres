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
  emissionPlanCode?: number;
  includedCoverages?: string[];
  idCotizacion?: string | number;
  vcodplancobertura?: number;
  vcodgrupotarifa?: number;
  vcodmarca?: number;
  vcodmodelo?: number;
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
      name: 'Plan Básico (SOAT)',
      coverages: {
        bodilyInjury: '',
        propertyDamage: '',
        medicalExpenses: '',
        accidentalDeathDriver: '',
        accidentalDeathPassengers: '',
        funeralExpenses: '',
        accidentAssistance: '',
        ambulance: '',
        roadAssistance: '',
        towing: '',
        legalAssistance: '',
      },
      annualPremium: 154.00,
      installments: {
        available: false,
        description: 'Solo al contado',
      },
    },
    premiumPlan: {
      name: 'Plan Intermedio',
      coverages: {
        bodilyInjury: '',
        propertyDamage: '',
        medicalExpenses: '',
        accidentalDeathDriver: '',
        accidentalDeathPassengers: '',
        funeralExpenses: '',
        accidentAssistance: '',
        ambulance: '',
        roadAssistance: '',
        towing: '',
        legalAssistance: '',
      },
      annualPremium: 183.00,
      installments: {
        available: false,
        description: 'Solo al contado',
      },
    },
  },
  {
    id: 'fedpa',
    name: 'FEDPA Seguros',
    color: 'bg-yellow-500',
    emoji: '🟨',
    basicPlan: {
      name: 'Plan Básico',
      opcion: 'A',
      planCode: 1000,
      endosoPdf: '/API FEDPA/ENDOSO ASIST BASICO.pdf',
      coverages: {
        bodilyInjury: '',
        propertyDamage: '',
        medicalExpenses: '',
        accidentalDeathDriver: '',
        accidentalDeathPassengers: '',
        funeralExpenses: '',
        accidentAssistance: '',
        ambulance: '',
        roadAssistance: '',
        towing: '',
        legalAssistance: '',
      },
      annualPremium: 130,
      installments: {
        available: true,
        description: '2 cuotas mensuales',
        amount: 79.13,
        payments: 2,
        totalWithInstallments: 158.26,
      },
      includedCoverages: ['A', 'B', 'FAB', 'H-1', 'K6'],
    },
    premiumPlan: {
      name: 'Plan VIP',
      opcion: 'C',
      planCode: 1002,
      endosoPdf: '/API FEDPA/ENDOSO ASIST VIP.pdf',
      coverages: {
        bodilyInjury: '',
        propertyDamage: '',
        medicalExpenses: '',
        accidentalDeathDriver: '',
        accidentalDeathPassengers: '',
        funeralExpenses: '',
        accidentAssistance: '',
        ambulance: '',
        roadAssistance: '',
        towing: '',
        legalAssistance: '',
      },
      annualPremium: 165,
      installments: {
        available: true,
        description: '2 cuotas mensuales',
        amount: 100.44,
        payments: 2,
        totalWithInstallments: 200.87,
      },
      includedCoverages: ['A', 'B', 'C', 'FAV', 'H-1', 'K6'],
    },
  },
  {
    id: 'regional',
    name: 'La Regional de Seguros',
    color: 'bg-red-500',
    emoji: '🟥',
    basicPlan: {
      name: 'Plan Básico',
      planCode: 30,
      endoso: 'Endoso Básico',
      coverages: {
        bodilyInjury: '',
        propertyDamage: '',
        medicalExpenses: '',
        accidentalDeathDriver: '',
        accidentalDeathPassengers: '',
        funeralExpenses: '',
        accidentAssistance: '',
        ambulance: '',
        roadAssistance: '',
        towing: '',
        legalAssistance: '',
      },
      annualPremium: 145,
      installments: {
        available: false,
        description: 'Solo al contado',
      },
    },
    premiumPlan: {
      name: 'Plan Premium',
      planCode: 31,
      endoso: 'Endoso Plus',
      coverages: {
        bodilyInjury: '',
        propertyDamage: '',
        medicalExpenses: '',
        accidentalDeathDriver: '',
        accidentalDeathPassengers: '',
        funeralExpenses: '',
        accidentAssistance: '',
        ambulance: '',
        roadAssistance: '',
        towing: '',
        legalAssistance: '',
      },
      annualPremium: 162,
      installments: {
        available: false,
        description: 'Solo al contado',
      },
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
  'REGIONAL',
];
