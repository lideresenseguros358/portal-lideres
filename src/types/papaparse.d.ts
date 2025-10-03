declare module 'papaparse' {
  export interface ParseMeta {
    delimiter?: string;
    linebreak?: string;
    aborted?: boolean;
    truncated?: boolean;
    cursor?: number;
  }

  export interface ParseError {
    type: string;
    code: string;
    message: string;
    row?: number;
  }

  export type Greedy = 'greedy';

  export interface ParseConfig<T=any> {
    header?: boolean;
    skipEmptyLines?: boolean | Greedy;
    delimiter?: string;
    newline?: string;
    dynamicTyping?: boolean | ((field: string | number) => boolean);
    preview?: number;
    encoding?: string;
    worker?: boolean;
    comments?: string | boolean;
    transform?: (value: string, field?: string | number) => string;
    transformHeader?: (header: string) => string;
    complete?: (results: ParseResult<T>) => void;
    error?: (error: ParseError) => void;
  }

  export interface ParseResult<T=any> {
    data: T[];
    errors: ParseError[];
    meta: ParseMeta;
  }

  export function parse<T=any>(
    input: string | File | Blob | ArrayBuffer | Uint8Array,
    config?: ParseConfig<T>
  ): ParseResult<T>;
}
