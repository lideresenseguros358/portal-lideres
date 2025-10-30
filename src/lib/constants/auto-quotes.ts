// Tarifas de Daños a Terceros - Datos fijos por aseguradora
// Actualizado: 29 de octubre de 2025

export interface AutoThirdPartyPlan {
  name: string;
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
  };
  annualPremium: number;
  installments: {
    available: boolean;
    description?: string;
    amount?: number;
    payments?: number;
  };
  notes?: string;
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
      name: 'Plan Básico',
      coverages: {
        bodilyInjury: '5,000 / 10,000',
        propertyDamage: '5,000',
        medicalExpenses: 'no',
        accidentalDeathDriver: 'no',
        accidentalDeathPassengers: 'no',
        funeralExpenses: '1,500 (para conductor)',
        accidentAssistance: 'sí',
        ambulance: 'sí',
        roadAssistance: 'no',
        towing: 'Por accidente (hasta B/.100.00, máximo 1 evento por año)',
        legalAssistance: 'sí',
      },
      annualPremium: 115.00,
      installments: {
        available: true,
        description: 'Dos pagos de B/.70.00',
        amount: 70.00,
        payments: 2,
      },
    },
    premiumPlan: {
      name: 'Plan Premium',
      coverages: {
        bodilyInjury: '5,000 / 10,000',
        propertyDamage: '10,000',
        medicalExpenses: '500 / 2,500',
        accidentalDeathDriver: '5,000',
        accidentalDeathPassengers: 'no',
        funeralExpenses: '1,500',
        accidentAssistance: 'sí',
        ambulance: 'sí',
        roadAssistance: 'sí',
        towing: 'Por accidente o avería (hasta B/.150.00 o máximo 2 eventos por año)',
        legalAssistance: 'sí',
      },
      annualPremium: 150.00,
      installments: {
        available: true,
        description: 'Dos pagos de B/.91.31',
        amount: 91.31,
        payments: 2,
      },
    },
  },
  {
    id: 'mapfre',
    name: 'MAPFRE Panamá',
    color: 'bg-red-500',
    emoji: '🟥',
    basicPlan: {
      name: 'Plan Básico',
      coverages: {
        bodilyInjury: '5,000 / 10,000',
        propertyDamage: '5,000',
        medicalExpenses: 'no',
        accidentalDeathDriver: 'no',
        accidentalDeathPassengers: 'no',
        funeralExpenses: 'no',
        accidentAssistance: 'sí',
        ambulance: 'sí',
        roadAssistance: 'no',
        towing: 'no',
        legalAssistance: 'sí',
      },
      annualPremium: 155.00,
      installments: {
        available: false,
        description: 'No aplica',
      },
    },
    premiumPlan: {
      name: 'Plan Premium',
      coverages: {
        bodilyInjury: '5,000 / 10,000',
        propertyDamage: '5,000',
        medicalExpenses: 'no',
        accidentalDeathDriver: '5,000 / 25,000',
        accidentalDeathPassengers: 'no',
        funeralExpenses: '1,500',
        accidentAssistance: 'sí',
        ambulance: 'sí',
        roadAssistance: 'sí',
        towing: 'Por accidente o avería (hasta B/.150.00 o máximo 2 eventos por año)',
        legalAssistance: 'sí',
      },
      annualPremium: 199.00,
      installments: {
        available: false,
        description: 'No aplica',
      },
    },
  },
  {
    id: 'assa',
    name: 'ASSA Seguros',
    color: 'bg-green-500',
    emoji: '🟩',
    basicPlan: {
      name: 'Plan Básico',
      coverages: {
        bodilyInjury: '5,000 / 10,000',
        propertyDamage: '5,000',
        medicalExpenses: 'no',
        accidentalDeathDriver: 'no',
        accidentalDeathPassengers: 'no',
        funeralExpenses: 'no',
        accidentAssistance: 'sí',
        ambulance: 'sí',
        roadAssistance: 'no',
        towing: 'no',
        legalAssistance: 'sí',
      },
      annualPremium: 150.00,
      installments: {
        available: false,
        description: 'No aplica',
      },
      notes: '💳 Más económico si se paga con tarjeta de crédito.',
    },
    premiumPlan: {
      name: 'Plan Premium',
      coverages: {
        bodilyInjury: '10,000 / 20,000',
        propertyDamage: '10,000',
        medicalExpenses: '2,000 / 10,000',
        accidentalDeathDriver: '10,000',
        accidentalDeathPassengers: '10,000 / 50,000',
        funeralExpenses: '1,500',
        accidentAssistance: 'sí',
        ambulance: 'sí',
        roadAssistance: 'sí',
        towing: 'Por accidente o avería (hasta B/.150.00 o máximo 3 eventos por año)',
        legalAssistance: 'sí',
      },
      annualPremium: 195.00,
      installments: {
        available: false,
        description: 'No aplica',
      },
      notes: '💳 Más económico si se paga con tarjeta de crédito.',
    },
  },
  {
    id: 'ancon',
    name: 'ANCÓN Seguros',
    color: 'bg-cyan-500',
    emoji: '🟦',
    basicPlan: {
      name: 'Plan Básico',
      coverages: {
        bodilyInjury: '5,000 / 10,000',
        propertyDamage: '10,000',
        medicalExpenses: '1,000 / 5,000',
        accidentalDeathDriver: 'no',
        accidentalDeathPassengers: 'no',
        funeralExpenses: 'no',
        accidentAssistance: 'sí',
        ambulance: 'sí',
        roadAssistance: 'no',
        towing: 'Por accidente o avería (hasta B/.150.00 por evento)',
        legalAssistance: 'sí',
      },
      annualPremium: 221.86,
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
        towing: 'Por accidente o avería (hasta B/.150.00 por evento)',
        legalAssistance: 'sí',
      },
      annualPremium: 236.33,
      installments: {
        available: false,
        description: 'No aplica',
      },
    },
  },
];

export const COVERAGE_LABELS = {
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
};

export const COMPREHENSIVE_COVERAGE_INSURERS = [
  'ASSA',
  'ANCÓN',
  'MAPFRE',
  'FEDPA',
  'INTERNACIONAL',
];
