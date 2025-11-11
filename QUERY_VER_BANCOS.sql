-- Ver todos los bancos disponibles en ach_banks
SELECT 
    route_code,
    bank_name,
    status
FROM ach_banks
ORDER BY route_code;

-- Ver qué bancos únicos hay en los datos a actualizar
SELECT DISTINCT banco
FROM (VALUES
    ('BAC INTERNATIONAL BANK'),
    ('BANCO GENERAL'),
    ('BANISTMO S.A.'),
    ('CAJA DE AHORROS'),
    ('CREDICORP BANK'),
    ('GLOBAL BANK'),
    ('THE BANK OF NOVA SCOTIA')
) AS bancos(banco)
ORDER BY banco;
