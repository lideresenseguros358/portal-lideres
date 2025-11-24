import { z } from 'zod';

export const UploadImportSchema = z.object({
  insurer_id: z.string().uuid('ID de aseguradora inválido'),
  total_amount: z.string(), // Comes from form as string
  fortnight_id: z.string().uuid('ID de quincena inválido'),
  invert_negatives: z.string().optional().default('false'),
  is_life_insurance: z.string().optional().default('false'),
});

export const CreateDraftSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe ser YYYY-MM-DD'),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe ser YYYY-MM-DD'),
});

export const ResolvePendingSchema = z.object({
  policy_number: z.string().min(1, 'Número de póliza requerido'),
  broker_id: z.string().uuid('ID de broker inválido'),
  item_ids: z.array(z.string().uuid()).optional(),
  skip_migration: z.boolean().optional(), // Para "Marcar Mío" sin migrar
});

export const AdvanceSchema = z.object({
  amount: z.number().positive('Monto debe ser positivo'),
  reason: z.string().max(200, 'Razón no puede exceder 200 caracteres'),
});

export const RecalculateSchema = z.object({
  fortnight_id: z.string().uuid(),
});

export const ToggleNotifySchema = z.object({
  fortnight_id: z.string().uuid(),
  notify_brokers: z.boolean(),
});

export type ParsedRow = {
  policy_number: string | null;
  client_name: string | null; // Corrected from insured_name
  commission_amount: number; // Corrected from gross_amount
  raw_row: Record<string, any>;
};
