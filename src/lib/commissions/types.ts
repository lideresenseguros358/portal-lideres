// src/lib/commissions/types.ts

export type BrokerData = {
  broker_id: string;
  broker_name: string;
  net_amount: number;
  gross_amount: number;
  discounts: number;
};

export type HistoricalFortnight = {
  id: string;
  label: string;
  total_imported: number;
  total_paid_gross: number;
  total_office_profit: number;
  brokers: BrokerData[];
};
