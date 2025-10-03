"use server";

import { revalidatePath } from 'next/cache';
import { 
  createInsurer,
  updateInsurer, 
  cloneInsurer,
  toggleInsurerActive,
  upsertInsurerMapping,
  upsertMappingRule,
  deleteMappingRule,
  importAssaCodes,
  previewMapping,
  InsurerInsertSchema,
  InsurerUpdateSchema,
  InsurerMappingInsertSchema,
  MappingRuleInsertSchema,
  type PreviewMappingOptions
} from '@/lib/db/insurers';
import { listAllBrokers } from '@/lib/db/brokers';

export async function actionCreateInsurer(data: unknown) {
  try {
    const parsed = InsurerInsertSchema.parse(data);
    const insurer = await createInsurer(parsed);
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: insurer };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionUpdateInsurer(insurerId: string, data: unknown) {
  try {
    const parsed = InsurerUpdateSchema.parse(data);
    const insurer = await updateInsurer(insurerId, parsed);
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: insurer };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionCloneInsurer(insurerId: string) {
  try {
    const insurer = await cloneInsurer(insurerId);
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: insurer };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionToggleInsurerActive(insurerId: string) {
  try {
    const insurer = await toggleInsurerActive(insurerId);
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: insurer };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionUpsertInsurerMapping(data: unknown) {
  try {
    const parsed = InsurerMappingInsertSchema.parse(data);
    const mapping = await upsertInsurerMapping(parsed);
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: mapping };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionUpsertMappingRule(data: unknown) {
  try {
    const parsed = MappingRuleInsertSchema.parse(data);
    const rule = await upsertMappingRule(parsed);
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: rule };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionDeleteMappingRule(ruleId: string) {
  try {
    await deleteMappingRule(ruleId);
    revalidatePath('/(app)/insurers');
    return { ok: true as const };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionImportAssaCodes(insurerId: string, csvContent: string) {
  try {
    const result = await importAssaCodes(insurerId, csvContent);
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: result };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionPreviewMapping(options: PreviewMappingOptions) {
  try {
    const result = await previewMapping(options);
    return { ok: true as const, data: result };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionGetAllBrokers() {
  try {
    const brokers = await listAllBrokers();
    return { ok: true as const, data: brokers };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export async function actionUpdateBrokerAssaCode(brokerId: string, assaCode: string | null) {
  // Placeholder for the database function
  console.log(`Updating broker ${brokerId} with ASSA code: ${assaCode}`);
  // In a real implementation, you would call a db function like:
  // await updateBroker(brokerId, { assa_code: assaCode });
  revalidatePath('/(app)/insurers');
  return { ok: true as const };
}
