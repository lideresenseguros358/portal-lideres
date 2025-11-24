/**
 * Servicio de Sincronización con FEDPA
 * 
 * Enriquece los datos de clientes y pólizas usando la API de FEDPA
 */

import { fedpaService, type FEDPAPolicyData } from '@/lib/integrations/fedpa';
import { getSupabaseServer } from '@/lib/supabase/server';

interface SyncResult {
  success: boolean;
  stats: {
    policiesProcessed: number;
    policiesUpdated: number;
    clientsUpdated: number;
    errors: number;
  };
  details: {
    policy_number: string;
    status: 'updated' | 'not_found' | 'error';
    message?: string;
  }[];
}

export class FEDPASyncService {
  /**
   * Sincronizar todas las pólizas de la base de datos
   */
  async syncAllPolicies(): Promise<SyncResult> {
    console.log('[FEDPA Sync] Iniciando sincronización completa...');

    const supabase = await getSupabaseServer();
    const result: SyncResult = {
      success: true,
      stats: {
        policiesProcessed: 0,
        policiesUpdated: 0,
        clientsUpdated: 0,
        errors: 0,
      },
      details: [],
    };

    try {
      // 1. Obtener todas las pólizas que necesitan enriquecimiento
      const { data: policies, error } = await supabase
        .from('policies')
        .select(`
          id,
          policy_number,
          client_id,
          broker_id,
          insurer_id,
          start_date,
          renewal_date,
          ramo,
          status,
          clients!inner (
            id,
            name,
            national_id,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[FEDPA Sync] Error obteniendo pólizas:', error);
        result.success = false;
        return result;
      }

      if (!policies || policies.length === 0) {
        console.log('[FEDPA Sync] No hay pólizas para sincronizar');
        return result;
      }

      console.log(`[FEDPA Sync] ${policies.length} pólizas encontradas`);

      // 2. Filtrar pólizas que necesitan datos
      const policiesToEnrich = policies.filter((policy: any) => {
        const client = policy.clients;
        const needsClientData = !client.national_id || !client.email || !client.phone;
        const needsPolicyData = !policy.start_date || !policy.renewal_date || !policy.ramo;
        
        return needsClientData || needsPolicyData;
      });

      console.log(`[FEDPA Sync] ${policiesToEnrich.length} pólizas necesitan enriquecimiento`);

      // 3. Obtener policy_numbers únicos
      const policyNumbers = policiesToEnrich.map((p: any) => p.policy_number);

      // 4. Consultar FEDPA en lotes
      console.log('[FEDPA Sync] Consultando FEDPA...');
      const fedpaResults = await fedpaService.getPoliciesBatch(policyNumbers);

      // 5. Procesar cada póliza
      for (const policy of policiesToEnrich) {
        result.stats.policiesProcessed++;

        const fedpaData = fedpaResults.get(policy.policy_number);

        if (!fedpaData || !fedpaData.success || !fedpaData.data) {
          result.details.push({
            policy_number: policy.policy_number,
            status: 'not_found',
            message: fedpaData?.error || 'No se encontró en FEDPA',
          });
          continue;
        }

        try {
          // Actualizar cliente si tiene datos nuevos
          const clientUpdates = this.prepareClientUpdates(
            (policy as any).clients,
            fedpaData.data
          );

          if (Object.keys(clientUpdates).length > 0) {
            const { error: clientError } = await supabase
              .from('clients')
              .update(clientUpdates)
              .eq('id', policy.client_id);

            if (clientError) {
              console.error(`[FEDPA Sync] Error actualizando cliente ${policy.client_id}:`, clientError);
              result.stats.errors++;
            } else {
              result.stats.clientsUpdated++;
              console.log(`[FEDPA Sync] Cliente actualizado: ${policy.client_id}`);
            }
          }

          // Actualizar póliza si tiene datos nuevos
          const policyUpdates = this.preparePolicyUpdates(policy, fedpaData.data);

          if (Object.keys(policyUpdates).length > 0) {
            const { error: policyError } = await supabase
              .from('policies')
              .update(policyUpdates)
              .eq('id', policy.id);

            if (policyError) {
              console.error(`[FEDPA Sync] Error actualizando póliza ${policy.id}:`, policyError);
              result.stats.errors++;
            } else {
              result.stats.policiesUpdated++;
              console.log(`[FEDPA Sync] Póliza actualizada: ${policy.policy_number}`);
            }
          }

          result.details.push({
            policy_number: policy.policy_number,
            status: 'updated',
            message: 'Datos enriquecidos exitosamente',
          });
        } catch (error) {
          console.error(`[FEDPA Sync] Error procesando póliza ${policy.policy_number}:`, error);
          result.stats.errors++;
          result.details.push({
            policy_number: policy.policy_number,
            status: 'error',
            message: error instanceof Error ? error.message : 'Error desconocido',
          });
        }
      }

      console.log('[FEDPA Sync] Sincronización completada:', result.stats);
    } catch (error) {
      console.error('[FEDPA Sync] Error general:', error);
      result.success = false;
      result.stats.errors++;
    }

    return result;
  }

  /**
   * Sincronizar una póliza específica
   */
  async syncPolicy(policyId: string): Promise<{ success: boolean; message: string }> {
    console.log(`[FEDPA Sync] Sincronizando póliza: ${policyId}`);

    const supabase = await getSupabaseServer();

    try {
      // Obtener la póliza
      const { data: policy, error } = await supabase
        .from('policies')
        .select(`
          *,
          clients (*)
        `)
        .eq('id', policyId)
        .single();

      if (error || !policy) {
        return {
          success: false,
          message: 'Póliza no encontrada',
        };
      }

      // Consultar FEDPA
      const fedpaResult = await fedpaService.getPolicyByNumber(policy.policy_number);

      if (!fedpaResult.success || !fedpaResult.data) {
        return {
          success: false,
          message: fedpaResult.error || 'No se encontró en FEDPA',
        };
      }

      // Actualizar cliente
      const clientUpdates = this.prepareClientUpdates(
        (policy as any).clients,
        fedpaResult.data
      );

      if (Object.keys(clientUpdates).length > 0) {
        await supabase
          .from('clients')
          .update(clientUpdates)
          .eq('id', policy.client_id);
      }

      // Actualizar póliza
      const policyUpdates = this.preparePolicyUpdates(policy, fedpaResult.data);

      if (Object.keys(policyUpdates).length > 0) {
        await supabase
          .from('policies')
          .update(policyUpdates)
          .eq('id', policy.id);
      }

      return {
        success: true,
        message: 'Póliza sincronizada exitosamente',
      };
    } catch (error) {
      console.error('[FEDPA Sync] Error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  /**
   * Preparar actualizaciones para el cliente
   */
  private prepareClientUpdates(
    existingClient: any,
    fedpaData: FEDPAPolicyData
  ): Partial<any> {
    const updates: any = {};

    // Solo actualizar si el campo está vacío
    if (!existingClient.national_id && fedpaData.client_national_id) {
      updates.national_id = fedpaData.client_national_id;
    }

    if (!existingClient.email && fedpaData.client_email) {
      updates.email = fedpaData.client_email.toLowerCase();
    }

    if (!existingClient.phone && fedpaData.client_phone) {
      updates.phone = fedpaData.client_phone;
    }

    return updates;
  }

  /**
   * Preparar actualizaciones para la póliza
   */
  private preparePolicyUpdates(
    existingPolicy: any,
    fedpaData: FEDPAPolicyData
  ): Partial<any> {
    const updates: any = {};

    // Solo actualizar si el campo está vacío
    if (!existingPolicy.start_date && fedpaData.start_date) {
      updates.start_date = fedpaData.start_date;
    }

    if (!existingPolicy.renewal_date && fedpaData.renewal_date) {
      updates.renewal_date = fedpaData.renewal_date;
    }

    if (!existingPolicy.ramo && fedpaData.policy_type) {
      updates.ramo = fedpaData.policy_type;
    }

    // Actualizar status siempre si FEDPA lo provee
    if (fedpaData.status) {
      updates.status = fedpaData.status;
    }

    return updates;
  }
}

// Singleton
export const fedpaSyncService = new FEDPASyncService();
