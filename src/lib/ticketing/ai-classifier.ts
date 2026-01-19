/**
 * AI EMAIL CLASSIFIER
 * 
 * Este módulo está preparado para integración futura con OpenAI
 * para clasificación automática de emails sin clasificar.
 * 
 * TODO: Implementar clasificación con IA
 */

export interface ClassificationResult {
  ramo_code: string | null;
  aseguradora_code: string | null;
  tramite_code: string | null;
  confidence: number; // 0.0 - 1.0
  reasoning?: string;
  suggested_broker_email?: string | null;
}

/**
 * Clasifica un email usando IA
 * 
 * @param emailContent - Contenido del email (subject + body)
 * @param fromEmail - Email del remitente
 * @param fromName - Nombre del remitente
 * @returns Clasificación sugerida con nivel de confianza
 */
export async function classifyEmailWithAI(
  emailContent: string,
  fromEmail: string,
  fromName?: string | null
): Promise<ClassificationResult> {
  
  // TODO: Implementar con OpenAI
  // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // const prompt = `
  //   Clasifica el siguiente email de seguro en categorías específicas:
  //   
  //   De: ${fromName || fromEmail}
  //   Contenido: ${emailContent}
  //   
  //   Debes determinar:
  //   1. Ramo (código 01-99): 01=Autos, 02=Incendio, 03=Vida, etc.
  //   2. Aseguradora (código 01-99): 01=ASSA, 02=SURA, 03=ANCON, etc.
  //   3. Tipo de trámite (código 1-99): 1=Emisión, 2=Renovación, 3=Siniestro, etc.
  //   
  //   Responde en JSON con: { ramo_code, aseguradora_code, tramite_code, confidence, reasoning }
  // `;
  
  // const completion = await openai.chat.completions.create({
  //   model: "gpt-4",
  //   messages: [{ role: "user", content: prompt }],
  //   response_format: { type: "json_object" },
  //   temperature: 0.3,
  // });
  
  // const result = JSON.parse(completion.choices[0].message.content);
  // return result;

  // Placeholder: Retornar clasificación con baja confianza
  console.log('[AI-CLASSIFIER] Placeholder called for:', {
    from: fromEmail,
    contentLength: emailContent.length,
  });

  return {
    ramo_code: null,
    aseguradora_code: null,
    tramite_code: null,
    confidence: 0.0,
    reasoning: 'AI classification not yet implemented',
  };
}

/**
 * Determina si la confianza es suficiente para auto-asignación
 */
export function isHighConfidence(confidence: number): boolean {
  return confidence >= 0.85;
}

/**
 * Entrena el clasificador con feedback (futuro)
 */
export async function trainClassifier(
  emailContent: string,
  correctClassification: {
    ramo_code: string;
    aseguradora_code: string;
    tramite_code: string;
  }
): Promise<void> {
  // TODO: Implementar fine-tuning o feedback loop
  console.log('[AI-CLASSIFIER] Training feedback received (not implemented)');
}

/**
 * Sugiere broker basado en contenido del email
 */
export async function suggestBrokerFromEmail(
  emailContent: string,
  ccEmails: string[]
): Promise<string | null> {
  // TODO: Implementar lógica de detección
  // 1. Buscar emails conocidos en CC
  // 2. Buscar nombres de brokers en el texto
  // 3. Usar IA para sugerir

  console.log('[AI-CLASSIFIER] Broker suggestion (not implemented)');
  return null;
}

/**
 * Extrae número de póliza del email
 */
export function extractPolicyNumber(emailContent: string): string | null {
  // Patrones comunes de números de póliza
  const patterns = [
    /póliza\s*[nN°#:]\s*([A-Z0-9-]+)/i,
    /policy\s*[nN°#:]\s*([A-Z0-9-]+)/i,
    /[pP]ol\.\s*([A-Z0-9-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = emailContent.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extrae cédula/RUC del email
 */
export function extractNationalId(emailContent: string): string | null {
  // Patrones para cédula o RUC panameño
  const patterns = [
    /cédula\s*[nN°#:]\s*([0-9-]+)/i,
    /cedula\s*[nN°#:]\s*([0-9-]+)/i,
    /RUC\s*[nN°#:]\s*([0-9-]+)/i,
    /\b([0-9]{1,2}-[0-9]{1,4}-[0-9]{1,6})\b/, // Formato: 8-123-456
  ];

  for (const pattern of patterns) {
    const match = emailContent.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}
