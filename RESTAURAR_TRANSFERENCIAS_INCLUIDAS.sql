-- RESTAURAR MARCADOR DE INCLUSIÓN PARA TRANSFERENCIAS DEL CORTE 05/12/2025 - 18/12/2025
-- Que fueron incluidas en el corte 17/12/2025 - 03/01/2026

-- Estas transferencias perdieron su marcador cuando se marcaron como PAGADAS antes del fix

UPDATE bank_transfers_comm
SET notes_internal = notes_internal || E'\n📌 Incluida en corte: 17/12/2025 - 03/01/2026 (20/01/2026)'
WHERE id IN (
  'b7e00d39-5aaa-4454-9008-10b01c360d0b',
  '2ce84ddb-6b31-4fd1-bea8-e50cc1a8ec26',
  'f2e2c1bc-9ed6-4c56-a5f8-d2f0bfe65252',
  'a79b7ad3-3356-4e70-a11e-f0103f747c9a',
  'be5fa3d4-df1d-44e0-ab7f-ba509e9ee2c4',
  '33a4535d-4f64-4225-8731-f91575653751',
  '86cccbe8-c300-4bc8-ba6c-296e932c9b63',
  'e213ac8b-8ce2-4f58-95c5-da3acd4b0364',
  '42174fc7-705a-48ac-aa02-44fd3ad66648',
  'fc819f71-6155-4654-94a5-27c75ad3b2e5',
  'dafe152f-d4cf-45f5-a621-3dfc3c564f50',
  '7185dcde-bddf-4651-8100-a706d1652ad1',
  '7247be62-b008-4ec3-be52-e5ff0515f36c',
  'b2a82b66-8f9a-4c13-90d0-b1b5a096da5e',
  '78bfc1b3-3789-4e73-af33-2e1c70e2a7d6',
  'cbb33055-faa7-4d11-add9-d4728fb2cb78',
  'adcdacec-194f-4e19-b946-faaaa6b40983',
  'ac865d08-40a1-4557-bc69-8119cc74be06',
  'cec8b3d4-1701-4371-a1f0-a170faaa1072',
  '24723b61-73b2-4872-aac8-0511006b58da',
  '81161d5c-9d77-4b65-a894-3775e323dec7',
  'a886205d-229d-463e-8d5c-eb64cfaf46d5',
  'a5df167e-3f84-4861-9eab-0b225a1e87cd',
  '55d30ca3-6cad-4557-89ec-c1c227653290',
  '13eb7c2d-ae21-463a-bbd6-376fd6bdcda0',
  'd64b0c07-48fe-460b-b941-4cd83e0d3602',
  'e926f016-3f92-4acd-bef0-0ff3cc235390',
  '772b6c25-b7e8-4dcc-8de0-513b76b896c5',
  '0e4c1961-bed5-4576-9368-f34a4013da7c',
  '1c6cce66-887d-49f8-ac74-79ad1db39c7c',
  '5d7438ce-6efc-4e01-b984-15ca635b176d',
  'e2a51c0f-0bdf-41ad-a442-db0a9b44dd7d',
  '7826c1cd-768e-43f5-ad40-6132d101cb0c',
  'fda9b2e3-97cf-4b87-b8eb-4b0bebca22aa',
  '241dc47d-916c-4080-955a-64892c15e454',
  '751534a3-e81e-4630-b842-67b6d07c3156',
  '6d3331a9-0428-4102-b882-2a3f561ec3c3',
  '9f298661-4515-45b9-a106-8ddd747b7c45',
  '99ab77e8-62d6-44f9-bed5-6d34b96aa018',
  '96a9870d-20e3-48f6-8542-2bab1f32a76a',
  'f8369160-baaa-4e79-ae92-50f32f755ab7',
  '2869ddaf-6055-4346-abb3-0240a025f7d0',
  '8992cdf3-9b37-4e0f-9e1d-019fbd573e4b',
  'b4a92bd5-66f8-4991-8f42-a56e5847aa0e',
  '1f8a485d-27a0-49fb-9e65-e86210986fd5',
  '25b29b46-b575-4cab-9142-e218f6bf8815',
  '38240280-70b5-4719-86b9-9c17ac97b914',
  '1c167adf-2028-4ca3-849c-86d61a1b371f',
  'e9e54ead-620c-4e81-987b-29e597e7765a',
  'ed462f8d-bc68-4846-8282-37a5ec086806',
  'e5b2a78b-0d59-4561-ad4f-f765afaadbfa',
  '69b9fbbb-d3a3-4048-b2f4-95906d4036bb'
)
AND notes_internal NOT LIKE '%Incluida en corte:%';

-- Verificar que se agregó el marcador correctamente
SELECT 
  id,
  reference_number,
  amount,
  status,
  notes_internal
FROM bank_transfers_comm
WHERE id IN (
  'b7e00d39-5aaa-4454-9008-10b01c360d0b',
  '2ce84ddb-6b31-4fd1-bea8-e50cc1a8ec26',
  'f2e2c1bc-9ed6-4c56-a5f8-d2f0bfe65252'
)
ORDER BY reference_number;
