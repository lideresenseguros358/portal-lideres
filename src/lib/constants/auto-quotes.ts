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
        bodilyInjury: '$5,000 / $10,000',
        propertyDamage: '$5,000',
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
      coverageList: [
        { code: 'LC', name: 'Lesiones Corporales', limit: '$5,000.00 / $10,000.00', prima: 0 },
        { code: 'DPA', name: 'Daños a la Propiedad Ajena', limit: '$5,000.00', prima: 0 },
        { code: 'GM', name: 'Gastos Médicos', limit: '$500.00 / $2,500.00', prima: 0 },
      ],
      endosoBenefits: [
        'Asistencia en accidentes de tránsito',
        'Coordinación de envío de ambulancia por accidente de tránsito',
        'Asistencia vial: cambio de llanta, envío de combustible, pase de corriente (Conexión)',
        'Cerrajería vial (Conexión)',
        'Grúa por accidente o desperfectos mecánicos (Conexión)',
        'Asistencia legal en accidentes de tránsito',
        'Transmisión de mensajes urgentes',
        'Inspección "in situ"',
      ],
      endoso: 'Plan Básico (SOAT)',
      annualPremium: 154.00,
      installments: {
        available: false,
        description: 'Solo al contado',
      },
    },
    premiumPlan: {
      name: 'Plan Intermedio',
      coverages: {
        bodilyInjury: '$10,000 / $20,000',
        propertyDamage: '$10,000',
        medicalExpenses: '$500 / $2,500',
        accidentalDeathDriver: '',
        accidentalDeathPassengers: '',
        funeralExpenses: '',
        accidentAssistance: '',
        ambulance: '',
        roadAssistance: '',
        towing: '',
        legalAssistance: '',
      },
      coverageList: [
        { code: 'LC', name: 'Lesiones Corporales', limit: '$10,000.00 / $20,000.00', prima: 0 },
        { code: 'DPA', name: 'Daños a la Propiedad Ajena', limit: '$10,000.00', prima: 0 },
        { code: 'GM', name: 'Gastos Médicos', limit: '$2,000.00 / $10,000.00', prima: 0 },
      ],
      endosoBenefits: [
        'Asistencia legal en accidentes de tránsito',
        'Asistencia en accidentes de tránsito',
        'Coordinación de envío de ambulancia por accidente de tránsito',
        'Asistencia vial: cambio de llanta, envío de combustible, pase de corriente (hasta B/.150, máx. 3 eventos/año)',
        'Cerrajería vial (hasta B/.150, máx. 3 eventos/año)',
        'Grúa por accidente o desperfectos mecánicos (hasta B/.150, máx. 3 eventos/año)',
        'Transmisión de mensajes urgentes',
        'Inspección "in situ"',
        'Depósito y custodia de vehículos',
      ],
      endoso: 'Plan Intermedio (DAT 10/20)',
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
        bodilyInjury: '$5,000 / $10,000',
        propertyDamage: '$5,000',
        medicalExpenses: '',
        accidentalDeathDriver: '$5,000',
        accidentalDeathPassengers: '',
        funeralExpenses: '$1,500',
        accidentAssistance: '',
        ambulance: '',
        roadAssistance: '',
        towing: '',
        legalAssistance: '',
      },
      coverageList: [
        { code: 'A', name: 'Lesiones Corporales', limit: '$5,000.00 / $10,000.00', prima: 0 },
        { code: 'B', name: 'Daños a la Propiedad Ajena', limit: '$5,000.00', prima: 0 },
        { code: 'FAB', name: 'Endoso FEDPA Asist Básico', limit: 'INCLUIDO', prima: 0 },
        { code: 'H-1', name: 'Muerte Accidental del Conductor', limit: '$5,000.00', prima: 0 },
        { code: 'K6', name: 'Gastos Funerarios del Conductor', limit: '$1,500.00', prima: 0 },
      ],
      endosoBenefits: [
        'Asistencia legal en accidentes de tránsito',
        'Coordinación de envío de ambulancia',
        'Grúa por desperfectos mecánicos (1 evento/año, hasta $100)',
        'Transmisión de mensajes urgentes',
        'Inspección "in situ"',
      ],
      endoso: 'Endoso FEDPA Asistencia Básica',
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
        bodilyInjury: '$25,000 / $50,000',
        propertyDamage: '$25,000',
        medicalExpenses: '$2,500',
        accidentalDeathDriver: '$10,000',
        accidentalDeathPassengers: '',
        funeralExpenses: '$3,000',
        accidentAssistance: '',
        ambulance: '',
        roadAssistance: '',
        towing: '',
        legalAssistance: '',
      },
      coverageList: [
        { code: 'A', name: 'Lesiones Corporales', limit: '$25,000.00 / $50,000.00', prima: 0 },
        { code: 'B', name: 'Daños a la Propiedad Ajena', limit: '$25,000.00', prima: 0 },
        { code: 'C', name: 'Gastos Médicos', limit: '$2,500.00', prima: 0 },
        { code: 'FAV', name: 'Endoso FEDPA Asist VIP', limit: 'INCLUIDO', prima: 0 },
        { code: 'H-1', name: 'Muerte Accidental del Conductor', limit: '$10,000.00', prima: 0 },
        { code: 'K6', name: 'Gastos Funerarios del Conductor', limit: '$3,000.00', prima: 0 },
      ],
      endosoBenefits: [
        'Asistencia legal en accidentes de tránsito',
        'Coordinación de envío de ambulancia',
        'Asistencia vial: cambio de llanta, envío de combustible, pase de corriente',
        'Cerrajería vial',
        'Grúa por accidente o desperfectos mecánicos',
        'Transmisión de mensajes urgentes',
        'Inspección "in situ"',
        'Depósito y custodia de vehículos',
      ],
      endoso: 'Endoso FEDPA Asistencia VIP',
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
        bodilyInjury: '$5,000 / $10,000',
        propertyDamage: '$5,000',
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
      coverageList: [
        { code: 'LC', name: 'Lesiones Corporales', limit: '$5,000.00 / $10,000.00', prima: 0 },
        { code: 'DPA', name: 'Daños a la Propiedad Ajena', limit: '$5,000.00', prima: 0 },
      ],
      endosoBenefits: [
        'Asistencia legal en accidentes de tránsito',
        'Coordinación de envío de ambulancia por accidente de tránsito',
        'Inspección "in situ"',
        'Transmisión de mensajes urgentes',
      ],
      annualPremium: 145,
      installments: {
        available: false,
        description: 'Solo al contado',
      },
    },
    premiumPlan: {
      name: 'Plan Exceso Básico',
      planCode: 31,
      endoso: 'Exceso Básico',
      coverages: {
        bodilyInjury: '$10,000 / $20,000',
        propertyDamage: '$10,000',
        medicalExpenses: '$500 / $2,500',
        accidentalDeathDriver: '',
        accidentalDeathPassengers: '',
        funeralExpenses: '$2,000',
        accidentAssistance: '',
        ambulance: '',
        roadAssistance: '',
        towing: '',
        legalAssistance: '',
      },
      coverageList: [
        { code: 'LC', name: 'Lesiones Corporales', limit: '$10,000.00 / $20,000.00', prima: 0 },
        { code: 'DPA', name: 'Daños a la Propiedad Ajena', limit: '$10,000.00', prima: 0 },
        { code: 'GM', name: 'Gastos Médicos', limit: '$500.00 / $2,500.00', prima: 0 },
      ],
      endosoBenefits: [
        'Asistencia legal en accidentes de tránsito',
        'Coordinación de envío de ambulancia por accidente de tránsito',
        'Asistencia vial: cambio de llanta, envío de combustible, pase de corriente (hasta B/.150, máx. 3 eventos/año)',
        'Cerrajería vial (hasta B/.150, máx. 3 eventos/año)',
        'Grúa por accidente o avería (máximo B/.150)',
        'Transmisión de mensajes urgentes',
        'Inspección "in situ"',
        'Depósito y custodia de vehículos',
      ],
      annualPremium: 185,
      installments: {
        available: false,
        description: 'Solo al contado',
      },
    },
  },
  {
    id: 'ancon',
    name: 'ANCÓN Seguros',
    color: 'bg-purple-500',
    emoji: '🟪',
    basicPlan: {
      name: 'Plan Básico',
      coverages: {
        bodilyInjury: '$5,000 / $10,000',
        propertyDamage: '$5,000',
        medicalExpenses: '',
        accidentalDeathDriver: '$2,000',
        accidentalDeathPassengers: '',
        funeralExpenses: '',
        accidentAssistance: '',
        ambulance: '',
        roadAssistance: '',
        towing: '',
        legalAssistance: '',
      },
      coverageList: [
        { code: 'LC', name: 'Lesiones Corporales', limit: '$5,000.00 / $10,000.00', prima: 18 },
        { code: 'DPA', name: 'Daños a la Propiedad Ajena', limit: '$5,000.00', prima: 49.50 },
        { code: 'MA', name: 'Muerte Accidental', limit: '$2,000.00', prima: 0 },
      ],
      endosoBenefits: [
        'Transmisión de mensajes urgentes',
      ],
      endoso: 'Endoso Básico ANCON',
      annualPremium: 145,
      installments: {
        available: false,
        description: 'Solo al contado',
      },
    },
    premiumPlan: {
      name: 'Plan Premium',
      coverages: {
        bodilyInjury: '$5,000 / $10,000',
        propertyDamage: '$5,000',
        medicalExpenses: '$500 / $2,500',
        accidentalDeathDriver: '$2,000',
        accidentalDeathPassengers: '',
        funeralExpenses: '',
        accidentAssistance: '',
        ambulance: '',
        roadAssistance: '',
        towing: '',
        legalAssistance: '',
      },
      coverageList: [
        { code: 'LC', name: 'Lesiones Corporales', limit: '$5,000.00 / $10,000.00', prima: 40.50 },
        { code: 'DPA', name: 'Daños a la Propiedad Ajena', limit: '$5,000.00', prima: 72 },
        { code: 'AM', name: 'Asistencia Médica', limit: '$500.00 / $2,500.00', prima: 15.75 },
        { code: 'MA', name: 'Muerte Accidental', limit: '$2,000.00', prima: 0 },
        { code: 'PLUS', name: 'Reembolso Auto Sustituto ANCON Plus', limit: 'INCLUIDO', prima: 60 },
        { code: 'AVL', name: 'Asistencia Vial Limitada', limit: 'INCLUIDO', prima: 0 },
      ],
      endosoBenefits: [
        'Asistencia legal en accidentes de tránsito',
        'Reembolso para auto sustituto ANCON Plus',
        'Transmisión de mensajes urgentes',
        'Grúa por accidente o avería (máximo B/.150)',
      ],
      endoso: 'Endoso Premium ANCON Plus',
      annualPremium: 188,
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
