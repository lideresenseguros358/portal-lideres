# Nuevas Tablas para Agregar a database.types.ts

## Ubicación
Agregar después de la tabla `temp_client_import` (línea ~4525) y antes de `temp_client_imports`

## Tablas a Agregar

```typescript
// === SISTEMA IMAP + VERTEX AI + PENDIENTES ===

inbound_emails: {
  Row: {
    id: string
    message_id: string
    from_email: string | null
    from_name: string | null
    to_emails: Json
    cc_emails: Json
    subject: string | null
    subject_normalized: string | null
    date_sent: string
    in_reply_to: string | null
    thread_references: string | null
    body_text: string | null
    body_html: string | null
    body_text_normalized: string | null
    attachments_count: number
    attachments_total_bytes: number
    imap_uid: string | null
    folder: string | null
    processed_status: string
    processed_at: string | null
    error_code: string | null
    error_detail: string | null
    created_at: string
  }
  Insert: {
    id?: string
    message_id: string
    from_email?: string | null
    from_name?: string | null
    to_emails?: Json
    cc_emails?: Json
    subject?: string | null
    subject_normalized?: string | null
    date_sent: string
    in_reply_to?: string | null
    thread_references?: string | null
    body_text?: string | null
    body_html?: string | null
    body_text_normalized?: string | null
    attachments_count?: number
    attachments_total_bytes?: number
    imap_uid?: string | null
    folder?: string | null
    processed_status?: string
    processed_at?: string | null
    error_code?: string | null
    error_detail?: string | null
    created_at?: string
  }
  Update: {
    id?: string
    message_id?: string
    from_email?: string | null
    from_name?: string | null
    to_emails?: Json
    cc_emails?: Json
    subject?: string | null
    subject_normalized?: string | null
    date_sent?: string
    in_reply_to?: string | null
    thread_references?: string | null
    body_text?: string | null
    body_html?: string | null
    body_text_normalized?: string | null
    attachments_count?: number
    attachments_total_bytes?: number
    imap_uid?: string | null
    folder?: string | null
    processed_status?: string
    processed_at?: string | null
    error_code?: string | null
    error_detail?: string | null
    created_at?: string
  }
  Relationships: []
}
inbound_email_attachments: {
  Row: {
    id: string
    inbound_email_id: string
    filename: string
    content_type: string | null
    size_bytes: number | null
    storage_path: string | null
    inline: boolean
    content_id: string | null
    created_at: string
  }
  Insert: {
    id?: string
    inbound_email_id: string
    filename: string
    content_type?: string | null
    size_bytes?: number | null
    storage_path?: string | null
    inline?: boolean
    content_id?: string | null
    created_at?: string
  }
  Update: {
    id?: string
    inbound_email_id?: string
    filename?: string
    content_type?: string | null
    size_bytes?: number | null
    storage_path?: string | null
    inline?: boolean
    content_id?: string | null
    created_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "inbound_email_attachments_inbound_email_id_fkey"
      columns: ["inbound_email_id"]
      isOneToOne: false
      referencedRelation: "inbound_emails"
      referencedColumns: ["id"]
    }
  ]
}
case_emails: {
  Row: {
    id: string
    case_id: string
    inbound_email_id: string
    linked_at: string
    linked_by: string
    visible_to_broker: boolean
  }
  Insert: {
    id?: string
    case_id: string
    inbound_email_id: string
    linked_at?: string
    linked_by?: string
    visible_to_broker?: boolean
  }
  Update: {
    id?: string
    case_id?: string
    inbound_email_id?: string
    linked_at?: string
    linked_by?: string
    visible_to_broker?: boolean
  }
  Relationships: [
    {
      foreignKeyName: "case_emails_case_id_fkey"
      columns: ["case_id"]
      isOneToOne: false
      referencedRelation: "cases"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "case_emails_inbound_email_id_fkey"
      columns: ["inbound_email_id"]
      isOneToOne: false
      referencedRelation: "inbound_emails"
      referencedColumns: ["id"]
    }
  ]
}
case_history_events: {
  Row: {
    id: string
    case_id: string
    event_type: string
    payload: Json | null
    created_by_user_id: string | null
    created_by_role: string
    visible_to_broker: boolean
    created_at: string
  }
  Insert: {
    id?: string
    case_id: string
    event_type: string
    payload?: Json | null
    created_by_user_id?: string | null
    created_by_role?: string
    visible_to_broker?: boolean
    created_at?: string
  }
  Update: {
    id?: string
    case_id?: string
    event_type?: string
    payload?: Json | null
    created_by_user_id?: string | null
    created_by_role?: string
    visible_to_broker?: boolean
    created_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "case_history_events_case_id_fkey"
      columns: ["case_id"]
      isOneToOne: false
      referencedRelation: "cases"
      referencedColumns: ["id"]
    }
  ]
}
security_audit_logs: {
  Row: {
    id: string
    actor_user_id: string | null
    actor_type: string
    action: string
    entity_type: string
    entity_id: string | null
    before: Json | null
    after: Json | null
    created_at: string
  }
  Insert: {
    id?: string
    actor_user_id?: string | null
    actor_type?: string
    action: string
    entity_type: string
    entity_id?: string | null
    before?: Json | null
    after?: Json | null
    created_at?: string
  }
  Update: {
    id?: string
    actor_user_id?: string | null
    actor_type?: string
    action?: string
    entity_type?: string
    entity_id?: string | null
    before?: Json | null
    after?: Json | null
    created_at?: string
  }
  Relationships: []
}
ticket_counters: {
  Row: {
    id: string
    aamm: string
    ramo_code: string
    aseg_code: string
    tramite_code: string
    counter: number
    updated_at: string
  }
  Insert: {
    id?: string
    aamm: string
    ramo_code: string
    aseg_code: string
    tramite_code: string
    counter?: number
    updated_at?: string
  }
  Update: {
    id?: string
    aamm?: string
    ramo_code?: string
    aseg_code?: string
    tramite_code?: string
    counter?: number
    updated_at?: string
  }
  Relationships: []
}
master_routing_config: {
  Row: {
    id: string
    bucket: string
    primary_master_user_id: string | null
    backup_master_user_id: string | null
    primary_on_vacation: boolean
    effective_master_user_id: string | null
    updated_at: string
  }
  Insert: {
    id?: string
    bucket: string
    primary_master_user_id?: string | null
    backup_master_user_id?: string | null
    primary_on_vacation?: boolean
    effective_master_user_id?: string | null
    updated_at?: string
  }
  Update: {
    id?: string
    bucket?: string
    primary_master_user_id?: string | null
    backup_master_user_id?: string | null
    primary_on_vacation?: boolean
    effective_master_user_id?: string | null
    updated_at?: string
  }
  Relationships: []
}
cron_runs: {
  Row: {
    id: string
    job_name: string
    started_at: string
    finished_at: string | null
    status: string
    processed_count: number
    error_message: string | null
    error_stack: string | null
    metadata: Json | null
    created_at: string
  }
  Insert: {
    id?: string
    job_name: string
    started_at?: string
    finished_at?: string | null
    status?: string
    processed_count?: number
    error_message?: string | null
    error_stack?: string | null
    metadata?: Json | null
    created_at?: string
  }
  Update: {
    id?: string
    job_name?: string
    started_at?: string
    finished_at?: string | null
    status?: string
    processed_count?: number
    error_message?: string | null
    error_stack?: string | null
    metadata?: Json | null
    created_at?: string
  }
  Relationships: []
}
```

## Actualizar tabla cases

Agregar estos campos a la definición existente de `cases`:

```typescript
cases: {
  Row: {
    // ... campos existentes ...
    
    // NUEVOS CAMPOS:
    ticket: string | null
    ramo_bucket: string | null
    ramo_code: string | null
    aseguradora_code: string | null
    tramite_code: string | null
    tipo_poliza: string | null
    estado_simple: string | null
    sla_due_date: string | null
    sla_paused_at: string | null
    sla_accumulated_pause_hours: number
    aplazado_until: string | null
    aplazado_months: number | null
    aplazar_reason: string | null
    ai_classification: Json | null
    ai_confidence: number | null
    missing_fields: string[] | null
    special_flags: string[] | null
    detected_broker_email: string | null
    assigned_master_id: string | null
  }
  Insert: {
    // ... agregar los mismos campos con ? para opcionales
  }
  Update: {
    // ... agregar los mismos campos con ?
  }
}
```

## Instrucciones

1. Abrir `src/lib/database.types.ts`
2. Buscar la línea `temp_client_import: {` (línea ~4401)
3. Después del cierre de `temp_client_import` (línea ~4525)
4. Antes de `temp_client_imports: {` (línea ~4526)
5. Insertar las 8 nuevas tablas
6. Actualizar la tabla `cases` existente con los nuevos campos

**Nota:** Dado que no tengo permisos para generar automáticamente con `supabase gen types`, este archivo debe editarse manualmente o regenerarse cuando tengas acceso con las credenciales correctas.
