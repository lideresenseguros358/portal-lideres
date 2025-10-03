#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function usage() {
  console.error('Usage: node generate-types-from-schema.js <input-json> <output-ts>');
  process.exit(1);
}

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  usage();
}

function readSchemaDump(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  if (Array.isArray(data)) {
    const first = data[0];
    if (first && typeof first === 'object') {
      if (first.schema_json) {
        return JSON.parse(first.schema_json);
      }
      if (first.public_schema) {
        return { schemas: [{ schema: 'public', tables: JSON.parse(first.public_schema) }] };
      }
    }
  }
  throw new Error('Unsupported schema dump format');
}

const schemaDump = readSchemaDump(path.resolve(inputPath));

function normalizeEnumLabel(label) {
  return label.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeStringLiteral(value) {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
}

function buildEnumMap(schema) {
  const enums = {};
  if (!Array.isArray(schema.enums)) return enums;
  for (const en of schema.enums) {
    if (!en || !en.enum || !Array.isArray(en.labels)) continue;
    enums[en.enum] = en.labels.map((label) => `"${normalizeEnumLabel(label)}"`).join(' | ');
  }
  return enums;
}

const globalEnumMap = {};
for (const schema of schemaDump.schemas || []) {
  globalEnumMap[schema.schema] = buildEnumMap(schema);
}

const basicTypeMap = new Map([
  ['text', 'string'],
  ['varchar', 'string'],
  ['character varying', 'string'],
  ['citext', 'string'],
  ['uuid', 'string'],
  ['int2', 'number'],
  ['smallint', 'number'],
  ['int4', 'number'],
  ['integer', 'number'],
  ['int8', 'string'],
  ['bigint', 'string'],
  ['numeric', 'number'],
  ['double precision', 'number'],
  ['float8', 'number'],
  ['real', 'number'],
  ['float4', 'number'],
  ['bool', 'boolean'],
  ['boolean', 'boolean'],
  ['json', 'Json'],
  ['jsonb', 'Json'],
  ['date', 'string'],
  ['time', 'string'],
  ['timetz', 'string'],
  ['timestamp', 'string'],
  ['timestamp with time zone', 'string'],
  ['timestamp without time zone', 'string'],
  ['timestamptz', 'string'],
  ['interval', 'string'],
  ['bytea', 'Buffer'],
  ['inet', 'string'],
  ['name', 'string'],
  ['bpchar', 'string'],
  ['money', 'string'],
]);

function mapColumnType(schemaName, column) {
  let rawType = column.udt || column.type || '';
  if (typeof rawType !== 'string') rawType = String(rawType || '');
  let isArray = rawType.endsWith('[]');
  if (isArray) {
    rawType = rawType.slice(0, -2);
  }

  const lowered = rawType.toLowerCase();
  let mapped = basicTypeMap.get(lowered);

  if (!mapped) {
    const cleaned = lowered.replace(/^public\./, '').replace(/^pg_catalog\./, '');
    mapped = basicTypeMap.get(cleaned);
    if (mapped) {
      rawType = cleaned;
    }
  }

  if (!mapped) {
    const schemaEnums = globalEnumMap[schemaName] || {};
    if (schemaEnums[rawType]) {
      mapped = `Database['${schemaName}']['Enums']['${rawType}']`;
    }
  }

  if (!mapped) {
    // Maybe the enum lives in public schema while column is schema-qualified
    const bare = rawType.replace(/^public\./, '').replace(/^pg_catalog\./, '');
    for (const [schemaKey, enums] of Object.entries(globalEnumMap)) {
      if (enums[bare]) {
        mapped = `Database['${schemaKey}']['Enums']['${bare}']`;
        break;
      }
    }
  }

  if (!mapped) {
    // Fallback to Json for unknown structured data, else unknown
    mapped = lowered.includes('json') ? 'Json' : 'unknown';
  }

  if (isArray) {
    if (mapped === 'unknown') {
      return 'unknown[]';
    }
    return `${mapped}[]`;
  }

  return mapped;
}

function shouldColumnBeOptional(column) {
  if (!column.not_null) {
    return true;
  }
  if (column.default !== null && column.default !== undefined) {
    return true;
  }
  return false;
}

function buildRelationships(schemaName, table) {
  if (!Array.isArray(table.foreign_keys) || table.foreign_keys.length === 0) {
    return '        Relationships: [];\n';
  }

  const lines = table.foreign_keys.map((fk) => {
    const fkName = fk.name || '';
    const columns = JSON.stringify(fk.columns || []);
    const referencedRelation = fk.ref ? fk.ref.table : '';
    const referencedColumns = fk.ref ? JSON.stringify(fk.ref.columns || []) : '[]';
    const isOneToOne = fk.columns && fk.ref && fk.columns.length === fk.ref.columns.length && fk.columns.length === 1;
    return `        {
          foreignKeyName: "${escapeStringLiteral(fkName)}";
          columns: ${columns};
          isOneToOne: ${isOneToOne ? 'true' : 'false'};
          referencedRelation: "${escapeStringLiteral(referencedRelation)}";
          referencedColumns: ${referencedColumns};
        }`;
  });

  return `        Relationships: [\n${lines.map((line) => line).join(',\n')}\n        ];\n`;
}

function buildTableDefinition(schemaName, table) {
  const rowLines = [];
  const insertLines = [];
  const updateLines = [];

  for (const column of table.columns || []) {
    const tsType = mapColumnType(schemaName, column);
    const insertOptional = shouldColumnBeOptional(column);
    rowLines.push(`          ${column.name}: ${tsType};`);
    insertLines.push(`          ${column.name}${insertOptional ? '?' : ''}: ${tsType};`);
    updateLines.push(`          ${column.name}?: ${tsType};`);
  }

  const relationships = buildRelationships(schemaName, table).trimEnd();

  return `      ${table.table}: {
        Row: {
${rowLines.join('\n')}
        };
        Insert: {
${insertLines.join('\n')}
        };
        Update: {
${updateLines.join('\n')}
        };
${relationships}
      };`;
}

function buildTables(schema) {
  const tables = schema.tables || [];
  if (tables.length === 0) return '    Tables: Record<string, never>;\n';
  return `    Tables: {\n${tables.map((tbl) => buildTableDefinition(schema.schema, tbl)).join('\n')}\n    };\n`;
}

function buildEnums(schema) {
  const enums = globalEnumMap[schema.schema] || {};
  if (Object.keys(enums).length === 0) {
    return '    Enums: Record<string, never>;\n';
  }
  const enumLines = Object.entries(enums)
    .map(([name, union]) => `      ${name}: ${union};`);
  return `    Enums: {
${enumLines.join('\n')}
    };
`;
}

function buildSchemaDefinition(schema) {
  const tablesBlock = buildTables(schema).trimEnd();
  const enumsBlock = buildEnums(schema).trimEnd();

  return `  ${schema.schema}: {
${tablesBlock}
    Views: Record<string, never>;
    Functions: Record<string, never>;
${enumsBlock}
    CompositeTypes: Record<string, never>;
  };`;
}

const schemaBlocks = (schemaDump.schemas || [])
  .filter((schema) => schema && schema.schema)
  .map((schema) => buildSchemaDefinition(schema));

const output = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
${schemaBlocks.join('\n')}
};

export type DB = Database['public'];
export type Tables<T extends keyof DB['Tables']> = DB['Tables'][T]['Row'];
export type TablesInsert<T extends keyof DB['Tables']> = DB['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof DB['Tables']> = DB['Tables'][T]['Update'];
export type Enums<T extends keyof DB['Enums']> = DB['Enums'][T];
`;

fs.writeFileSync(path.resolve(outputPath), output + '\n');
