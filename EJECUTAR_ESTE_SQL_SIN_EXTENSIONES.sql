-- =====================================================
-- ACTUALIZACIÓN MASIVA BROKERS - SIN EXTENSIONES
-- =====================================================

-- PASO 1: Función para limpiar acentos (sin necesidad de extensión unaccent)
CREATE OR REPLACE FUNCTION remove_accents(text TEXT) RETURNS TEXT AS $$
BEGIN
    RETURN TRANSLATE(
        text,
        'áéíóúàèìòùäëïöüâêîôûãõñçÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÃÕÑÇ',
        'aeiouaeiouaeiouaeiouaoncAEIOUAEIOUAEIOUAEIOUAONC'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- PASO 2: Crear funciones helper
CREATE OR REPLACE FUNCTION clean_account(account TEXT) RETURNS TEXT AS $$
BEGIN 
    -- Solo limpia, NO agrega 0 (eso lo hace el sistema al generar archivos ACH)
    RETURN CASE 
        WHEN account IS NULL OR TRIM(account) = '' THEN NULL
        ELSE REGEXP_REPLACE(account, '[^0-9]', '', 'g')
    END;
END; 
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_bank_code(bank TEXT) RETURNS TEXT AS $$
BEGIN
    -- Mapear a códigos REALES de ach_banks
    RETURN CASE 
        WHEN bank ILIKE '%GENERAL%' THEN '71'           -- BANCO GENERAL
        WHEN bank ILIKE '%BANISTMO%' THEN '26'          -- BANISTMO
        WHEN bank ILIKE '%BAC%' THEN '1384'             -- BAC INTERNACIONAL
        WHEN bank ILIKE '%GLOBAL%' THEN '1151'          -- GLOBAL BANK
        WHEN bank ILIKE '%SCOTI%' OR bank ILIKE '%NOVA%' THEN '424'  -- SCOTIA BANK
        WHEN bank ILIKE '%CAJA%' THEN '770'             -- CAJA DE AHORROS
        WHEN bank ILIKE '%CREDICORP%' THEN '1106'       -- CREDICORP BANK
        ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_tipo_code(tipo TEXT) RETURNS TEXT AS $$
BEGIN RETURN CASE WHEN tipo ILIKE '%corriente%' THEN '03' ELSE '04' END;
END; $$ LANGUAGE plpgsql IMMUTABLE;

-- PASO 3: Crear tabla temporal con datos CSV
CREATE TEMP TABLE temp_broker_data (
    name TEXT, email TEXT, phone TEXT, assa_code TEXT, license_no TEXT,
    banco TEXT, numero_cuenta TEXT, tipo_texto TEXT, titular TEXT, 
    cedula TEXT, percent_default NUMERIC
);

-- PASO 4: Insertar datos
INSERT INTO temp_broker_data VALUES
('ADOLFO PRESCOTT','aprescott@prescottyasociados.com','66123661',NULL,'PN3377','BANCO GENERAL','449987510235','Cuenta de ahorros','ADOLFO PRESCOTT','8-8888-1',0.8),
('ANGELICA RAMOS','amariar23@gmail.com','66654948',NULL,NULL,'BAC INTERNATIONAL BANK','109704692','Cuenta de ahorros','ANGELICA RAMOS','8-232-249',0.7),
('ARICELA CORREA','asermusa@yahoo.com','66387374',NULL,NULL,'CAJA DE AHORROS','10000368562','Cuenta de ahorros','ARICELA CORREA','PN0001843',0.5),
('ASURIM DE GRACIA','asurimnafis86@hotmail.com','61399449','PJ750-35',NULL,'BANCO GENERAL','401985858123','Cuenta de ahorros','ASURIM DE GRACIA','8-792-670',0.5),
('CARLOS FOOT','carlosfoot777@yahoo.com','69826148',NULL,'PN5410','BANCO GENERAL','411012105527','Cuenta de ahorros','CARLOS FOOT','10-24-597',0.8),
('CESAR PEREA','cpereag04@gmail.com','63597030','PJ750-47',NULL,'BANCO GENERAL','489995327374','Cuenta de ahorros','CESAR PEREA','8-8888-2',0.7),
('CORALIA AVILA','coraliaseguros@yahoo.es','66646923',NULL,'PN5398','BANCO GENERAL','473975606805','Cuenta de ahorros','CORALIA AVILA','6-56-2438',0.8),
('DAVID COHEN','dicsaa72@gmail.com','69483436','PJ750-49',NULL,'BANCO GENERAL','406017441423','Cuenta de ahorros','DAVID COHEN','8-413-181',0.7),
('DAYRA ALVAEZ','seguroscontablesdac@gmail.com','66154899',NULL,'PN8091','CAJA DE AHORROS','100173884','Cuenta de ahorros','DAYRA ALVAEZ','8-447-334',0.5),
('DENISE CHAMBER','chambersdenis@hotmail.com','62191135',NULL,'PN6282','BANCO GENERAL','472995405289','Cuenta de ahorros','DENISE CHAMBER','7-92-2624',0.7),
('DENISE SALDANA','denisesaldana23@gmail.com','63827557','PJ750-11',NULL,'GLOBAL BANK','7301002034','Cuenta de ahorros','DENISE SALDANA','4-143-378',0.7),
('DIANA CANDANEDO','candanedoylatorre@hotmail.com','66900967',NULL,'PN2722',NULL,NULL,NULL,'DIANA CANDANEDO','8-8888-3',0.8),
('DIDIMO SAMUDIO','didimosamudio@lideresenseguros.com','66762373',NULL,NULL,'BANCO GENERAL','469013085237','Cuenta de ahorros','DIDIMO SAMUDIO','4-139-947',0.94),
('EASY SOMARRIBA','somarribaeisy@gmail.com','68318906','PJ750-29',NULL,'BANCO GENERAL','439995261751','Cuenta de ahorros','EASY SOMARRIBA','8-237-2732',0.7),
('EDIS CASTILLO','ediskatherine@hotmail.com','69812118','PJ750-8',NULL,'BANCO GENERAL','421015779361','Cuenta de ahorros','EDIS CASTILLO','4-714-289',0.8),
('EDUARDO ASCANIO','eascanio@avenirgroupla.com','68170183',NULL,NULL,'THE BANK OF NOVA SCOTIA','200000057972','Cuenta de ahorros','EDUARDO ASCANIO','E-8-129097',0.7),
('ELENA NUNEZ','elenacalis@hotmail.com','66716856',NULL,'PN8231','BANCO GENERAL','413992925242','Cuenta de ahorros','ELENA NUNEZ','9-126-122',0.5),
('ELIZABETH ARCE','elizabetarce26@gmail.com','68871821',NULL,'PN7011','BANCO GENERAL','420018944978','Cuenta de ahorros','ELIZABETH ARCE','8-159-1809',0.7),
('ERICK BATISTA','erick_bat@yahoo.com','62117007',NULL,'PN7051','CREDICORP BANK','4021982853','Cuenta de ahorros','ERICK BATISTA','8-8888-4',0.7),
('EUGENIA AGUILAR','xeniaaguilarpty@gmail.com','69801440',NULL,'PN5087','BANCO GENERAL','423993440491','Cuenta de ahorros','EUGENIA AGUILAR','8-189-147',0.6),
('EVA DE TEDESCO','tedescovicente@aol.com','62338734',NULL,'PN5340','BANCO GENERAL','344100043393','Cuenta corriente','EVA DE TEDESCO','8-8888-5',0.8),
('FABIAN CANDANEDO','candanedof@gmail.com','62147547','PJ750-18',NULL,NULL,NULL,NULL,'FABIAN CANDANEDO','8-848-82',0.8),
('GABRIEL HERNANDEZ','gehcseguros@gmail.com','69812604',NULL,NULL,'BANCO GENERAL','443994946604','Cuenta de ahorros','GABRIEL HERNANDEZ','E-8-137400',0.7),
('GENIVA GONZALEZ','genivanightingale@gmail.com','66729648',NULL,'PN3913','BANISTMO S.A.','107879679','Cuenta corriente','GENIVA GONZALEZ','8-306-693',0.7),
('GEORGINA PEREZ','georginalperez@yahoo.com','64476874',NULL,NULL,'CAJA DE AHORROS','6300209953','Cuenta de ahorros','GEORGINA PEREZ','8-757-2426',0.7),
('HERICKA GONZALEZ','herickagonzalez@lideresenseguros.com','66138610','PJ750-42',NULL,'BANCO GENERAL','472002215828','Cuenta de ahorros','RAFAEL VIZUETTE','4-710-2118',0.7),
('HERMINIO ARCIA','herminio.arcia@gmail.com','66718789',NULL,NULL,NULL,NULL,NULL,'HERMINIO ARCIA','3-81-1476',0.8),
('INDIRA FRANCISCO','indirafrancisco08@hotmail.com','65985628',NULL,'PN6148','BANCO GENERAL','449016816438','Cuenta de ahorros','INDIRA FRANCISCO','8-777-1392',0.8),
('INGRID FRANCO','seguros.ifranco@gmail.com','68853494','PJ750-40',NULL,'BANCO GENERAL','497200045832','Cuenta de ahorros','INGRID FRANCO','4-745-1882',0.7),
('INGRID HIM','ingridhim@gmail.com','63167477',NULL,'PN8387','BANCO GENERAL','418013489571','Cuenta de ahorros','INGRID HIM','8-324-423',0.7),
('IRIAM GONZALEZ','iriamgp@hotmail.com',NULL,NULL,NULL,'BANCO GENERAL','472018474899','Cuenta de ahorros','IRIAM GONZALEZ',NULL,0.7),
('ITZY GARCIA','itzygarciadeparedes@hotmail.com','65213731',NULL,'PN5362','BANCO GENERAL','439990411589','Cuenta de ahorros','ITZY GARCIA','8-230-1491',0.7),
('IVETTE KAREN MARTINEZ','kips020969@hotmail.com','65505034',NULL,'PN5926','BANCO GENERAL','472984819977','Cuenta de ahorros','IVETTE KAREN MARTINEZ','8-324-423',0.7),
('JAN GORDON','jangordon@cableonda.net','60708358',NULL,'PN6051','BANCO GENERAL','497013058221','Cuenta de ahorros','JAN GORDON','8-747-35',0.8),
('JAVIER SAMUDIO','javiersamudio@lideresenseguros.com','66766673','PJ750-54',NULL,'BANCO GENERAL','444994373086','Cuenta de ahorros','JAVIER SAMUDIO','8-932-1155',0.94),
('JAZMIN CAMILO','jazminkmilo@gmail.com','61498225',NULL,NULL,'BANCO GENERAL','497018651759','Cuenta de ahorros','JAZMIN CAMILO','8-802-1790',0.6),
('JOSE CARRASCO','josep1219@gmail.com','63171123','PJ750-25',NULL,'BANISTMO S.A.','117478488','Cuenta de ahorros','JOSE CARRASCO','8-841-1639',0.7),
('JOSE MANUEL FERNANDEZ','fernandez_jose_08@hotmail.com','65037130','PJ750-20',NULL,'BANCO GENERAL','444015855153','Cuenta de ahorros','DIDIMO SAMUDIO','8-306-488',0.82),
('KAROL VALDES','kvseguros13@gmail.com','64811169','PJ750-4',NULL,'BANCO GENERAL','489170208298','Cuenta de ahorros','HAROLD SANMARTIN','4-719-1409',0.7),
('KATHRIN AGUIRRE','kathrin.aguirre@hotmail.com','62763645',NULL,'PP132-2024','BANCO GENERAL','446994020280','Cuenta de ahorros','KATHRIN AGUIRRE','3-730-1523',0.8),
('KATTIA BERGUIDO','katberguido08@gmail.com','66586211',NULL,'PN5140','BANCO GENERAL','478990000575','Cuenta de ahorros','KATTIA BERGUIDO','8-19-1437',0.6),
('KENIA GONZALEZ','kgonzalezseguros@gmail.com','67704570',NULL,'PN8115','BANCO GENERAL','410015251081','Cuenta de ahorros','KENIA GONZALEZ','3-701-2424',0.8),
('KETZA RIOS','ketzaseguros@gmail.com','62019073',NULL,'PN8430','BANCO GENERAL','495994180311','Cuenta de ahorros','KETZA RIOS','4-751-720',0.8),
('KHADINE GUTIERREZ','klga2006@hotmail.com','67288165',NULL,'PN6089','BANCO GENERAL','410995044668','Cuenta de ahorros','KHADINE GUTIERREZ','8-704-1267',0.5),
('LEORMAN HUDSON','lha04@live.com','67374392','PJ750-10',NULL,'BANCO GENERAL','469995419038','Cuenta de ahorros','LEORMAN HUDSON','E-8-109-130',0.5),
('LILIANA SAMUDIO','samudiosegurospa@outlook.com','19452471474',NULL,NULL,NULL,NULL,NULL,'LILIANA SAMUDIO','4-752-1874',0.6),
('LISSA','contacto@lideresenseguros.com',NULL,NULL,NULL,NULL,NULL,NULL,'LISSA',NULL,1),
('LISSETH VERGARA','lissett.vergara17@gmail.com','66507095',NULL,'PP005-2025','BANCO GENERAL','410990194705','Cuenta de ahorros','LISSETH VERGARA','8-847-1314',0.8),
('LUCIA NIETO','luciaydanna@gmail.com','66074054',NULL,NULL,'BANCO GENERAL','477017150638','Cuenta de ahorros','LUCIA NIETO','6-702-1085',0.94),
('LUIS BRANCA','lbranca68@yahoo.com','66260758',NULL,'PN5987','BANCO GENERAL','448961224877','Cuenta de ahorros','LUIS BRANCA','8-220-378',0.7),
('LUIS CAMARGO','lcamargolopez1279@gmail.com',NULL,'PJ750-55',NULL,'BANCO GENERAL','413986522217','Cuenta de ahorros','LUIS CAMARGO','8-8888-6',0.8),
('LUIS QUIROS','luisquiros@lideresenseguros.com','68177166','PJ750-28',NULL,'BANCO GENERAL','465983577559','Cuenta de ahorros','EDILZA QUIROS','8-861-559',0.8),
('LUZ CHAVEZ','luzgraciela@yahoo.com','66859668',NULL,'PN3738','BANCO GENERAL','438983360443','Cuenta de ahorros','LUZ CHAVEZ','4-756-1293',0.7),
('LUZ GONZALEZ','luztam2110@gmail.com','66859471',NULL,'PN5737','BANCO GENERAL','451980810303','Cuenta de ahorros','LUZ GONZALEZ','8-220-378',0.5),
('MARCO HASKINS','mhseguros84@hotmail.com','60068033',NULL,'PN5104','BANCO GENERAL','410984308676','Cuenta de ahorros','MARCO HASKINS','8-190-112',0.7),
('MARIA URGELLES','maria.urgelles@gmail.com','62948646',NULL,NULL,'BANCO GENERAL','472992523601','Cuenta de ahorros','MARIA URGELLES','E-8-159736',0.8),
('MARITZA LEZCANO','maritzalezcanog@gmail.com','66685057','PJ750-30',NULL,'BANCO GENERAL','403015938434','Cuenta de ahorros','MARITZA LEZCANO','8-8888-7',0.7),
('MARIZEL RODRIGUEZ','marguezpty@gmail.com','60908643',NULL,NULL,'BANCO GENERAL','426015604335','Cuenta de ahorros','MARIZEL RODRIGUEZ','8-782-257',0.7),
('MARK CASTILLO','castillocvmark@gmail.com','62177449','PJ750-52',NULL,'BANCO GENERAL','432018925684','Cuenta de ahorros','MARK CASTILLO','8-8888-8',0.7),
('MARLYN BOTELLO','marlynbotello@hotmail.com','65181460',NULL,'PN6042','CAJA DE AHORROS','140000123657','Cuenta de ahorros','MARLYN BOTELLO','6-42-258',0.8),
('MINISMEY CENTENO','minismei@hotmail.com','68469189','PJ750-37',NULL,'BANCO GENERAL','430983201974','Cuenta de ahorros','MINISMEY CENTENO','1-34-580',0.7),
('MITXEL QUINTERO','mitxel2086@hotmail.com','67669893','PJ750-33',NULL,'BANCO GENERAL','423984185297','Cuenta de ahorros','MITXEL QUINTERO','4-739-1021',0.7),
('PAULINA GONZALEZ','pauli88@yahoo.com','66741378',NULL,'PN8011','BANCO GENERAL','495013291513','Cuenta de ahorros','PAULINA GONZALEZ','8-156-61',0.7),
('PEDRO MONTANEZ','pmontanez.01@gmail.com','67011091','PJ750-50',NULL,'BANCO GENERAL','417983203055','Cuenta de ahorros','PEDRO MONTANEZ','8-8888-9',0.7),
('RAUL ROBLES','raul.roblesasesordeseguros@gmail.com','61942952','PJ750-51',NULL,'BANCO GENERAL','423998778268','Cuenta de ahorros','RAUL ROBLES','8-8888-10',0.7),
('REINA PEDRESCHI','rpedreschi@cableonda.net','66761202',NULL,'PN6813',NULL,NULL,NULL,'REINA PEDRESCHI','8-8888-11',0.7),
('RICARDO JIMENEZ','rj.jimenez.173@gmail.com','65979969','PJ750-22',NULL,'BANCO GENERAL','419981148157','Cuenta de ahorros','RICARDO JIMENEZ','8-414-418',0.7),
('RICARDO VALDES','segurosrv@gmail.com','66879470',NULL,'PN5854','BANCO GENERAL','404014145943','Cuenta de ahorros','RICARDO VALDES','8-480-886',0.8),
('RUTH MEJIA','ruthmejia@cableonda.net','64902814','PJ750-19',NULL,'BANCO GENERAL','305010505450','Cuenta corriente','RUTH MEJIA','8-257-1037',0.8),
('SEBASTIANA CHIARI','sebastiana4562@hotmail.com','66719699','PJ750-46',NULL,'BANCO GENERAL','420995053316','Cuenta de ahorros','SEBASTIANA CHIARI','8-324-202',0.7),
('SIMON AUSTIN','invaustin@hotmail.com','67161236',NULL,'PN4090','CREDICORP BANK','4021024224','Cuenta de ahorros','SIMON AUSTIN','8-231-478',0.7),
('SOBIANTH PINEDA','spineda@integra-seguros.com','61512645',NULL,'PJ860',NULL,NULL,NULL,'SOBIANTH PINEDA','8-742-1959',0.7),
('SONIA ARENAS','soniaa0154@outlook.com','61404200',NULL,NULL,'BANCO GENERAL','410994015080','Cuenta de ahorros','SONIA ARENAS','E-8-62204',0.8),
('STEPHANY MONTENEGRO','stephyelain1416@gmail.com',NULL,NULL,NULL,'BANCO GENERAL','401016248091','Cuenta de ahorros','STEPHANY MONTENEGRO','8-8888-13',0.5),
('STHEYSI VEJARANO','stheysi1725@gmail.com','66231233','PJ750-45',NULL,'BANCO GENERAL','472975904025','Cuenta de ahorros','STHEYSI VEJARANO','8-846-1560',0.8),
('SUJEY SAMUDIO','sujeysamudio@gmail.com','66767793',NULL,NULL,'BANCO GENERAL','405994885232','Cuenta de ahorros','SUJEY SAMUDIO','8-767-2295',0.8),
('TOMAS PINZON','gerencia@segurospty.com','66764478',NULL,'PN6667','BANCO GENERAL','410015368518','Cuenta de ahorros','TOMAS PINZON','8-8888-14',0.7),
('VERONICA HENRIQUEZ','vhenriquez@hotmail.es','69454920',NULL,NULL,'BANCO GENERAL','423990119009','Cuenta de ahorros','VERONICA HENRIQUEZ','8-8888-15',0.7),
('YANIA HERRERA','segurosyania@gmail.com','65789993',NULL,NULL,'BANCO GENERAL','418994013722','Cuenta de ahorros','YANIA HERRERA','8-470-825',0.5),
('YANITZA JUSTINIANI','yanitzajustiniani@lideresenseguros.com','69639242','PJ750-39',NULL,'BANCO GENERAL','419983999058','Cuenta de ahorros','YANITZA JUSTINIANI','8-740-1256',0.8),
('YIRA RAMOS','yiraramos@lideresenseguros.com','63786043',NULL,NULL,'BANCO GENERAL','473993783430','Cuenta de ahorros','YIRA RAMOS','8-360-753',0.8),
('ZOEL GONZALEZ','zoelevent7@gmail.com','66774397','PJ750-38',NULL,'BANCO GENERAL','416010017085','Cuenta de ahorros','ZOEL GONZALEZ','8-368-622',0.5);

-- PASO 5: Actualizar brokers
DO $$
DECLARE
    updated INTEGER := 0;
    not_found INTEGER := 0;
    rec RECORD;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'INICIANDO ACTUALIZACIÓN DE 84 BROKERS';
    RAISE NOTICE '========================================';
    
    FOR rec IN SELECT * FROM temp_broker_data LOOP
        UPDATE brokers b SET 
            name = rec.name,
            phone = NULLIF(rec.phone, ''),
            national_id = NULLIF(rec.cedula, ''),
            assa_code = NULLIF(rec.assa_code, ''),
            license_no = NULLIF(rec.license_no, ''),
            bank_route = get_bank_code(rec.banco),
            bank_account_no = clean_account(rec.numero_cuenta),
            tipo_cuenta = get_tipo_code(rec.tipo_texto),
            nombre_completo = UPPER(remove_accents(LEFT(rec.titular, 22))),
            beneficiary_name = UPPER(remove_accents(LEFT(rec.titular, 22))),
            percent_default = rec.percent_default
        FROM profiles p
        WHERE b.p_id = p.id AND LOWER(TRIM(p.email)) = LOWER(TRIM(rec.email));
        
        IF FOUND THEN 
            updated := updated + 1;
            RAISE NOTICE '✅ %', rec.email;
        ELSE 
            not_found := not_found + 1;
            RAISE NOTICE '❌ NO ENCONTRADO: %', rec.email;
        END IF;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Actualizados: %', updated;
    RAISE NOTICE '❌ No encontrados: %', not_found;
    RAISE NOTICE 'TOTAL: % brokers procesados', updated + not_found;
    RAISE NOTICE '========================================';
END $$;

-- PASO 6: Verificar resultados
SELECT 
    b.name as nombre_broker, 
    p.email, 
    b.national_id as cedula,
    b.phone as telefono,
    b.assa_code,
    b.license_no as licencia,
    b.bank_route as cod_banco,
    ab.bank_name as nombre_banco,
    b.bank_account_no as cuenta,
    b.tipo_cuenta as tipo_cod,
    act.name as tipo_nombre,
    b.nombre_completo as titular_ach,
    b.beneficiary_name as nombre_cheque,
    b.percent_default as porcentaje,
    CASE 
        WHEN b.bank_route IS NOT NULL 
         AND b.bank_account_no IS NOT NULL 
         AND b.tipo_cuenta IS NOT NULL 
         AND b.nombre_completo IS NOT NULL 
        THEN '✅ LISTO'
        ELSE '⚠️ INCOMPLETO'
    END as estado_ach
FROM brokers b
JOIN profiles p ON b.p_id = p.id
LEFT JOIN ach_banks ab ON b.bank_route = ab.route_code
LEFT JOIN ach_account_types act ON b.tipo_cuenta = act.code
WHERE b.active = true
ORDER BY estado_ach DESC, b.name;

-- PASO 7: Limpiar funciones temporales
DROP FUNCTION remove_accents(TEXT);
DROP FUNCTION clean_account(TEXT);
DROP FUNCTION get_bank_code(TEXT);
DROP FUNCTION get_tipo_code(TEXT);

-- =====================================================
-- COMPLETADO ✅
-- =====================================================
