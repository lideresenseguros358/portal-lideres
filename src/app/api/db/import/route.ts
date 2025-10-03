import { NextRequest, NextResponse } from "next/server";
import { importPolicies } from "@/lib/db/import";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text.split("\n").filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: "El archivo está vacío o no tiene datos" },
        { status: 400 }
      );
    }

    const firstLine = lines[0];
    if (!firstLine) {
      return NextResponse.json(
        { error: "El archivo no tiene encabezados" },
        { status: 400 }
      );
    }
    const headers = firstLine.split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map((line, index) => {
      const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
      const row: any = {};
      
      headers.forEach((header, i) => {
        const value = values[i]?.trim().replace(/^"|"$/g, "") || "";
        // Map CSV columns to database fields
        switch(header.toLowerCase()) {
          case "name":
          case "nombre":
            row.client_name = value;
            break;
          case "national_id":
          case "cedula":
          case "ruc":
            row.national_id = value;
            break;
          case "email":
          case "correo":
            row.email = value;
            break;
          case "phone":
          case "telefono":
            row.phone = value;
            break;
          case "policy_number":
          case "numero_poliza":
            row.policy_number = value;
            break;
          case "ramo":
            row.ramo = value;
            break;
          case "insurer_id":
          case "aseguradora":
            row.insurer_id = value;
            break;
          case "start_date":
          case "fecha_inicio":
            row.start_date = value;
            break;
          case "renewal_date":
          case "fecha_renovacion":
            row.renewal_date = value;
            break;
          case "status":
          case "estado":
            row.status = value;
            break;
          default:
            row[header] = value;
        }
      });
      
      return row;
    });

    // Process the import
    const result = await processImport(rows);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error importing data" },
      { status: 500 }
    );
  }
}

async function processImport(rows: any[]) {
  const errors: { row: number; message: string }[] = [];
  let success = 0;
  
  // Group by client
  const clientsMap = new Map<string, any>();
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +2 because of header and 0-index
    
    try {
      // Validate required fields
      if (!row.client_name) {
        errors.push({ row: rowNumber, message: "Nombre del cliente es requerido" });
        continue;
      }
      
      // Create or get client
      const clientKey = row.client_name.toLowerCase();
      if (!clientsMap.has(clientKey)) {
        clientsMap.set(clientKey, {
          name: row.client_name,
          national_id: row.national_id || null,
          email: row.email || null,
          phone: row.phone || null,
          policies: []
        });
      }
      
      // Add policy if provided
      if (row.policy_number) {
        const client = clientsMap.get(clientKey);
        client.policies.push({
          policy_number: row.policy_number,
          ramo: row.ramo || "GENERAL",
          insurer_id: row.insurer_id,
          start_date: row.start_date || null,
          renewal_date: row.renewal_date || null,
          status: row.status || "ACTIVA"
        });
      }
      
      success++;
    } catch (error) {
      errors.push({ 
        row: rowNumber, 
        message: error instanceof Error ? error.message : "Error procesando fila" 
      });
    }
  }
  
  // Import to database
  const importData = Array.from(clientsMap.values());
  
  if (importData.length > 0) {
    try {
      const { inserted, errors: importErrors } = await importPolicies(importData);
      
      // Add import errors to the errors array
      if (importErrors) {
        errors.push(...importErrors.map((e: any) => ({
          row: 0,
          message: e.message
        })));
      }
      
      return { success: inserted.length, errors };
    } catch (error) {
      errors.push({
        row: 0,
        message: error instanceof Error ? error.message : "Error importando datos"
      });
    }
  }
  
  return { success, errors };
}
