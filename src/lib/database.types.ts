export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ach_account_types: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ach_banks: {
        Row: {
          bank_name: string
          created_at: string | null
          id: string
          last_verified_at: string | null
          notes: string | null
          route_code: string
          route_code_raw: string
          source: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          bank_name: string
          created_at?: string | null
          id?: string
          last_verified_at?: string | null
          notes?: string | null
          route_code: string
          route_code_raw: string
          source?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          bank_name?: string
          created_at?: string | null
          id?: string
          last_verified_at?: string | null
          notes?: string | null
          route_code?: string
          route_code_raw?: string
          source?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      adjustment_report_items: {
        Row: {
          broker_commission: number
          commission_raw: number
          created_at: string
          id: string
          pending_item_id: string
          report_id: string
        }
        Insert: {
          broker_commission: number
          commission_raw: number
          created_at?: string
          id?: string
          pending_item_id: string
          report_id: string
        }
        Update: {
          broker_commission?: number
          commission_raw?: number
          created_at?: string
          id?: string
          pending_item_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adjustment_report_items_pending_item_id_fkey"
            columns: ["pending_item_id"]
            isOneToOne: false
            referencedRelation: "pending_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustment_report_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "adjustment_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      adjustment_reports: {
        Row: {
          admin_notes: string | null
          broker_id: string
          broker_notes: string | null
          created_at: string
          fortnight_id: string | null
          id: string
          paid_date: string | null
          payment_mode: string | null
          rejected_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          broker_id: string
          broker_notes?: string | null
          created_at?: string
          fortnight_id?: string | null
          id?: string
          paid_date?: string | null
          payment_mode?: string | null
          rejected_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          broker_id?: string
          broker_notes?: string | null
          created_at?: string
          fortnight_id?: string | null
          id?: string
          paid_date?: string | null
          payment_mode?: string | null
          rejected_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adjustment_reports_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustment_reports_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustment_reports_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustment_reports_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustment_reports_fortnight_id_fkey"
            columns: ["fortnight_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
        ]
      }
      advance_logs: {
        Row: {
          advance_id: string
          amount: number
          applied_by: string | null
          created_at: string
          fortnight_id: string | null
          id: string
          payment_type: string
        }
        Insert: {
          advance_id: string
          amount: number
          applied_by?: string | null
          created_at?: string
          fortnight_id?: string | null
          id?: string
          payment_type: string
        }
        Update: {
          advance_id?: string
          amount?: number
          applied_by?: string | null
          created_at?: string
          fortnight_id?: string | null
          id?: string
          payment_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "advance_logs_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_logs_fortnight_id_fkey"
            columns: ["fortnight_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
        ]
      }
      advance_recurrences: {
        Row: {
          amount: number
          broker_id: string
          created_at: string | null
          created_by: string | null
          end_date: string | null
          fortnight_type: string | null
          id: string
          is_active: boolean | null
          last_generated_at: string | null
          reason: string
          recurrence_count: number | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          broker_id: string
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          fortnight_type?: string | null
          id?: string
          is_active?: boolean | null
          last_generated_at?: string | null
          reason: string
          recurrence_count?: number | null
          start_date?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          broker_id?: string
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          fortnight_type?: string | null
          id?: string
          is_active?: boolean | null
          last_generated_at?: string | null
          reason?: string
          recurrence_count?: number | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advance_recurrences_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_recurrences_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_recurrences_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_recurrences_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
        ]
      }
      advances: {
        Row: {
          amount: number
          broker_id: string
          created_at: string
          created_by: string | null
          id: string
          is_recurring: boolean | null
          reason: string | null
          recurrence_id: string | null
          status: string
        }
        Insert: {
          amount: number
          broker_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_recurring?: boolean | null
          reason?: string | null
          recurrence_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          broker_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_recurring?: boolean | null
          reason?: string | null
          recurrence_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "advances_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "advance_recurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      aseguradoras_catalog: {
        Row: {
          code: string
          created_at: string | null
          display_order: number | null
          id: string
          insurer_id: string | null
          is_active: boolean | null
          name: string
          short_name: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          insurer_id?: string | null
          is_active?: boolean | null
          name: string
          short_name?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          insurer_id?: string | null
          is_active?: boolean | null
          name?: string
          short_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aseguradoras_catalog_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          entity: string | null
          entity_id: string | null
          id: string
          meta: Json | null
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json | null
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_payloads: {
        Row: {
          actor: string | null
          created_at: string
          endpoint: string
          environment: string | null
          error_message: string | null
          id: string
          policy_id: string | null
          request_json: string
          response_json: string
          status_code: number | null
          timestamp: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          endpoint: string
          environment?: string | null
          error_message?: string | null
          id?: string
          policy_id?: string | null
          request_json: string
          response_json: string
          status_code?: number | null
          timestamp?: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          endpoint?: string
          environment?: string | null
          error_message?: string | null
          id?: string
          policy_id?: string | null
          request_json?: string
          response_json?: string
          status_code?: number | null
          timestamp?: string
        }
        Relationships: []
      }
      bank_cutoffs: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_date: string
          id: string
          notes: string | null
          start_date: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_cutoffs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_group_imports: {
        Row: {
          amount_assigned: number
          created_at: string | null
          cutoff_origin_id: string | null
          fortnight_paid_id: string | null
          group_id: string
          id: string
          import_id: string
          is_temporary: boolean | null
          notes: string | null
        }
        Insert: {
          amount_assigned: number
          created_at?: string | null
          cutoff_origin_id?: string | null
          fortnight_paid_id?: string | null
          group_id: string
          id?: string
          import_id: string
          is_temporary?: boolean | null
          notes?: string | null
        }
        Update: {
          amount_assigned?: number
          created_at?: string | null
          cutoff_origin_id?: string | null
          fortnight_paid_id?: string | null
          group_id?: string
          id?: string
          import_id?: string
          is_temporary?: boolean | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_group_imports_cutoff_origin_id_fkey"
            columns: ["cutoff_origin_id"]
            isOneToOne: false
            referencedRelation: "bank_cutoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_group_imports_fortnight_paid_id_fkey"
            columns: ["fortnight_paid_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_group_imports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "bank_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_group_imports_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "comm_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_group_transfers: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          transfer_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          transfer_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_group_transfers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "bank_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_group_transfers_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: true
            referencedRelation: "bank_transfers_comm"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_groups: {
        Row: {
          created_at: string | null
          created_by: string | null
          cutoff_id: string | null
          fortnight_paid_id: string | null
          group_template: string
          id: string
          insurer_id: string | null
          is_life_insurance: boolean | null
          name: string
          paid_at: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          cutoff_id?: string | null
          fortnight_paid_id?: string | null
          group_template: string
          id?: string
          insurer_id?: string | null
          is_life_insurance?: boolean | null
          name: string
          paid_at?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          cutoff_id?: string | null
          fortnight_paid_id?: string | null
          group_template?: string
          id?: string
          insurer_id?: string | null
          is_life_insurance?: boolean | null
          name?: string
          paid_at?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_groups_cutoff_id_fkey"
            columns: ["cutoff_id"]
            isOneToOne: false
            referencedRelation: "bank_cutoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_groups_fortnight_paid_id_fkey"
            columns: ["fortnight_paid_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_groups_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transfer_imports: {
        Row: {
          amount_assigned: number
          created_at: string | null
          cutoff_origin_id: string | null
          fortnight_paid_id: string | null
          id: string
          import_id: string
          is_temporary: boolean | null
          notes: string | null
          transfer_id: string
        }
        Insert: {
          amount_assigned: number
          created_at?: string | null
          cutoff_origin_id?: string | null
          fortnight_paid_id?: string | null
          id?: string
          import_id: string
          is_temporary?: boolean | null
          notes?: string | null
          transfer_id: string
        }
        Update: {
          amount_assigned?: number
          created_at?: string | null
          cutoff_origin_id?: string | null
          fortnight_paid_id?: string | null
          id?: string
          import_id?: string
          is_temporary?: boolean | null
          notes?: string | null
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transfer_imports_cutoff_origin_id_fkey"
            columns: ["cutoff_origin_id"]
            isOneToOne: false
            referencedRelation: "bank_cutoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfer_imports_fortnight_paid_id_fkey"
            columns: ["fortnight_paid_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfer_imports_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "comm_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfer_imports_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "bank_transfers_comm"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transfers: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          description: string | null
          id: string
          imported_at: string | null
          reference_number: string
          remaining_amount: number | null
          status: string | null
          transaction_code: string | null
          used_amount: number | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          imported_at?: string | null
          reference_number: string
          remaining_amount?: number | null
          status?: string | null
          transaction_code?: string | null
          used_amount?: number | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          imported_at?: string | null
          reference_number?: string
          remaining_amount?: number | null
          status?: string | null
          transaction_code?: string | null
          used_amount?: number | null
        }
        Relationships: []
      }
      bank_transfers_comm: {
        Row: {
          amount: number
          created_at: string | null
          cutoff_id: string | null
          date: string
          description_raw: string
          id: string
          insurer_assigned_id: string | null
          notes_internal: string | null
          reference_number: string
          status: string | null
          transfer_type: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          cutoff_id?: string | null
          date: string
          description_raw: string
          id?: string
          insurer_assigned_id?: string | null
          notes_internal?: string | null
          reference_number: string
          status?: string | null
          transfer_type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          cutoff_id?: string | null
          date?: string
          description_raw?: string
          id?: string
          insurer_assigned_id?: string | null
          notes_internal?: string | null
          reference_number?: string
          status?: string | null
          transfer_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transfers_comm_cutoff_id_fkey"
            columns: ["cutoff_id"]
            isOneToOne: false
            referencedRelation: "bank_cutoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfers_comm_insurer_assigned_id_fkey"
            columns: ["insurer_assigned_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_assistants: {
        Row: {
          broker_id: string
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          broker_id: string
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          broker_id?: string
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broker_assistants_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_assistants_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_assistants_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_assistants_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
        ]
      }
      brokers: {
        Row: {
          active: boolean | null
          assa_code: string | null
          bank_account_no: string | null
          bank_id: string | null
          bank_route: string | null
          beneficiary_name: string | null
          birth_date: string | null
          broker_type: Database["public"]["Enums"]["broker_type_enum"] | null
          carnet_expiry_date: string | null
          created_at: string | null
          email: string | null
          id: string
          license_no: string | null
          meta_personal: number
          name: string | null
          national_id: string | null
          nombre_completo: string | null
          p_id: string
          percent_default: number | null
          phone: string | null
          tipo_cuenta: string | null
        }
        Insert: {
          active?: boolean | null
          assa_code?: string | null
          bank_account_no?: string | null
          bank_id?: string | null
          bank_route?: string | null
          beneficiary_name?: string | null
          birth_date?: string | null
          broker_type?: Database["public"]["Enums"]["broker_type_enum"] | null
          carnet_expiry_date?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          license_no?: string | null
          meta_personal?: number
          name?: string | null
          national_id?: string | null
          nombre_completo?: string | null
          p_id: string
          percent_default?: number | null
          phone?: string | null
          tipo_cuenta?: string | null
        }
        Update: {
          active?: boolean | null
          assa_code?: string | null
          bank_account_no?: string | null
          bank_id?: string | null
          bank_route?: string | null
          beneficiary_name?: string | null
          birth_date?: string | null
          broker_type?: Database["public"]["Enums"]["broker_type_enum"] | null
          carnet_expiry_date?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          license_no?: string | null
          meta_personal?: number
          name?: string | null
          national_id?: string | null
          nombre_completo?: string | null
          p_id?: string
          percent_default?: number | null
          phone?: string | null
          tipo_cuenta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brokers_id_fkey_profiles"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brokers_p_fk_profiles"
            columns: ["p_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brokers_p_id_fkey"
            columns: ["p_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_brokers_bank_route"
            columns: ["bank_route"]
            isOneToOne: false
            referencedRelation: "ach_banks"
            referencedColumns: ["route_code"]
          },
          {
            foreignKeyName: "fk_brokers_bank_route"
            columns: ["bank_route"]
            isOneToOne: false
            referencedRelation: "ach_banks_active"
            referencedColumns: ["route_code"]
          },
          {
            foreignKeyName: "fk_brokers_tipo_cuenta"
            columns: ["tipo_cuenta"]
            isOneToOne: false
            referencedRelation: "ach_account_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fk_brokers_tipo_cuenta"
            columns: ["tipo_cuenta"]
            isOneToOne: false
            referencedRelation: "ach_account_types_active"
            referencedColumns: ["code"]
          },
        ]
      }
      case_checklist: {
        Row: {
          case_id: string
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          label: string
          required: boolean
        }
        Insert: {
          case_id: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          label: string
          required?: boolean
        }
        Update: {
          case_id?: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          label?: string
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "case_checklist_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_checklist_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases_with_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_checklist_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_comments: {
        Row: {
          case_id: string
          channel: string
          content: string
          created_at: string
          created_by: string | null
          id: string
        }
        Insert: {
          case_id: string
          channel: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Update: {
          case_id?: string
          channel?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_comments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_comments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases_with_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      case_files: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          id: string
          mime_type: string | null
          original_name: string | null
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          mime_type?: string | null
          original_name?: string | null
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          mime_type?: string | null
          original_name?: string | null
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases_with_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_history: {
        Row: {
          action: string
          case_id: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          case_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "case_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases_with_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      case_progress: {
        Row: {
          case_id: string
          current_step_number: number
          id: string
          notes: string | null
          step_completed_at: string | null
          step_name: string
          step_started_at: string | null
          total_steps: number
          updated_at: string | null
        }
        Insert: {
          case_id: string
          current_step_number?: number
          id?: string
          notes?: string | null
          step_completed_at?: string | null
          step_name: string
          step_started_at?: string | null
          total_steps: number
          updated_at?: string | null
        }
        Update: {
          case_id?: string
          current_step_number?: number
          id?: string
          notes?: string | null
          step_completed_at?: string | null
          step_name?: string
          step_started_at?: string | null
          total_steps?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_progress_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_progress_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases_with_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      case_security_logs: {
        Row: {
          action_type: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          case_id: string
          created_at: string
          field_changed: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          case_id: string
          created_at?: string
          field_changed?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          case_id?: string
          created_at?: string
          field_changed?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_security_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_security_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_security_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases_with_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      case_ticket_history: {
        Row: {
          case_id: string
          changed_by: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          new_ticket: string
          old_ticket: string | null
          reason: string | null
        }
        Insert: {
          case_id: string
          changed_by?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_ticket: string
          old_ticket?: string | null
          reason?: string | null
        }
        Update: {
          case_id?: string
          changed_by?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_ticket?: string
          old_ticket?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_ticket_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_ticket_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases_with_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_ticket_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          adelanto_id: string | null
          admin_id: string | null
          aplazar_months: number | null
          aplazar_notify_at: string | null
          aplazar_reason: string | null
          aseguradora_code: string | null
          broker_id: string | null
          canal: string
          case_number: string | null
          claimed_by_broker_id: string | null
          classification_changed_count: number | null
          classified_at: string | null
          client_id: string | null
          client_name: string | null
          content_hash: string | null
          created_at: string
          created_by: string | null
          ctype: Database["public"]["Enums"]["case_type_enum"]
          deleted_at: string | null
          deleted_reason: string | null
          direct_payment: boolean | null
          discount_to_broker: boolean | null
          final_policy_number: string | null
          id: string
          insurer_id: string | null
          is_classified: boolean | null
          is_deleted: boolean | null
          is_verified: boolean | null
          management_type: string | null
          message_id: string | null
          notes: string | null
          payment_method: string | null
          policy_id: string | null
          policy_number: string | null
          policy_type: Database["public"]["Enums"]["policy_type_enum"] | null
          postponed_until: string | null
          premium: number | null
          ramo_code: string | null
          reopen_count: number | null
          reopened_from_ticket: string | null
          section: Database["public"]["Enums"]["case_section_enum"]
          seen_by_broker: boolean | null
          sla_accumulated_pause_days: number | null
          sla_date: string | null
          sla_days: number | null
          sla_paused: boolean | null
          sla_paused_at: string | null
          sla_paused_reason: string | null
          status: Database["public"]["Enums"]["case_status_enum"]
          status_v2:
            | Database["public"]["Enums"]["case_status_simplified"]
            | null
          thread_id: string | null
          ticket_can_regenerate: boolean | null
          ticket_generated_at: string | null
          ticket_ref: string | null
          tramite_code: string | null
          updated_at: string
          visto: boolean
          visto_at: string | null
          visto_by: string | null
        }
        Insert: {
          adelanto_id?: string | null
          admin_id?: string | null
          aplazar_months?: number | null
          aplazar_notify_at?: string | null
          aplazar_reason?: string | null
          aseguradora_code?: string | null
          broker_id?: string | null
          canal?: string
          case_number?: string | null
          claimed_by_broker_id?: string | null
          classification_changed_count?: number | null
          classified_at?: string | null
          client_id?: string | null
          client_name?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          ctype?: Database["public"]["Enums"]["case_type_enum"]
          deleted_at?: string | null
          deleted_reason?: string | null
          direct_payment?: boolean | null
          discount_to_broker?: boolean | null
          final_policy_number?: string | null
          id?: string
          insurer_id?: string | null
          is_classified?: boolean | null
          is_deleted?: boolean | null
          is_verified?: boolean | null
          management_type?: string | null
          message_id?: string | null
          notes?: string | null
          payment_method?: string | null
          policy_id?: string | null
          policy_number?: string | null
          policy_type?: Database["public"]["Enums"]["policy_type_enum"] | null
          postponed_until?: string | null
          premium?: number | null
          ramo_code?: string | null
          reopen_count?: number | null
          reopened_from_ticket?: string | null
          section?: Database["public"]["Enums"]["case_section_enum"]
          seen_by_broker?: boolean | null
          sla_accumulated_pause_days?: number | null
          sla_date?: string | null
          sla_days?: number | null
          sla_paused?: boolean | null
          sla_paused_at?: string | null
          sla_paused_reason?: string | null
          status?: Database["public"]["Enums"]["case_status_enum"]
          status_v2?:
            | Database["public"]["Enums"]["case_status_simplified"]
            | null
          thread_id?: string | null
          ticket_can_regenerate?: boolean | null
          ticket_generated_at?: string | null
          ticket_ref?: string | null
          tramite_code?: string | null
          updated_at?: string
          visto?: boolean
          visto_at?: string | null
          visto_by?: string | null
        }
        Update: {
          adelanto_id?: string | null
          admin_id?: string | null
          aplazar_months?: number | null
          aplazar_notify_at?: string | null
          aplazar_reason?: string | null
          aseguradora_code?: string | null
          broker_id?: string | null
          canal?: string
          case_number?: string | null
          claimed_by_broker_id?: string | null
          classification_changed_count?: number | null
          classified_at?: string | null
          client_id?: string | null
          client_name?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          ctype?: Database["public"]["Enums"]["case_type_enum"]
          deleted_at?: string | null
          deleted_reason?: string | null
          direct_payment?: boolean | null
          discount_to_broker?: boolean | null
          final_policy_number?: string | null
          id?: string
          insurer_id?: string | null
          is_classified?: boolean | null
          is_deleted?: boolean | null
          is_verified?: boolean | null
          management_type?: string | null
          message_id?: string | null
          notes?: string | null
          payment_method?: string | null
          policy_id?: string | null
          policy_number?: string | null
          policy_type?: Database["public"]["Enums"]["policy_type_enum"] | null
          postponed_until?: string | null
          premium?: number | null
          ramo_code?: string | null
          reopen_count?: number | null
          reopened_from_ticket?: string | null
          section?: Database["public"]["Enums"]["case_section_enum"]
          seen_by_broker?: boolean | null
          sla_accumulated_pause_days?: number | null
          sla_date?: string | null
          sla_days?: number | null
          sla_paused?: boolean | null
          sla_paused_at?: string | null
          sla_paused_reason?: string | null
          status?: Database["public"]["Enums"]["case_status_enum"]
          status_v2?:
            | Database["public"]["Enums"]["case_status_simplified"]
            | null
          thread_id?: string | null
          ticket_can_regenerate?: boolean | null
          ticket_generated_at?: string | null
          ticket_ref?: string | null
          tramite_code?: string | null
          updated_at?: string
          visto?: boolean
          visto_at?: string | null
          visto_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_claimed_by_broker_id_fkey"
            columns: ["claimed_by_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_claimed_by_broker_id_fkey"
            columns: ["claimed_by_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_claimed_by_broker_id_fkey"
            columns: ["claimed_by_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_claimed_by_broker_id_fkey"
            columns: ["claimed_by_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_visto_by_fkey"
            columns: ["visto_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean
          birth_date: string | null
          broker_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          national_id: string | null
          phone: string | null
        }
        Insert: {
          active?: boolean
          birth_date?: string | null
          broker_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          national_id?: string | null
          phone?: string | null
        }
        Update: {
          active?: boolean
          birth_date?: string | null
          broker_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          national_id?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
        ]
      }
      clients_backup_names: {
        Row: {
          backup_date: string | null
          created_at: string | null
          id: string | null
          name: string | null
        }
        Insert: {
          backup_date?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
        }
        Update: {
          backup_date?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
      comm_imports: {
        Row: {
          created_at: string
          id: string
          insurer_id: string
          is_life_insurance: boolean | null
          period_label: string
          total_amount: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          insurer_id: string
          is_life_insurance?: boolean | null
          period_label: string
          total_amount?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          insurer_id?: string
          is_life_insurance?: boolean | null
          period_label?: string
          total_amount?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comm_imports_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_imports_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_item_claims: {
        Row: {
          broker_id: string
          comm_item_id: string
          created_at: string
          fortnight_id: string | null
          id: string
          paid_date: string | null
          payment_type: string | null
          rejection_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          broker_id: string
          comm_item_id: string
          created_at?: string
          fortnight_id?: string | null
          id?: string
          paid_date?: string | null
          payment_type?: string | null
          rejection_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          broker_id?: string
          comm_item_id?: string
          created_at?: string
          fortnight_id?: string | null
          id?: string
          paid_date?: string | null
          payment_type?: string | null
          rejection_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_item_claims_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_item_claims_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_item_claims_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_item_claims_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_item_claims_comm_item_id_fkey"
            columns: ["comm_item_id"]
            isOneToOne: true
            referencedRelation: "comm_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_item_claims_fortnight_id_fkey"
            columns: ["fortnight_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_items: {
        Row: {
          broker_id: string | null
          created_at: string
          gross_amount: number
          id: string
          import_id: string
          insured_name: string | null
          insurer_id: string
          policy_number: string
          raw_row: Json | null
        }
        Insert: {
          broker_id?: string | null
          created_at?: string
          gross_amount?: number
          id?: string
          import_id: string
          insured_name?: string | null
          insurer_id: string
          policy_number: string
          raw_row?: Json | null
        }
        Update: {
          broker_id?: string | null
          created_at?: string
          gross_amount?: number
          id?: string
          import_id?: string
          insured_name?: string | null
          insurer_id?: string
          policy_number?: string
          raw_row?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "comm_items_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_items_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_items_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_items_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "comm_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_items_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_metadata: {
        Row: {
          created_at: string
          fortnight_id: string | null
          id: string
          import_id: string | null
          key: string
          value: string | null
        }
        Insert: {
          created_at?: string
          fortnight_id?: string | null
          id?: string
          import_id?: string | null
          key: string
          value?: string | null
        }
        Update: {
          created_at?: string
          fortnight_id?: string | null
          id?: string
          import_id?: string | null
          key?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comm_metadata_fortnight_id_fkey"
            columns: ["fortnight_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_metadata_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "comm_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      config_agenda: {
        Row: {
          created_at: string | null
          id: string
          lissa_meeting_code: string | null
          lissa_recurring_link: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lissa_meeting_code?: string | null
          lissa_recurring_link?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lissa_meeting_code?: string | null
          lissa_recurring_link?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      delinquency: {
        Row: {
          broker_id: string | null
          bucket_1_30: number
          bucket_31_60: number
          bucket_61_90: number
          bucket_90_plus: number
          client_name: string
          created_at: string
          current: number
          cutoff_date: string
          due_soon: number
          id: string
          insurer_id: string
          last_updated: string
          policy_number: string
          total_debt: number
        }
        Insert: {
          broker_id?: string | null
          bucket_1_30?: number
          bucket_31_60?: number
          bucket_61_90?: number
          bucket_90_plus?: number
          client_name: string
          created_at?: string
          current?: number
          cutoff_date: string
          due_soon?: number
          id?: string
          insurer_id: string
          last_updated?: string
          policy_number: string
          total_debt?: number
        }
        Update: {
          broker_id?: string | null
          bucket_1_30?: number
          bucket_31_60?: number
          bucket_61_90?: number
          bucket_90_plus?: number
          client_name?: string
          created_at?: string
          current?: number
          cutoff_date?: string
          due_soon?: number
          id?: string
          insurer_id?: string
          last_updated?: string
          policy_number?: string
          total_debt?: number
        }
        Relationships: [
          {
            foreignKeyName: "delinquency_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delinquency_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delinquency_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delinquency_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delinquency_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_tags: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      download_doc_tags: {
        Row: {
          doc_id: string
          tag_id: string
        }
        Insert: {
          doc_id: string
          tag_id: string
        }
        Update: {
          doc_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "download_doc_tags_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "download_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "download_doc_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "doc_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      download_docs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          insurer_id: string | null
          is_required: boolean
          ramo: string | null
          storage_path: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          insurer_id?: string | null
          is_required?: boolean
          ramo?: string | null
          storage_path: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          insurer_id?: string | null
          is_required?: boolean
          ramo?: string | null
          storage_path?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "download_docs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "download_docs_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      download_file_links: {
        Row: {
          created_at: string
          id: string
          linked_file_id: string
          source_file_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_file_id: string
          source_file_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_file_id?: string
          source_file_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "download_file_links_linked_file_id_fkey"
            columns: ["linked_file_id"]
            isOneToOne: false
            referencedRelation: "download_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "download_file_links_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "download_files"
            referencedColumns: ["id"]
          },
        ]
      }
      download_files: {
        Row: {
          created_at: string
          created_by: string | null
          display_order: number
          file_url: string
          id: string
          is_new: boolean | null
          marked_new_until: string | null
          name: string
          section_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          file_url: string
          id?: string
          is_new?: boolean | null
          marked_new_until?: string | null
          name: string
          section_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          file_url?: string
          id?: string
          is_new?: boolean | null
          marked_new_until?: string | null
          name?: string
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "download_files_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "download_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      download_sections: {
        Row: {
          created_at: string
          display_order: number
          id: string
          insurer_id: string | null
          name: string
          policy_type: string
          scope: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          insurer_id?: string | null
          name: string
          policy_type: string
          scope: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          insurer_id?: string | null
          name?: string
          policy_type?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "download_sections_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_unidentified_items: {
        Row: {
          commission_raw: number
          created_at: string | null
          fortnight_id: string
          id: string
          import_id: string
          insured_name: string | null
          insurer_id: string
          policy_number: string
          raw_row: string | null
          temp_assigned_at: string | null
          temp_assigned_broker_id: string | null
          updated_at: string | null
        }
        Insert: {
          commission_raw?: number
          created_at?: string | null
          fortnight_id: string
          id?: string
          import_id: string
          insured_name?: string | null
          insurer_id: string
          policy_number: string
          raw_row?: string | null
          temp_assigned_at?: string | null
          temp_assigned_broker_id?: string | null
          updated_at?: string | null
        }
        Update: {
          commission_raw?: number
          created_at?: string | null
          fortnight_id?: string
          id?: string
          import_id?: string
          insured_name?: string | null
          insurer_id?: string
          policy_number?: string
          raw_row?: string | null
          temp_assigned_at?: string | null
          temp_assigned_broker_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_unidentified_items_fortnight_id_fkey"
            columns: ["fortnight_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_unidentified_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "comm_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_unidentified_items_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_unidentified_items_temp_assigned_broker_id_fkey"
            columns: ["temp_assigned_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_unidentified_items_temp_assigned_broker_id_fkey"
            columns: ["temp_assigned_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_unidentified_items_temp_assigned_broker_id_fkey"
            columns: ["temp_assigned_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_unidentified_items_temp_assigned_broker_id_fkey"
            columns: ["temp_assigned_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          broker_id: string
          event_id: string
          id: string
          rsvp: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          broker_id: string
          event_id: string
          id?: string
          rsvp?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          broker_id?: string
          event_id?: string
          id?: string
          rsvp?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_audience: {
        Row: {
          broker_id: string
          event_id: string
        }
        Insert: {
          broker_id: string
          event_id: string
        }
        Update: {
          broker_id?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_audience_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_audience_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_audience_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_audience_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_audience_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          allow_rsvp: boolean
          audience: string
          canceled_at: string | null
          created_at: string
          created_by: string | null
          details: string | null
          end_at: string
          id: string
          is_all_day: boolean
          location: string | null
          location_name: string | null
          maps_url: string | null
          modality: string | null
          start_at: string
          title: string
          updated_at: string
          zoom_code: string | null
          zoom_url: string | null
        }
        Insert: {
          allow_rsvp?: boolean
          audience?: string
          canceled_at?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          end_at: string
          id?: string
          is_all_day?: boolean
          location?: string | null
          location_name?: string | null
          maps_url?: string | null
          modality?: string | null
          start_at: string
          title: string
          updated_at?: string
          zoom_code?: string | null
          zoom_url?: string | null
        }
        Update: {
          allow_rsvp?: boolean
          audience?: string
          canceled_at?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          end_at?: string
          id?: string
          is_all_day?: boolean
          location?: string | null
          location_name?: string | null
          maps_url?: string | null
          modality?: string | null
          start_at?: string
          title?: string
          updated_at?: string
          zoom_code?: string | null
          zoom_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expediente_documents: {
        Row: {
          client_id: string
          created_at: string | null
          document_name: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          policy_id: string | null
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          document_name?: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          policy_id?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          document_name?: string | null
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          policy_id?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expediente_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expediente_documents_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      fortnight_broker_totals: {
        Row: {
          bank_snapshot: Json | null
          broker_id: string
          created_at: string
          discounts_json: Json
          fortnight_id: string
          gross_amount: number
          id: string
          is_retained: boolean | null
          net_amount: number
        }
        Insert: {
          bank_snapshot?: Json | null
          broker_id: string
          created_at?: string
          discounts_json?: Json
          fortnight_id: string
          gross_amount?: number
          id?: string
          is_retained?: boolean | null
          net_amount?: number
        }
        Update: {
          bank_snapshot?: Json | null
          broker_id?: string
          created_at?: string
          discounts_json?: Json
          fortnight_id?: string
          gross_amount?: number
          id?: string
          is_retained?: boolean | null
          net_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "fortnight_broker_totals_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_broker_totals_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_broker_totals_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_broker_totals_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_broker_totals_fortnight_id_fkey"
            columns: ["fortnight_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
        ]
      }
      fortnight_details: {
        Row: {
          assa_code: string | null
          broker_id: string
          client_id: string | null
          client_name: string
          commission_calculated: number
          commission_raw: number
          created_at: string | null
          fortnight_id: string
          id: string
          insurer_id: string
          is_assa_code: boolean | null
          percent_applied: number
          policy_id: string | null
          policy_number: string
          ramo: string | null
          source_import_id: string | null
        }
        Insert: {
          assa_code?: string | null
          broker_id: string
          client_id?: string | null
          client_name: string
          commission_calculated: number
          commission_raw: number
          created_at?: string | null
          fortnight_id: string
          id?: string
          insurer_id: string
          is_assa_code?: boolean | null
          percent_applied: number
          policy_id?: string | null
          policy_number: string
          ramo?: string | null
          source_import_id?: string | null
        }
        Update: {
          assa_code?: string | null
          broker_id?: string
          client_id?: string | null
          client_name?: string
          commission_calculated?: number
          commission_raw?: number
          created_at?: string | null
          fortnight_id?: string
          id?: string
          insurer_id?: string
          is_assa_code?: boolean | null
          percent_applied?: number
          policy_id?: string | null
          policy_number?: string
          ramo?: string | null
          source_import_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fortnight_details_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_fortnight_id_fkey"
            columns: ["fortnight_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_source_import_id_fkey"
            columns: ["source_import_id"]
            isOneToOne: false
            referencedRelation: "comm_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      fortnight_discounts: {
        Row: {
          advance_id: string
          amount: number
          applied: boolean | null
          broker_id: string
          created_at: string | null
          fortnight_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          advance_id: string
          amount: number
          applied?: boolean | null
          broker_id: string
          created_at?: string | null
          fortnight_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          advance_id?: string
          amount?: number
          applied?: boolean | null
          broker_id?: string
          created_at?: string | null
          fortnight_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fortnight_discounts_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_discounts_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_discounts_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_discounts_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_discounts_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_discounts_fortnight_id_fkey"
            columns: ["fortnight_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
        ]
      }
      fortnights: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notify_brokers: boolean
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["fortnight_status_enum"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notify_brokers?: boolean
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["fortnight_status_enum"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notify_brokers?: boolean
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["fortnight_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "fortnights_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_file_links: {
        Row: {
          created_at: string
          id: string
          linked_file_id: string
          source_file_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_file_id: string
          source_file_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_file_id?: string
          source_file_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_file_links_linked_file_id_fkey"
            columns: ["linked_file_id"]
            isOneToOne: false
            referencedRelation: "guide_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_file_links_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "guide_files"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_files: {
        Row: {
          created_at: string
          created_by: string | null
          display_order: number
          file_url: string
          id: string
          is_new: boolean | null
          marked_new_until: string | null
          name: string
          section_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          file_url: string
          id?: string
          is_new?: boolean | null
          marked_new_until?: string | null
          name: string
          section_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          file_url?: string
          id?: string
          is_new?: boolean | null
          marked_new_until?: string | null
          name?: string
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_files_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "guide_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_sections: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      important_dates: {
        Row: {
          apadea_date1: number | null
          apadea_date2: number | null
          cierre_mes_day: number | null
          created_at: string | null
          id: string
          month: number
          news_active: boolean | null
          news_text: string | null
          updated_at: string | null
          updated_by: string | null
          via_regular_day: number | null
          vida_con_cancelacion_day: number | null
          year: number
        }
        Insert: {
          apadea_date1?: number | null
          apadea_date2?: number | null
          cierre_mes_day?: number | null
          created_at?: string | null
          id?: string
          month: number
          news_active?: boolean | null
          news_text?: string | null
          updated_at?: string | null
          updated_by?: string | null
          via_regular_day?: number | null
          vida_con_cancelacion_day?: number | null
          year: number
        }
        Update: {
          apadea_date1?: number | null
          apadea_date2?: number | null
          cierre_mes_day?: number | null
          created_at?: string | null
          id?: string
          month?: number
          news_active?: boolean | null
          news_text?: string | null
          updated_at?: string | null
          updated_by?: string | null
          via_regular_day?: number | null
          vida_con_cancelacion_day?: number | null
          year?: number
        }
        Relationships: []
      }
      insurer_assa_codes: {
        Row: {
          active: boolean
          broker_id: string | null
          code: string
          code_norm: string | null
          created_at: string | null
          id: string
          insurer_id: string
        }
        Insert: {
          active?: boolean
          broker_id?: string | null
          code: string
          code_norm?: string | null
          created_at?: string | null
          id?: string
          insurer_id: string
        }
        Update: {
          active?: boolean
          broker_id?: string | null
          code?: string
          code_norm?: string | null
          created_at?: string | null
          id?: string
          insurer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_assa_codes_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_assa_codes_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_assa_codes_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_assa_codes_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurer_assa_codes_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_contacts: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          insurer_id: string
          is_primary: boolean | null
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          insurer_id: string
          is_primary?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          insurer_id?: string
          is_primary?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurer_contacts_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_delinquency_rules: {
        Row: {
          aliases: Json | null
          created_at: string
          id: string
          insurer_id: string
          notes: string | null
          strategy: string
          target_field: string
        }
        Insert: {
          aliases?: Json | null
          created_at?: string
          id?: string
          insurer_id: string
          notes?: string | null
          strategy?: string
          target_field: string
        }
        Update: {
          aliases?: Json | null
          created_at?: string
          id?: string
          insurer_id?: string
          notes?: string | null
          strategy?: string
          target_field?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_delinquency_rules_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_mapping_rules: {
        Row: {
          aliases: Json | null
          commission_column_2_aliases: Json | null
          commission_column_3_aliases: Json | null
          created_at: string
          id: string
          insurer_id: string
          notes: string | null
          strategy: string
          target_field: string
        }
        Insert: {
          aliases?: Json | null
          commission_column_2_aliases?: Json | null
          commission_column_3_aliases?: Json | null
          created_at?: string
          id?: string
          insurer_id: string
          notes?: string | null
          strategy?: string
          target_field: string
        }
        Update: {
          aliases?: Json | null
          commission_column_2_aliases?: Json | null
          commission_column_3_aliases?: Json | null
          created_at?: string
          id?: string
          insurer_id?: string
          notes?: string | null
          strategy?: string
          target_field?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_mapping_rules_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      insurer_mappings: {
        Row: {
          active: boolean
          commission_strategy: string
          created_at: string
          insured_strategy: string
          insurer_id: string
          options: Json
          policy_strategy: string
        }
        Insert: {
          active?: boolean
          commission_strategy?: string
          created_at?: string
          insured_strategy?: string
          insurer_id: string
          options?: Json
          policy_strategy?: string
        }
        Update: {
          active?: boolean
          commission_strategy?: string
          created_at?: string
          insured_strategy?: string
          insurer_id?: string
          options?: Json
          policy_strategy?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_mappings_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: true
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      insurers: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          invert_negatives: boolean | null
          logo_url: string | null
          name: string
          use_multi_commission_columns: boolean | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          invert_negatives?: boolean | null
          logo_url?: string | null
          name: string
          use_multi_commission_columns?: boolean | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          invert_negatives?: boolean | null
          logo_url?: string | null
          name?: string
          use_multi_commission_columns?: boolean | null
        }
        Relationships: []
      }
      is_catalogs: {
        Row: {
          catalog_data: Json
          catalog_type: string
          created_at: string
          environment: string
          id: string
          updated_at: string
        }
        Insert: {
          catalog_data: Json
          catalog_type: string
          created_at?: string
          environment: string
          id?: string
          updated_at?: string
        }
        Update: {
          catalog_data?: Json
          catalog_type?: string
          created_at?: string
          environment?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      is_daily_tokens: {
        Row: {
          created_at: string
          environment: string
          expires_at: string
          id: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          environment: string
          expires_at: string
          id?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          environment?: string
          expires_at?: string
          id?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          id: string
          notification_id: string
          profile_id: string
          read_at: string
        }
        Insert: {
          id?: string
          notification_id: string
          profile_id: string
          read_at?: string
        }
        Update: {
          id?: string
          notification_id?: string
          profile_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_uniques: {
        Row: {
          created_at: string | null
          hash: string
          id: string
        }
        Insert: {
          created_at?: string | null
          hash: string
          id?: string
        }
        Update: {
          created_at?: string | null
          hash?: string
          id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          broker_id: string | null
          created_at: string
          email_sent: boolean | null
          id: string
          meta: Json | null
          notification_type:
            | Database["public"]["Enums"]["notification_type"]
            | null
          target: string
          title: string
        }
        Insert: {
          body?: string | null
          broker_id?: string | null
          created_at?: string
          email_sent?: boolean | null
          id?: string
          meta?: Json | null
          notification_type?:
            | Database["public"]["Enums"]["notification_type"]
            | null
          target: string
          title: string
        }
        Update: {
          body?: string | null
          broker_id?: string | null
          created_at?: string
          email_sent?: boolean | null
          id?: string
          meta?: Json | null
          notification_type?:
            | Database["public"]["Enums"]["notification_type"]
            | null
          target?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_details: {
        Row: {
          amount_used: number
          bank_transfer_id: string | null
          client_name: string
          id: string
          insurer_name: string | null
          paid_at: string | null
          payment_id: string | null
          policy_number: string | null
          purpose: string
        }
        Insert: {
          amount_used: number
          bank_transfer_id?: string | null
          client_name: string
          id?: string
          insurer_name?: string | null
          paid_at?: string | null
          payment_id?: string | null
          policy_number?: string | null
          purpose: string
        }
        Update: {
          amount_used?: number
          bank_transfer_id?: string | null
          client_name?: string
          id?: string
          insurer_name?: string | null
          paid_at?: string | null
          payment_id?: string | null
          policy_number?: string | null
          purpose?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_details_bank_transfer_id_fkey"
            columns: ["bank_transfer_id"]
            isOneToOne: false
            referencedRelation: "bank_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_details_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_references: {
        Row: {
          amount: number
          amount_to_use: number
          created_at: string | null
          date: string
          exists_in_bank: boolean | null
          id: string
          payment_id: string
          reference_number: string
        }
        Insert: {
          amount: number
          amount_to_use: number
          created_at?: string | null
          date: string
          exists_in_bank?: boolean | null
          id?: string
          payment_id: string
          reference_number: string
        }
        Update: {
          amount?: number
          amount_to_use?: number
          created_at?: string | null
          date?: string
          exists_in_bank?: boolean | null
          id?: string
          payment_id?: string
          reference_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_references_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_items: {
        Row: {
          action_type: string | null
          assigned_at: string | null
          assigned_broker_id: string | null
          assigned_by: string | null
          assignment_notes: string | null
          commission_raw: number
          created_at: string
          fortnight_id: string | null
          id: string
          import_id: string | null
          insured_name: string | null
          insurer_id: string | null
          policy_number: string
          status: string
          updated_at: string
        }
        Insert: {
          action_type?: string | null
          assigned_at?: string | null
          assigned_broker_id?: string | null
          assigned_by?: string | null
          assignment_notes?: string | null
          commission_raw: number
          created_at?: string
          fortnight_id?: string | null
          id?: string
          import_id?: string | null
          insured_name?: string | null
          insurer_id?: string | null
          policy_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          action_type?: string | null
          assigned_at?: string | null
          assigned_broker_id?: string | null
          assigned_by?: string | null
          assignment_notes?: string | null
          commission_raw?: number
          created_at?: string
          fortnight_id?: string | null
          id?: string
          import_id?: string | null
          insured_name?: string | null
          insurer_id?: string | null
          policy_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_items_assigned_broker_id_fkey"
            columns: ["assigned_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_items_assigned_broker_id_fkey"
            columns: ["assigned_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_items_assigned_broker_id_fkey"
            columns: ["assigned_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_items_assigned_broker_id_fkey"
            columns: ["assigned_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_items_fortnight_id_fkey"
            columns: ["fortnight_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "comm_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_items_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_payments: {
        Row: {
          amount_to_pay: number
          can_be_paid: boolean | null
          client_name: string
          created_at: string | null
          created_by: string | null
          id: string
          insurer_name: string | null
          notes: string | null
          paid_at: string | null
          policy_number: string | null
          purpose: string
          status: string | null
          total_received: number | null
        }
        Insert: {
          amount_to_pay: number
          can_be_paid?: boolean | null
          client_name: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          insurer_name?: string | null
          notes?: string | null
          paid_at?: string | null
          policy_number?: string | null
          purpose: string
          status?: string | null
          total_received?: number | null
        }
        Update: {
          amount_to_pay?: number
          can_be_paid?: boolean | null
          client_name?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          insurer_name?: string | null
          notes?: string | null
          paid_at?: string | null
          policy_number?: string | null
          purpose?: string
          status?: string | null
          total_received?: number | null
        }
        Relationships: []
      }
      pending_policy: {
        Row: {
          client_name: string | null
          created_at: string
          id: string
          pending_item_id: string
          policy_number: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          id?: string
          pending_item_id: string
          policy_number: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          id?: string
          pending_item_id?: string
          policy_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_policy_pending_item_id_fkey"
            columns: ["pending_item_id"]
            isOneToOne: false
            referencedRelation: "pending_items"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          broker_id: string
          client_id: string
          created_at: string
          id: string
          insurer_id: string
          notas: string | null
          percent_override: number | null
          policy_number: string
          ramo: string | null
          renewal_date: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["policy_status_enum"]
        }
        Insert: {
          broker_id: string
          client_id: string
          created_at?: string
          id?: string
          insurer_id: string
          notas?: string | null
          percent_override?: number | null
          policy_number: string
          ramo?: string | null
          renewal_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["policy_status_enum"]
        }
        Update: {
          broker_id?: string
          client_id?: string
          created_at?: string
          id?: string
          insurer_id?: string
          notas?: string | null
          percent_override?: number | null
          policy_number?: string
          ramo?: string | null
          renewal_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["policy_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "policies_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_requirements: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          label: string
          linked_download_file: string | null
          linked_download_section: string | null
          ramo: string
          required: boolean
          requirement_type: string
          standard_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          label: string
          linked_download_file?: string | null
          linked_download_section?: string | null
          ramo: string
          required?: boolean
          requirement_type?: string
          standard_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          label?: string
          linked_download_file?: string | null
          linked_download_section?: string | null
          ramo?: string
          required?: boolean
          requirement_type?: string
          standard_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policy_requirements_linked_download_file_fkey"
            columns: ["linked_download_file"]
            isOneToOne: false
            referencedRelation: "download_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_requirements_linked_download_section_fkey"
            columns: ["linked_download_section"]
            isOneToOne: false
            referencedRelation: "download_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      production: {
        Row: {
          broker_id: string
          bruto: number
          cancelaciones: number
          canceladas: number | null
          created_at: string
          id: string
          month: number
          num_polizas: number
          persistencia: number | null
          pma_neto: number
          updated_at: string | null
          year: number
        }
        Insert: {
          broker_id: string
          bruto?: number
          cancelaciones?: number
          canceladas?: number | null
          created_at?: string
          id?: string
          month: number
          num_polizas?: number
          persistencia?: number | null
          pma_neto?: number
          updated_at?: string | null
          year: number
        }
        Update: {
          broker_id?: string
          bruto?: number
          cancelaciones?: number
          canceladas?: number | null
          created_at?: string
          id?: string
          month?: number
          num_polizas?: number
          persistencia?: number | null
          pma_neto?: number
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          broker_id: string | null
          created_at: string
          demo_enabled: boolean
          email: string
          full_name: string | null
          id: string
          must_change_password: boolean | null
          notify_broker_renewals: boolean | null
          role: Database["public"]["Enums"]["role_enum"] | null
        }
        Insert: {
          avatar_url?: string | null
          broker_id?: string | null
          created_at?: string
          demo_enabled?: boolean
          email: string
          full_name?: string | null
          id: string
          must_change_password?: boolean | null
          notify_broker_renewals?: boolean | null
          role?: Database["public"]["Enums"]["role_enum"] | null
        }
        Update: {
          avatar_url?: string | null
          broker_id?: string | null
          created_at?: string
          demo_enabled?: boolean
          email?: string
          full_name?: string | null
          id?: string
          must_change_password?: boolean | null
          notify_broker_renewals?: boolean | null
          role?: Database["public"]["Enums"]["role_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
        ]
      }
      ramos_catalog: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          sla_days_default: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          sla_days_default?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          sla_days_default?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      retained_commissions: {
        Row: {
          applied_advance_id: string | null
          applied_fortnight_id: string | null
          broker_id: string
          created_at: string | null
          created_by: string | null
          discount_amount: number | null
          fortnight_id: string
          gross_amount: number
          id: string
          insurers_detail: Json | null
          net_amount: number
          paid_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          applied_advance_id?: string | null
          applied_fortnight_id?: string | null
          broker_id: string
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          fortnight_id: string
          gross_amount: number
          id?: string
          insurers_detail?: Json | null
          net_amount: number
          paid_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          applied_advance_id?: string | null
          applied_fortnight_id?: string | null
          broker_id?: string
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          fortnight_id?: string
          gross_amount?: number
          id?: string
          insurers_detail?: Json | null
          net_amount?: number
          paid_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retained_commissions_applied_advance_id_fkey"
            columns: ["applied_advance_id"]
            isOneToOne: false
            referencedRelation: "advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retained_commissions_applied_fortnight_id_fkey"
            columns: ["applied_fortnight_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retained_commissions_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retained_commissions_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retained_commissions_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retained_commissions_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retained_commissions_fortnight_id_fkey"
            columns: ["fortnight_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_client_import: {
        Row: {
          birth_date: string | null
          broker_id: string | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          email: string | null
          id: string
          insurer_id: string | null
          migrated: boolean | null
          migrated_at: string | null
          national_id: string | null
          notes: string | null
          phone: string | null
          policy_id: string | null
          policy_number: string | null
          ramo: string | null
          renewal_date: string | null
          source: string | null
          source_id: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          birth_date?: string | null
          broker_id?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          insurer_id?: string | null
          migrated?: boolean | null
          migrated_at?: string | null
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          policy_id?: string | null
          policy_number?: string | null
          ramo?: string | null
          renewal_date?: string | null
          source?: string | null
          source_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          birth_date?: string | null
          broker_id?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          insurer_id?: string | null
          migrated?: boolean | null
          migrated_at?: string | null
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          policy_id?: string | null
          policy_number?: string | null
          ramo?: string | null
          renewal_date?: string | null
          source?: string | null
          source_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_client_import_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_client_import_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_client_import_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_client_import_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_client_import_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_client_import_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_client_import_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_client_imports: {
        Row: {
          address: string | null
          broker_email: string
          client_name: string
          created_at: string | null
          created_by: string | null
          email: string | null
          error_message: string | null
          id: string
          import_status: string | null
          insurer_name: string
          national_id: string | null
          percent_override: number | null
          phone: string | null
          policy_number: string
          processed_at: string | null
          ramo: string | null
          renewal_date: string | null
          source: string | null
          start_date: string | null
          status: string | null
        }
        Insert: {
          address?: string | null
          broker_email: string
          client_name: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          error_message?: string | null
          id?: string
          import_status?: string | null
          insurer_name: string
          national_id?: string | null
          percent_override?: number | null
          phone?: string | null
          policy_number: string
          processed_at?: string | null
          ramo?: string | null
          renewal_date?: string | null
          source?: string | null
          start_date?: string | null
          status?: string | null
        }
        Update: {
          address?: string | null
          broker_email?: string
          client_name?: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          error_message?: string | null
          id?: string
          import_status?: string | null
          insurer_name?: string
          national_id?: string | null
          percent_override?: number | null
          phone?: string | null
          policy_number?: string
          processed_at?: string | null
          ramo?: string | null
          renewal_date?: string | null
          source?: string | null
          start_date?: string | null
          status?: string | null
        }
        Relationships: []
      }
      ticket_sequences: {
        Row: {
          aseguradora_code: string
          created_at: string | null
          id: string
          last_correlative: number | null
          ramo_code: string
          tramite_code: string
          updated_at: string | null
          year_month: string
        }
        Insert: {
          aseguradora_code: string
          created_at?: string | null
          id?: string
          last_correlative?: number | null
          ramo_code: string
          tramite_code: string
          updated_at?: string | null
          year_month: string
        }
        Update: {
          aseguradora_code?: string
          created_at?: string | null
          id?: string
          last_correlative?: number | null
          ramo_code?: string
          tramite_code?: string
          updated_at?: string | null
          year_month?: string
        }
        Relationships: []
      }
      tramites_catalog: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          requires_policy_number: boolean | null
          sla_modifier: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          requires_policy_number?: boolean | null
          sla_modifier?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          requires_policy_number?: boolean | null
          sla_modifier?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      unclassified_emails: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_to_case_id: string | null
          body_html: string | null
          body_text: string | null
          confidence_score: number | null
          created_at: string | null
          from_email: string
          from_name: string | null
          grouped_until: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          received_at: string
          status: string | null
          subject: string | null
          thread_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to_case_id?: string | null
          body_html?: string | null
          body_text?: string | null
          confidence_score?: number | null
          created_at?: string | null
          from_email: string
          from_name?: string | null
          grouped_until?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          received_at: string
          status?: string | null
          subject?: string | null
          thread_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to_case_id?: string | null
          body_html?: string | null
          body_text?: string | null
          confidence_score?: number | null
          created_at?: string | null
          from_email?: string
          from_name?: string | null
          grouped_until?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          received_at?: string
          status?: string | null
          subject?: string | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unclassified_emails_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unclassified_emails_assigned_to_case_id_fkey"
            columns: ["assigned_to_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unclassified_emails_assigned_to_case_id_fkey"
            columns: ["assigned_to_case_id"]
            isOneToOne: false
            referencedRelation: "cases_with_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_requests: {
        Row: {
          additional_fields: Json | null
          assigned_commission_percent: number | null
          assigned_role: string | null
          bank_account_no: string
          bank_route: string | null
          cedula: string
          created_at: string
          email: string
          encrypted_password: string
          fecha_nacimiento: string
          id: string
          licencia: string | null
          nombre_completo: string
          nombre_completo_titular: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          telefono: string
          tipo_cuenta: string
          updated_at: string
        }
        Insert: {
          additional_fields?: Json | null
          assigned_commission_percent?: number | null
          assigned_role?: string | null
          bank_account_no: string
          bank_route?: string | null
          cedula: string
          created_at?: string
          email: string
          encrypted_password: string
          fecha_nacimiento: string
          id?: string
          licencia?: string | null
          nombre_completo: string
          nombre_completo_titular: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          telefono: string
          tipo_cuenta?: string
          updated_at?: string
        }
        Update: {
          additional_fields?: Json | null
          assigned_commission_percent?: number | null
          assigned_role?: string | null
          bank_account_no?: string
          bank_route?: string | null
          cedula?: string
          created_at?: string
          email?: string
          encrypted_password?: string
          fecha_nacimiento?: string
          id?: string
          licencia?: string | null
          nombre_completo?: string
          nombre_completo_titular?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          telefono?: string
          tipo_cuenta?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_requests_bank_route"
            columns: ["bank_route"]
            isOneToOne: false
            referencedRelation: "ach_banks"
            referencedColumns: ["route_code"]
          },
          {
            foreignKeyName: "fk_user_requests_bank_route"
            columns: ["bank_route"]
            isOneToOne: false
            referencedRelation: "ach_banks_active"
            referencedColumns: ["route_code"]
          },
          {
            foreignKeyName: "user_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_config: {
        Row: {
          auto_reassign: boolean | null
          backup_email: string | null
          created_at: string | null
          id: string
          is_on_vacation: boolean | null
          master_email: string
          master_name: string
          updated_at: string | null
          vacation_end: string | null
          vacation_start: string | null
        }
        Insert: {
          auto_reassign?: boolean | null
          backup_email?: string | null
          created_at?: string | null
          id?: string
          is_on_vacation?: boolean | null
          master_email: string
          master_name: string
          updated_at?: string | null
          vacation_end?: string | null
          vacation_start?: string | null
        }
        Update: {
          auto_reassign?: boolean | null
          backup_email?: string | null
          created_at?: string | null
          id?: string
          is_on_vacation?: boolean | null
          master_email?: string
          master_name?: string
          updated_at?: string | null
          vacation_end?: string | null
          vacation_start?: string | null
        }
        Relationships: []
      }
      workflow_steps: {
        Row: {
          created_at: string | null
          display_order: number
          estimated_days: number | null
          id: string
          management_type: string
          ramo: string
          step_description: string | null
          step_name: string
          step_number: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          estimated_days?: number | null
          id?: string
          management_type: string
          ramo: string
          step_description?: string | null
          step_name: string
          step_number: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          estimated_days?: number | null
          id?: string
          management_type?: string
          ramo?: string
          step_description?: string | null
          step_name?: string
          step_number?: number
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      ach_account_types_active: {
        Row: {
          code: string | null
          id: string | null
          name: string | null
        }
        Insert: {
          code?: string | null
          id?: string | null
          name?: string | null
        }
        Update: {
          code?: string | null
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
      ach_banks_active: {
        Row: {
          bank_name: string | null
          id: string | null
          route_code: string | null
          route_code_raw: string | null
        }
        Insert: {
          bank_name?: string | null
          id?: string | null
          route_code?: string | null
          route_code_raw?: string | null
        }
        Update: {
          bank_name?: string | null
          id?: string | null
          route_code?: string | null
          route_code_raw?: string | null
        }
        Relationships: []
      }
      brokers_ach_validation: {
        Row: {
          active: boolean | null
          bank_account_no: string | null
          bank_route: string | null
          id: string | null
          is_ach_ready: boolean | null
          name: string | null
          national_id: string | null
          nombre_completo: string | null
          tipo_cuenta: string | null
          validation_status: string | null
        }
        Insert: {
          active?: boolean | null
          bank_account_no?: string | null
          bank_route?: string | null
          id?: string | null
          is_ach_ready?: never
          name?: string | null
          national_id?: string | null
          nombre_completo?: string | null
          tipo_cuenta?: string | null
          validation_status?: never
        }
        Update: {
          active?: boolean | null
          bank_account_no?: string | null
          bank_route?: string | null
          id?: string | null
          is_ach_ready?: never
          name?: string | null
          national_id?: string | null
          nombre_completo?: string | null
          tipo_cuenta?: string | null
          validation_status?: never
        }
        Relationships: [
          {
            foreignKeyName: "brokers_id_fkey_profiles"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_brokers_bank_route"
            columns: ["bank_route"]
            isOneToOne: false
            referencedRelation: "ach_banks"
            referencedColumns: ["route_code"]
          },
          {
            foreignKeyName: "fk_brokers_bank_route"
            columns: ["bank_route"]
            isOneToOne: false
            referencedRelation: "ach_banks_active"
            referencedColumns: ["route_code"]
          },
          {
            foreignKeyName: "fk_brokers_tipo_cuenta"
            columns: ["tipo_cuenta"]
            isOneToOne: false
            referencedRelation: "ach_account_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fk_brokers_tipo_cuenta"
            columns: ["tipo_cuenta"]
            isOneToOne: false
            referencedRelation: "ach_account_types_active"
            referencedColumns: ["code"]
          },
        ]
      }
      brokers_with_ach_info: {
        Row: {
          account_type_code: string | null
          account_type_is_active: boolean | null
          account_type_name: string | null
          active: boolean | null
          bank_account_no: string | null
          bank_is_active: boolean | null
          bank_name: string | null
          bank_route: string | null
          bank_route_full: string | null
          broker_type: Database["public"]["Enums"]["broker_type_enum"] | null
          email: string | null
          id: string | null
          is_ach_ready: boolean | null
          name: string | null
          national_id: string | null
          nombre_completo: string | null
          percent_default: number | null
          phone: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brokers_id_fkey_profiles"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_brokers_bank_route"
            columns: ["bank_route"]
            isOneToOne: false
            referencedRelation: "ach_banks"
            referencedColumns: ["route_code"]
          },
          {
            foreignKeyName: "fk_brokers_bank_route"
            columns: ["bank_route"]
            isOneToOne: false
            referencedRelation: "ach_banks_active"
            referencedColumns: ["route_code"]
          },
          {
            foreignKeyName: "fk_brokers_tipo_cuenta"
            columns: ["account_type_code"]
            isOneToOne: false
            referencedRelation: "ach_account_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fk_brokers_tipo_cuenta"
            columns: ["account_type_code"]
            isOneToOne: false
            referencedRelation: "ach_account_types_active"
            referencedColumns: ["code"]
          },
        ]
      }
      brokers_with_bank_info: {
        Row: {
          active: boolean | null
          bank_account_no: string | null
          bank_is_active: boolean | null
          bank_name: string | null
          bank_route: string | null
          bank_route_full: string | null
          broker_type: Database["public"]["Enums"]["broker_type_enum"] | null
          email: string | null
          id: string | null
          is_ach_ready: boolean | null
          name: string | null
          national_id: string | null
          nombre_completo: string | null
          percent_default: number | null
          phone: string | null
          tipo_cuenta: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brokers_id_fkey_profiles"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_brokers_bank_route"
            columns: ["bank_route"]
            isOneToOne: false
            referencedRelation: "ach_banks"
            referencedColumns: ["route_code"]
          },
          {
            foreignKeyName: "fk_brokers_bank_route"
            columns: ["bank_route"]
            isOneToOne: false
            referencedRelation: "ach_banks_active"
            referencedColumns: ["route_code"]
          },
          {
            foreignKeyName: "fk_brokers_tipo_cuenta"
            columns: ["tipo_cuenta"]
            isOneToOne: false
            referencedRelation: "ach_account_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fk_brokers_tipo_cuenta"
            columns: ["tipo_cuenta"]
            isOneToOne: false
            referencedRelation: "ach_account_types_active"
            referencedColumns: ["code"]
          },
        ]
      }
      cases_with_catalogs: {
        Row: {
          adelanto_id: string | null
          admin_email: string | null
          admin_id: string | null
          admin_name: string | null
          aplazar_reason: string | null
          aseguradora_code: string | null
          aseguradora_name: string | null
          broker_email: string | null
          broker_id: string | null
          broker_name: string | null
          canal: string | null
          case_number: string | null
          claimed_by_broker_id: string | null
          client_id: string | null
          client_name: string | null
          content_hash: string | null
          created_at: string | null
          created_by: string | null
          ctype: Database["public"]["Enums"]["case_type_enum"] | null
          deleted_at: string | null
          deleted_reason: string | null
          direct_payment: boolean | null
          discount_to_broker: boolean | null
          id: string | null
          insurer_id: string | null
          is_deleted: boolean | null
          is_verified: boolean | null
          management_type: string | null
          message_id: string | null
          notes: string | null
          payment_method: string | null
          policy_id: string | null
          policy_number: string | null
          policy_type: Database["public"]["Enums"]["policy_type_enum"] | null
          postponed_until: string | null
          premium: number | null
          ramo_code: string | null
          ramo_name: string | null
          section: Database["public"]["Enums"]["case_section_enum"] | null
          seen_by_broker: boolean | null
          sla_date: string | null
          sla_days: number | null
          status: Database["public"]["Enums"]["case_status_enum"] | null
          thread_id: string | null
          ticket_ref: string | null
          tramite_code: string | null
          tramite_name: string | null
          updated_at: string | null
          visto: boolean | null
          visto_at: string | null
          visto_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_claimed_by_broker_id_fkey"
            columns: ["claimed_by_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_claimed_by_broker_id_fkey"
            columns: ["claimed_by_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_claimed_by_broker_id_fkey"
            columns: ["claimed_by_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_claimed_by_broker_id_fkey"
            columns: ["claimed_by_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_visto_by_fkey"
            columns: ["visto_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fortnight_details_full: {
        Row: {
          assa_code: string | null
          broker_email: string | null
          broker_id: string | null
          broker_name: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_national_id: string | null
          commission_calculated: number | null
          commission_raw: number | null
          created_at: string | null
          fortnight_id: string | null
          fortnight_status:
            | Database["public"]["Enums"]["fortnight_status_enum"]
            | null
          id: string | null
          import_period_label: string | null
          import_total_amount: number | null
          insurer_id: string | null
          insurer_name: string | null
          is_assa_code: boolean | null
          percent_applied: number | null
          period_end: string | null
          period_start: string | null
          policy_id: string | null
          policy_number: string | null
          ramo: string | null
          source_import_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fortnight_details_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_fortnight_id_fkey"
            columns: ["fortnight_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fortnight_details_source_import_id_fkey"
            columns: ["source_import_id"]
            isOneToOne: false
            referencedRelation: "comm_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      v_claims_full: {
        Row: {
          account_type: string | null
          bank_account_no: string | null
          broker_amount: number | null
          broker_email: string | null
          broker_full_name: string | null
          broker_id: string | null
          broker_name: string | null
          broker_percent: number | null
          comm_item_id: string | null
          created_at: string | null
          fortnight_id: string | null
          fortnight_label: string | null
          id: string | null
          import_id: string | null
          insured_name: string | null
          insurer_id: string | null
          insurer_name: string | null
          national_id: string | null
          nombre_completo: string | null
          paid_date: string | null
          payment_type: string | null
          policy_number: string | null
          raw_amount: number | null
          rejection_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comm_item_claims_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_item_claims_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_ach_validation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_item_claims_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_ach_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_item_claims_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_with_bank_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_item_claims_comm_item_id_fkey"
            columns: ["comm_item_id"]
            isOneToOne: true
            referencedRelation: "comm_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_item_claims_fortnight_id_fkey"
            columns: ["fortnight_id"]
            isOneToOne: false
            referencedRelation: "fortnights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "comm_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_items_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_brokers_tipo_cuenta"
            columns: ["account_type"]
            isOneToOne: false
            referencedRelation: "ach_account_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fk_brokers_tipo_cuenta"
            columns: ["account_type"]
            isOneToOne: false
            referencedRelation: "ach_account_types_active"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Functions: {
      _rnd_money: { Args: { hi: number; lo: number }; Returns: number }
      app_broker_id: { Args: never; Returns: string }
      approve_claims_and_create_preliminary: {
        Args: {
          p_approved_by: string
          p_claim_ids: string[]
          p_payment_type: string
        }
        Returns: {
          message: string
          preliminary_count: number
          success: boolean
        }[]
      }
      assign_pending_to_office_after_3m: { Args: never; Returns: number }
      auto_trash_expired_cases: { Args: never; Returns: number }
      bulk_import_clients_policies: {
        Args: { import_data: Json }
        Returns: {
          client_id: string
          client_name: string
          message: string
          policy_id: string
          policy_number: string
          row_number: number
          success: boolean
        }[]
      }
      calculate_bank_group_total: {
        Args: { p_group_id: string }
        Returns: number
      }
      calculate_effective_sla_date: {
        Args: { p_case_id: string }
        Returns: string
      }
      clean_expired_is_tokens: { Args: never; Returns: undefined }
      cleanup_old_notification_hashes: { Args: never; Returns: undefined }
      cleanup_processed_temp_imports: { Args: never; Returns: number }
      commissions_monthly_summary: {
        Args: { p_broker?: string; p_year: number }
        Returns: {
          broker_id: string
          month: number
          total_amount: number
        }[]
      }
      confirm_claims_paid: { Args: { p_claim_ids: string[] }; Returns: boolean }
      count_draft_unidentified: {
        Args: { p_fortnight_id: string }
        Returns: {
          identified_count: number
          total_count: number
          unidentified_count: number
        }[]
      }
      create_temp_client_from_pending: {
        Args: {
          p_broker_id: string
          p_client_name: string
          p_insurer_id: string
          p_national_id?: string
          p_policy_number: string
          p_ramo?: string
          p_source_id?: string
        }
        Returns: string
      }
      current_broker_id: { Args: never; Returns: string }
      ensure_auth_user_from_broker: {
        Args: { p_broker_id: string }
        Returns: string
      }
      fix_text_encoding: { Args: { input_text: string }; Returns: string }
      generate_ticket_number: {
        Args: {
          p_aseguradora_code: string
          p_ramo_code: string
          p_tramite_code: string
        }
        Returns: string
      }
      get_brokers_for_import: {
        Args: never
        Returns: {
          active: boolean
          broker_email: string
          broker_id: string
          broker_name: string
        }[]
      }
      get_claims_reports_grouped: {
        Args: never
        Returns: {
          broker_email: string
          broker_id: string
          broker_name: string
          claims: Json
          item_count: number
          status: string
          total_broker_amount: number
          total_raw_amount: number
        }[]
      }
      get_fortnight_summary: {
        Args: { p_fortnight_id: string }
        Returns: {
          total_assa_codes: number
          total_brokers: number
          total_by_insurer: Json
          total_commission_calculated: number
          total_commission_raw: number
          total_policies: number
        }[]
      }
      get_insurers_for_import: {
        Args: never
        Returns: {
          active: boolean
          insurer_id: string
          insurer_name: string
        }[]
      }
      get_missing_fields: { Args: { temp_id: string }; Returns: string[] }
      get_next_ticket_correlative: {
        Args: {
          p_aseguradora_code: string
          p_ramo_code: string
          p_tramite_code: string
          p_year_month: string
        }
        Returns: number
      }
      get_pending_groups: {
        Args: never
        Returns: {
          created_at: string
          group_id: string
          group_name: string
          status: string
          total_amount: number
        }[]
      }
      get_pending_items_grouped: {
        Args: never
        Returns: {
          client_name: string
          items: Json
          oldest_date: string
          policy_number: string
          status: string
          total_commission: number
          total_items: number
        }[]
      }
      get_pending_transfers: {
        Args: never
        Returns: {
          amount: number
          cutoff_id: string
          cutoff_name: string
          date: string
          description: string
          reference_number: string
          transfer_id: string
        }[]
      }
      get_queued_claims_for_fortnight: {
        Args: never
        Returns: {
          broker_amount: number
          broker_id: string
          broker_name: string
          claim_ids: string[]
        }[]
      }
      get_sla_days_remaining: { Args: { p_case_id: string }; Returns: number }
      get_transfer_total_used: {
        Args: { p_transfer_id: string }
        Returns: number
      }
      get_valid_is_token: { Args: { env: string }; Returns: string }
      is_master: { Args: never; Returns: boolean }
      is_self: { Args: { broker: string }; Returns: boolean }
      metrics_broker: {
        Args: { p_broker: string; p_fortnight: string }
        Returns: {
          collected_amount: number
          morosity_over_60: number
          pending_identify: number
        }[]
      }
      migrate_temp_client_to_production: {
        Args: { temp_id: string }
        Returns: undefined
      }
      normalize_name: { Args: { text_input: string }; Returns: string }
      profile_sync_from_auth: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      purge_deleted_cases: { Args: never; Returns: number }
      reject_claims: {
        Args: {
          p_claim_ids: string[]
          p_rejected_by: string
          p_rejection_reason: string
        }
        Returns: boolean
      }
      reopen_aplazado_case: {
        Args: { p_case_id: string; p_create_new_ticket?: boolean }
        Returns: string
      }
      set_user_role:
        | {
            Args: {
              p_broker_id?: string
              p_email: string
              p_role: Database["public"]["Enums"]["role_enum"]
            }
            Returns: undefined
          }
        | {
            Args: { p_broker_id?: string; p_email: string; p_role: string }
            Returns: undefined
          }
      toggle_case_sla_pause: {
        Args: { p_case_id: string; p_pause: boolean; p_reason?: string }
        Returns: undefined
      }
      validate_broker_for_ach: {
        Args: { broker_id: string }
        Returns: {
          account_number: string
          account_type_name: string
          bank_name: string
          beneficiary_name: string
          error_message: string
          is_valid: boolean
        }[]
      }
    }
    Enums: {
      broker_type_enum: "corredor" | "agente"
      case_section:
        | "SIN_CLASIFICAR"
        | "RAMOS_GENERALES"
        | "VIDA_ASSA"
        | "OTROS_PERSONAS"
      case_section_enum:
        | "SIN_CLASIFICAR"
        | "RAMOS_GENERALES"
        | "VIDA_ASSA"
        | "OTROS_PERSONAS"
        | "NO_IDENTIFICADOS"
      case_status:
        | "PENDIENTE_REVISION"
        | "EN_PROCESO"
        | "RESUELTO"
        | "DESCARTADO"
      case_status_enum:
        | "PENDIENTE_REVISION"
        | "EN_PROCESO"
        | "FALTA_DOC"
        | "APLAZADO"
        | "RECHAZADO"
        | "APROBADO_PEND_PAGO"
        | "EMITIDO"
        | "CERRADO"
        | "PENDIENTE_DOCUMENTACION"
        | "COTIZANDO"
        | "REVISAR_ORIGEN"
      case_status_simplified:
        | "NUEVO"
        | "EN_PROCESO"
        | "PENDIENTE_CLIENTE"
        | "PENDIENTE_BROKER"
        | "ENVIADO"
        | "APLAZADO"
        | "CERRADO_APROBADO"
        | "CERRADO_RECHAZADO"
      case_type_enum:
        | "COTIZACION"
        | "EMISION_GENERAL"
        | "EMISION_VIDA_ASSA_WEB"
        | "EMISION_VIDA_ASSA_NO_WEB"
        | "OTRO"
        | "REHABILITACION"
        | "MODIFICACION"
        | "CANCELACION"
        | "CAMBIO_CORREDOR"
        | "RECLAMO"
        | "EMISION_EXPRESS"
      fortnight_status_enum: "DRAFT" | "READY" | "PAID"
      map_kind: "COMMISSIONS" | "DELINQUENCY"
      notification_type:
        | "renewal"
        | "case_digest"
        | "commission"
        | "delinquency"
        | "download"
        | "guide"
        | "other"
        | "carnet_renewal"
        | "agenda_event"
      policy_status_enum: "ACTIVA" | "CANCELADA" | "VENCIDA"
      policy_type_enum:
        | "AUTO"
        | "VIDA"
        | "SALUD"
        | "INCENDIO"
        | "TODO_RIESGO"
        | "RESPONSABILIDAD_CIVIL"
        | "ACCIDENTES_PERSONALES"
        | "OTROS"
      porcents: "1" | "0.94" | "0.82" | "0.8" | "0.7" | "0.6" | "0.5" | "0"
      role_enum: "master" | "broker"
      role_t: "master" | "broker"
      user_role: "MASTER" | "BROKER"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      broker_type_enum: ["corredor", "agente"],
      case_section: [
        "SIN_CLASIFICAR",
        "RAMOS_GENERALES",
        "VIDA_ASSA",
        "OTROS_PERSONAS",
      ],
      case_section_enum: [
        "SIN_CLASIFICAR",
        "RAMOS_GENERALES",
        "VIDA_ASSA",
        "OTROS_PERSONAS",
        "NO_IDENTIFICADOS",
      ],
      case_status: [
        "PENDIENTE_REVISION",
        "EN_PROCESO",
        "RESUELTO",
        "DESCARTADO",
      ],
      case_status_enum: [
        "PENDIENTE_REVISION",
        "EN_PROCESO",
        "FALTA_DOC",
        "APLAZADO",
        "RECHAZADO",
        "APROBADO_PEND_PAGO",
        "EMITIDO",
        "CERRADO",
        "PENDIENTE_DOCUMENTACION",
        "COTIZANDO",
        "REVISAR_ORIGEN",
      ],
      case_status_simplified: [
        "NUEVO",
        "EN_PROCESO",
        "PENDIENTE_CLIENTE",
        "PENDIENTE_BROKER",
        "ENVIADO",
        "APLAZADO",
        "CERRADO_APROBADO",
        "CERRADO_RECHAZADO",
      ],
      case_type_enum: [
        "COTIZACION",
        "EMISION_GENERAL",
        "EMISION_VIDA_ASSA_WEB",
        "EMISION_VIDA_ASSA_NO_WEB",
        "OTRO",
        "REHABILITACION",
        "MODIFICACION",
        "CANCELACION",
        "CAMBIO_CORREDOR",
        "RECLAMO",
        "EMISION_EXPRESS",
      ],
      fortnight_status_enum: ["DRAFT", "READY", "PAID"],
      map_kind: ["COMMISSIONS", "DELINQUENCY"],
      notification_type: [
        "renewal",
        "case_digest",
        "commission",
        "delinquency",
        "download",
        "guide",
        "other",
        "carnet_renewal",
        "agenda_event",
      ],
      policy_status_enum: ["ACTIVA", "CANCELADA", "VENCIDA"],
      policy_type_enum: [
        "AUTO",
        "VIDA",
        "SALUD",
        "INCENDIO",
        "TODO_RIESGO",
        "RESPONSABILIDAD_CIVIL",
        "ACCIDENTES_PERSONALES",
        "OTROS",
      ],
      porcents: ["1", "0.94", "0.82", "0.8", "0.7", "0.6", "0.5", "0"],
      role_enum: ["master", "broker"],
      role_t: ["master", "broker"],
      user_role: ["MASTER", "BROKER"],
    },
  },
} as const
