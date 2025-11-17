#!/usr/bin/env python3
"""
Script para convertir nombres de brokers a emails en el CSV
"""

import csv
import sys

# Mapeo de nombres a emails (basado en los datos que me proporcionaste)
BROKER_NAME_TO_EMAIL = {
    'KAROL VALDES': 'kvseguros13@gmail.com',
    'LUIS QUIROS': 'luisquiros@lideresenseguros.com',
    'YANITZA JUSTINIANI': 'yanitzajustiniani@lideresenseguros.com',
    'MINISMEY CENTENO': 'minismei@hotmail.com',
    'SIN IDENTIFICAR': 'samudiosegurospa@outlook.com',  # O el email que prefieras para "sin identificar"
    'LIDERES': 'samudiosegurospa@outlook.com',
    'ANGELICA RAMOS': 'angelicaramos@lideresenseguros.com',
    'DIDIMO SAMUDIO': 'didimosamudio@lideresenseguros.com',
    'SONIA ARENAS': 'soniaarenas@lideresenseguros.com',
    'LUCIA NIETO': 'lucianieto@lideresenseguros.com',
    'LUCIE NIETO': 'lucianieto@lideresenseguros.com',
    'RUTH MEJIA': 'ruthmejia@lideresenseguros.com',
    'LISSETH VERGARA': 'lissethvergara@lideresenseguros.com',
    'EDIS CASTILLO': 'ediscastillo@lideresenseguros.com',
    'KETZA RIOS': 'ketzarios@lideresenseguros.com',
    'KARINA SOLIS/JOSE CARRASCO': 'karinasolis@lideresenseguros.com',
    'ITZY DE CANDANEDO': 'itzycandanedo@lideresenseguros.com',
    'ELIZABETH ARCE': 'elizabetharce@lideresenseguros.com',
    'KATTIA BERGUIDO': 'kattiaberguido@lideresenseguros.com',
    'KATHRIN AGUIRRE': 'kathrinaguirre@lideresenseguros.com',
    'YANIA HERRERA': 'yaniaherrera@lideresenseguros.com',
    'YIRA RAMOS': 'yiraramos@lideresenseguros.com',
    'JAZMIN CAMILO': 'jazmincamilo@lideresenseguros.com',
    'MARIA URGELLES': 'mariaurgelles@lideresenseguros.com',
    'STHEYSI VEJARANO': 'stheysivejarano@lideresenseguros.com',
    'JAVIER SAMUDIO': 'javiersamudio@lideresenseguros.com',
    'IVETTE KAREN DE MARTINEZ': 'ivettemartinez@lideresenseguros.com',
    'CARLOS FOOT': 'carlosfoot@lideresenseguros.com',
    'LUIS BRANCA': 'luisbranca@lideresenseguros.com',
    'KENIA GONZALEZ': 'keniagonzalez@lideresenseguros.com',
    'EDUARDO ASCANIO': 'eduardoascanio@lideresenseguros.com',
    'INGRID HIM': 'ingridhim@lideresenseguros.com',
    'HERICKA GONZALEZ': 'hericka@lideresenseguros.com',
    'SEBASTIANA CHIARI': 'sebastianachiari@lideresenseguros.com',
    'DI S JOSE MANUEL': 'josemanuel@lideresenseguros.com',
    'RICARDO JIMENEZ': 'ricardojimenez@lideresenseguros.com',
    'ASURIM DE GRACIA': 'asurimgracia@lideresenseguros.com',
    'PEDRO MONTANEZ': 'pedromontanez@lideresenseguros.com',
    'MARK CASTILLO': 'markcastillo@lideresenseguros.com',
    'YANIZTA JUSTINIANI': 'yanitzajustiniani@lideresenseguros.com',
    'EASY SOMARRIBA': 'easysomarriba@lideresenseguros.com',
    'YORLENIS MORENO': 'yorlenismoreno@lideresenseguros.com',
    'MITXEL QUINTERO': 'mitxelquintero@lideresenseguros.com',
    'ELENA NUÑEZ': 'elenanunez@lideresenseguros.com',
    'VERONICA HENRIQUEZ': 'veronicahenriquez@lideresenseguros.com',
    'ARICELA CORREA': 'aricelaсorrea@lideresenseguros.com',
    'CESAR PEREA': 'cesarperea@lideresenseguros.com',
    'CORALIA AVILA': 'coraliaavila@lideresenseguros.com',
    'DAVID COHEN': 'davidcohen@lideresenseguros.com',
    'DENISE SALDAÑA': 'denisesaldana@lideresenseguros.com',
    'ERICK CHAVEZ': 'erickchavez@lideresenseguros.com',
    'GENIVA NIGHTINGALE': 'genivanightingale@lideresenseguros.com',
    'GEORGINA PEREZ': 'georginaperez@lideresenseguros.com',
    'HERMINIO ARCIA': 'herminioarcia@lideresenseguros.com',
    'INGRID FRANCO': 'ingridfranco@lideresenseguros.com',
    'JAVIER SOSA': 'javiersosa@lideresenseguros.com',
    'LEORMAN HUDSON': 'leormanhudson@lideresenseguros.com',
    'LILIANA SAMUDIO': 'lilianasamudio@lideresenseguros.com',
    'LUZ CHAVEZ': 'luzchavez@lideresenseguros.com',
    'MARITZA LEZCANO': 'maritzalezcano@lideresenseguros.com',
    'MOISES NOVOA': 'moisesnovoa@lideresenseguros.com',
    'PAULINA GONZALEZ': 'paulinagonzalez@lideresenseguros.com',
    'RAUL ROBLES': 'raulrobles@lideresenseguros.com',
    'RICARDO VALDES': 'ricardovaldes@lideresenseguros.com',
    'SONIA LEYTON': 'sonialeyton@lideresenseguros.com',
    'STEPHANY MONTENEGRO': 'stephanymontenegro@lideresenseguros.com',
    'YALISNETH COZZI': 'yalisnethcozzi@lideresenseguros.com',
    'ZOEL GONZALEZ': 'zoelgonzalez@lideresenseguros.com',
    '0': 'samudiosegurospa@outlook.com',  # Email por defecto para registros sin broker
    'MAURICIO RODRIGUEZ': 'mauriciorodriguez@lideresenseguros.com',
    'MARCOS HADSKINS': 'marcoshadskins@lideresenseguros.com',
    'MARLYN RODRIGUEZ': 'marlynrodriguez@lideresenseguros.com',
    'DAYRA ALVAEZ': 'dayraalvaez@lideresenseguros.com',
    'IRIAM GONZALEZ': 'iriamgonzalez@lideresenseguros.com',
    'EUGENIA AGUILAR': 'eugeniaaguilar@lideresenseguros.com',
    'LUZ GONZALEZ': 'luzgonzalez@lideresenseguros.com',
    'GABRIEL HERNANDEZ': 'gabrielhernandez@lideresenseguros.com',
    'LUZ TREJOS': 'luztrejos@lideresenseguros.com',
    'MR SEGUROS': 'mrseguros@lideresenseguros.com',
    'ERIKA QUIROZ': 'erikaquiroz@lideresenseguros.com',
    'EVA AGUILAR DE TEDESCO': 'evaaguilar@lideresenseguros.com',
    'SUJEY SAMUDIO': 'sujeysamudio@lideresenseguros.com',
    'LEORMAN HUDGSON': 'leormanhudgson@lideresenseguros.com',
    'EDWIN CEDEÑO': 'edwincedeno@lideresenseguros.com',
}

def fix_csv(input_file, output_file):
    """Convierte nombres de brokers a emails en el CSV"""
    
    print(f"📖 Leyendo archivo: {input_file}")
    
    with open(input_file, 'r', encoding='utf-8') as infile, \
         open(output_file, 'w', encoding='utf-8', newline='') as outfile:
        
        reader = csv.DictReader(infile)
        fieldnames = reader.fieldnames
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        
        writer.writeheader()
        
        fixed_count = 0
        not_found_count = 0
        not_found_brokers = set()
        
        for row in reader:
            broker_name = row.get('broker_email', '').strip().upper()
            
            if broker_name and '@' not in broker_name:
                # Es un nombre, no un email
                email = BROKER_NAME_TO_EMAIL.get(broker_name)
                
                if email:
                    row['broker_email'] = email
                    fixed_count += 1
                else:
                    not_found_brokers.add(broker_name)
                    not_found_count += 1
            
            writer.writerow(row)
    
    print(f"\n✅ Conversión completada!")
    print(f"   ✓ {fixed_count} nombres convertidos a emails")
    print(f"   ⚠️  {not_found_count} nombres sin email conocido")
    
    if not_found_brokers:
        print(f"\n⚠️  Brokers sin email en el mapeo:")
        for broker in sorted(not_found_brokers):
            print(f"   - {broker}")
        print("\n💡 Agrega estos brokers al mapeo BROKER_NAME_TO_EMAIL")
    
    print(f"\n📄 Archivo guardado: {output_file}")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Uso: python fix_broker_names_to_emails.py <input.csv> <output.csv>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    fix_csv(input_file, output_file)
