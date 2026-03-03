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
      endoso: 'Endoso de Asistencia',
      endosoBenefits: [
        'Asistencia vial telefónica 24/7',
        'Conexión con servicio de grúa',
        'Conexión con servicio de ambulancia',
        'Orientación médica telefónica',
        'Referencia a talleres autorizados',
      ],
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
        description: 'Solo al contado',
      },
    },
    premiumPlan: {
      name: 'Plan Intermedio',
      endoso: 'Endoso de Asistencia',
      endosoBenefits: [
        'Asistencia vial 24/7 a nivel nacional',
        'Servicio de grúa por accidente o avería (hasta B/.150.00 o máximo 3 eventos por año)',
        'Servicio de ambulancia incluido',
        'Asistencia legal en caso de accidente',
        'Orientación médica telefónica',
        'Auxilio en carretera (gasolina, batería, llantas)',
        'Referencia a talleres autorizados',
        'Conductor designado (según disponibilidad)',
      ],
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
        towing: 'sí',
        legalAssistance: 'sí',
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
      endoso: 'Endoso de Asistencia',
      endosoPdf: '/API FEDPA/ENDOSO ASIST BASICO.pdf',
      endosoBenefits: [
        'Asistencia vial 24/7 a nivel nacional',
        'Servicio de grúa por accidente o avería',
        'Servicio de ambulancia incluido',
        'Asistencia legal en caso de accidente',
        'Orientación médica telefónica',
        'Auxilio en carretera (gasolina, batería, llantas)',
        'Cerrajería automotriz',
        'Referencia a talleres autorizados',
      ],
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
      endoso: 'Endoso de Asistencia',
      endosoPdf: '/API FEDPA/ENDOSO ASIST VIP.pdf',
      endosoBenefits: [
        'Asistencia vial 24/7 a nivel nacional',
        'Servicio de grúa por accidente o avería',
        'Servicio de ambulancia incluido',
        'Asistencia legal en caso de accidente',
        'Orientación médica telefónica',
        'Auxilio en carretera (gasolina, batería, llantas)',
        'Cerrajería automotriz',
        'Conductor designado (según disponibilidad)',
        'Vehículo de reemplazo (según disponibilidad)',
        'Referencia a talleres autorizados',
      ],
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
