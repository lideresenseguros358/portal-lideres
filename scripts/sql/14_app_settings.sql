-- Step 14: centralized application settings and seed defaults

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (key, value)
VALUES (
  'brand',
  jsonb_build_object(
    'logo', 'public/logo.png',
    'logo_alt', 'public/logo_alternativo.png',
    'favicon', 'public/favicon.ico',
    'colors', jsonb_build_object(
      'primary', '#010139',
      'olive', '#8aaa19',
      'grey', '#e6e6e6'
    )
  )
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES (
  'csv_bank_format',
  jsonb_build_object(
    'headers', jsonb_build_array('Cuenta', 'Beneficiario', 'Monto', 'Referencia'),
    'order', jsonb_build_array('bank_account', 'name', 'net_amount', 'reference')
  )
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES (
  'demo',
  jsonb_build_object('default_enabled', false)
)
ON CONFLICT (key) DO NOTHING;
