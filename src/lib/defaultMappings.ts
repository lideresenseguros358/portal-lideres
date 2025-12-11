import type { MappingRule } from "./types/importing";

export const DEFAULT_MAPPINGS: { insurerName: string; rules: Partial<MappingRule>[] }[] = [
  {
    insurerName: "ACERTA",
    rules: [
      {
        strategy: "mixed_token",
        target_field: "policy",
        aliases: [
          "Poliza",
          "Póliza",
          "policy",
          "No Poliza",
          "No. Poliza",
        ],
      },
      {
        strategy: "aliases",
        target_field: "insured",
        aliases: [
          "Cliente",
          "Asegurado",
          "Nombre Asegurado",
          "Nombre del Asegurado",
        ],
      },
      { strategy: "penultimate", target_field: "commission" },
    ],
  },
  {
    insurerName: "ASSA",
    rules: [
      {
        strategy: "aliases",
        target_field: "policy",
        aliases: ["Poliza", "Póliza", "policy", "No. póliza"],
      },
      { strategy: "aliases",
        target_field: "insured",
        aliases: ["Asegurado", "Nombre Asegurado"] },
      {
        strategy: "first_nonzero",
        target_field: "commission",
        // groups are now stored in the options object
        // options: { groups: [ ... ] }
        aliases: [],
      },
    ],
  },
  {
    insurerName: "PALIG",
    rules: [
      {
        strategy: "aliases",
        target_field: "policy",
        aliases: ["Poliza/Cert", "Póliza/Cert", "Poliza", "Póliza"],
      },
      { strategy: "aliases",
        target_field: "insured",
        aliases: ["Referencia"] },
      { strategy: "aliases",
        target_field: "commission",
        aliases: ["Total"] },
    ],
  },
  {
    insurerName: "INTERNACIONAL",
    rules: [
      {
        strategy: "aliases",
        target_field: "policy",
        aliases: ["Póliza", "Poliza", "Policy Number", "No. Póliza"],
      },
      {
        strategy: "aliases",
        target_field: "insured",
        aliases: ["Asegurado / Banco", "Asegurado", "Client Name", "Nombre"],
      },
      {
        strategy: "aliases",
        target_field: "commission",
        aliases: ["Total", "Comisión Detallada", "Comisión"],
      },
    ],
  },
  {
    insurerName: "ANCON",
    rules: [
      {
        strategy: "aliases",
        target_field: "policy",
        aliases: ["Póliza", "Poliza", "Policy Number", "No. Póliza"],
      },
      {
        strategy: "aliases",
        target_field: "insured",
        aliases: ["Asegurado", "Client Name", "Nombre"],
      },
      {
        strategy: "aliases",
        target_field: "commission",
        aliases: ["Comisión", "Comision", "Total"],
      },
    ],
  },
  {
    insurerName: "SURA",
    rules: [
      {
        strategy: "aliases",
        target_field: "policy",
        aliases: ["Póliza", "Poliza", "Policy", "No. Póliza"],
      },
      {
        strategy: "aliases",
        target_field: "insured",
        aliases: ["Asegurado", "Nombre", "Cliente"],
      },
      {
        strategy: "aliases",
        target_field: "commission",
        aliases: ["Comisión", "Comision", "Honorario"],
      },
    ],
  },
  {
    insurerName: "BANESCO",
    rules: [
      {
        strategy: "aliases",
        target_field: "policy",
        aliases: ["Póliza", "Poliza", "No. de Póliza", "No Póliza"],
      },
      {
        strategy: "aliases",
        target_field: "insured",
        aliases: ["Asegurado", "Nombre Asegurado", "Cliente"],
      },
      {
        strategy: "aliases",
        target_field: "commission",
        aliases: ["Comisión", "Comision", "Comisión Generada"],
      },
    ],
  },
  // TODO: add the remaining insurers (FEDPA, GENERAL, IFS,
  // REGIONAL, MAPFRE, MB, OPTIMA, VIVIR, WWMEDICAL, MERCANTIL, ALIADO, ASSISTCARD)
];
