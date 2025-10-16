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
          id: string
          is_active: boolean | null
          reason: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          broker_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          reason: string
          start_date?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          broker_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string
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
        ]
      }
      advances: {
        Row: {
          amount: number
          broker_id: string
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          status: string
        }
        Insert: {
          amount: number
          broker_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          status?: string
        }
        Update: {
          amount?: number
          broker_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
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
            foreignKeyName: "advances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      brokers: {
        Row: {
          active: boolean | null
          assa_code: string | null
          bank_account_no: string | null
          bank_id: string | null
          beneficiary_id: string | null
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
          numero_cedula: string | null
          numero_cuenta: string | null
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
          beneficiary_id?: string | null
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
          numero_cedula?: string | null
          numero_cuenta?: string | null
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
          beneficiary_id?: string | null
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
          numero_cedula?: string | null
          numero_cuenta?: string | null
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
        ]
      }
      cases: {
        Row: {
          broker_id: string | null
          canal: string
          claimed_by_broker_id: string | null
          client_id: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          ctype: Database["public"]["Enums"]["case_type_enum"]
          deleted_at: string | null
          direct_payment: boolean | null
          discount_to_broker: boolean | null
          id: string
          insurer_id: string | null
          is_deleted: boolean | null
          is_verified: boolean | null
          management_type: string | null
          message_id: string | null
          notes: string | null
          payment_method: string | null
          policy_number: string | null
          postponed_until: string | null
          premium: number | null
          section: Database["public"]["Enums"]["case_section_enum"]
          seen_by_broker: boolean
          sla_date: string | null
          sla_days: number | null
          status: Database["public"]["Enums"]["case_status_enum"]
          thread_id: string | null
          ticket_ref: string | null
          updated_at: string
        }
        Insert: {
          broker_id?: string | null
          canal?: string
          claimed_by_broker_id?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          ctype?: Database["public"]["Enums"]["case_type_enum"]
          deleted_at?: string | null
          direct_payment?: boolean | null
          discount_to_broker?: boolean | null
          id?: string
          insurer_id?: string | null
          is_deleted?: boolean | null
          is_verified?: boolean | null
          management_type?: string | null
          message_id?: string | null
          notes?: string | null
          payment_method?: string | null
          policy_number?: string | null
          postponed_until?: string | null
          premium?: number | null
          section?: Database["public"]["Enums"]["case_section_enum"]
          seen_by_broker?: boolean
          sla_date?: string | null
          sla_days?: number | null
          status?: Database["public"]["Enums"]["case_status_enum"]
          thread_id?: string | null
          ticket_ref?: string | null
          updated_at?: string
        }
        Update: {
          broker_id?: string | null
          canal?: string
          claimed_by_broker_id?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          ctype?: Database["public"]["Enums"]["case_type_enum"]
          deleted_at?: string | null
          direct_payment?: boolean | null
          discount_to_broker?: boolean | null
          id?: string
          insurer_id?: string | null
          is_deleted?: boolean | null
          is_verified?: boolean | null
          management_type?: string | null
          message_id?: string | null
          notes?: string | null
          payment_method?: string | null
          policy_number?: string | null
          postponed_until?: string | null
          premium?: number | null
          section?: Database["public"]["Enums"]["case_section_enum"]
          seen_by_broker?: boolean
          sla_date?: string | null
          sla_days?: number | null
          status?: Database["public"]["Enums"]["case_status_enum"]
          thread_id?: string | null
          ticket_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
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
        ]
      }
      clients: {
        Row: {
          active: boolean
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
        ]
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
            foreignKeyName: "fortnight_broker_totals_fortnight_id_fkey"
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
        ]
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
      user_requests: {
        Row: {
          additional_fields: Json | null
          assigned_commission_percent: number | null
          assigned_role: string | null
          cedula: string
          created_at: string
          email: string
          encrypted_password: string
          fecha_nacimiento: string
          id: string
          licencia: string | null
          nombre_completo: string
          numero_cedula_bancaria: string
          numero_cuenta: string
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
          cedula: string
          created_at?: string
          email: string
          encrypted_password: string
          fecha_nacimiento: string
          id?: string
          licencia?: string | null
          nombre_completo: string
          numero_cedula_bancaria: string
          numero_cuenta: string
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
          cedula?: string
          created_at?: string
          email?: string
          encrypted_password?: string
          fecha_nacimiento?: string
          id?: string
          licencia?: string | null
          nombre_completo?: string
          numero_cedula_bancaria?: string
          numero_cuenta?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          telefono?: string
          tipo_cuenta?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
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
        ]
      }
    }
    Functions: {
      _rnd_money: {
        Args: { hi: number; lo: number }
        Returns: number
      }
      app_broker_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
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
      assign_pending_to_office_after_3m: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      auto_trash_expired_cases: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      batch_update_clients_policies_from_commissions: {
        Args: Record<PropertyKey, never>
        Returns: {
          errors: string[]
          updated_clients: number
          updated_policies: number
        }[]
      }
      cleanup_old_notification_hashes: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_processed_temp_imports: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      commissions_monthly_summary: {
        Args: { p_broker?: string; p_year: number }
        Returns: {
          broker_id: string
          month: number
          total_amount: number
        }[]
      }
      confirm_claims_paid: {
        Args: { p_claim_ids: string[] }
        Returns: boolean
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
      current_broker_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      ensure_auth_user_from_broker: {
        Args: { p_broker_id: string }
        Returns: string
      }
      get_claims_reports_grouped: {
        Args: Record<PropertyKey, never>
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
      get_missing_fields: {
        Args: { temp_id: string }
        Returns: string[]
      }
      get_pending_items_grouped: {
        Args: Record<PropertyKey, never>
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
      get_queued_claims_for_fortnight: {
        Args: Record<PropertyKey, never>
        Returns: {
          broker_amount: number
          broker_id: string
          broker_name: string
          claim_ids: string[]
        }[]
      }
      get_sla_days_remaining: {
        Args: { p_case_id: string }
        Returns: number
      }
      is_master: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_self: {
        Args: { broker: string }
        Returns: boolean
      }
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
      profile_sync_from_auth: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      purge_deleted_cases: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      reject_claims: {
        Args: {
          p_claim_ids: string[]
          p_rejected_by: string
          p_rejection_reason: string
        }
        Returns: boolean
      }
      set_user_role: {
        Args:
          | {
              p_broker_id?: string
              p_email: string
              p_role: Database["public"]["Enums"]["role_enum"]
            }
          | { p_broker_id?: string; p_email: string; p_role: string }
        Returns: undefined
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
      case_type_enum:
        | "COTIZACION"
        | "EMISION_GENERAL"
        | "EMISION_VIDA_ASSA_WEB"
        | "EMISION_VIDA_ASSA_NO_WEB"
        | "OTRO"
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
      policy_status_enum: "ACTIVA" | "CANCELADA" | "VENCIDA"
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
      ],
      case_type_enum: [
        "COTIZACION",
        "EMISION_GENERAL",
        "EMISION_VIDA_ASSA_WEB",
        "EMISION_VIDA_ASSA_NO_WEB",
        "OTRO",
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
      ],
      policy_status_enum: ["ACTIVA", "CANCELADA", "VENCIDA"],
      porcents: ["1", "0.94", "0.82", "0.8", "0.7", "0.6", "0.5", "0"],
      role_enum: ["master", "broker"],
      role_t: ["master", "broker"],
      user_role: ["MASTER", "BROKER"],
    },
  },
} as const
