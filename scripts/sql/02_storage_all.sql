-- ==============================================
-- PASO 2 · Buckets & Policies de Storage
-- Buckets: avatars (público lectura), descargas, pendientes.
-- ==============================================

-- Crear buckets si no existen
select storage.create_bucket('avatars',   public => true);
select storage.create_bucket('descargas', public => false);
select storage.create_bucket('pendientes', public => false);

-- Habilitar RLS a nivel storage.objects (definido por políticas)
-- (Supabase ya aplica políticas sobre storage.objects)

-- Borra políticas existentes con mismo nombre (idempotencia)
do $$
begin
  execute 'drop policy if exists avatars_public_read on storage.objects';
  execute 'drop policy if exists avatars_user_insert on storage.objects';
  execute 'drop policy if exists avatars_user_update on storage.objects';
  execute 'drop policy if exists avatars_user_delete on storage.objects';

  execute 'drop policy if exists descargas_read_auth on storage.objects';
  execute 'drop policy if exists descargas_cud_master on storage.objects';

  execute 'drop policy if exists pendientes_read_broker on storage.objects';
  execute 'drop policy if exists pendientes_read_master on storage.objects';
  execute 'drop policy if exists pendientes_cud_master on storage.objects';
end$$;

-- AVATARS (lectura pública; CUD por usuario autenticado sobre su carpeta uid/*)
create policy avatars_public_read
  on storage.objects for select
  using ( bucket_id = 'avatars' );

create policy avatars_user_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_user_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_user_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DESCARGAS (lectura para autenticados; CUD solo master)
create policy descargas_read_auth
  on storage.objects for select to authenticated
  using ( bucket_id = 'descargas' );

create policy descargas_cud_master
  on storage.objects for all to authenticated
  using ( bucket_id = 'descargas' and public.is_master() )
  with check ( bucket_id = 'descargas' and public.is_master() );

-- PENDIENTES (lectura broker por carpeta email, lectura master global; CUD master)
-- Convención de rutas: pendientes/{YYYY}/{MM}/{brokerEmail}/{pendingId}/file.pdf
create policy pendientes_read_broker
  on storage.objects for select to authenticated
  using (
    bucket_id = 'pendientes'
    and lower(name) like ('%' || lower(coalesce(auth.jwt()->>'email','')) || '/%')
  );

create policy pendientes_read_master
  on storage.objects for select to authenticated
  using ( bucket_id = 'pendientes' and public.is_master() );

create policy pendientes_cud_master
  on storage.objects for all to authenticated
  using ( bucket_id = 'pendientes' and public.is_master() )
  with check ( bucket_id = 'pendientes' and public.is_master() );

-- ==============================================
