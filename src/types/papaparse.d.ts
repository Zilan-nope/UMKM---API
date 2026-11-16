declare module 'papaparse' {
  export interface ParseError {
    type: string;
    code: string;
    message: string;
    row?: number;
  }

  export interface ParseMeta {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    cursor: number;
    fields?: string[];
  }

  export interface ParseResult<T = Record<string, unknown>> {
    data: T[];
    errors: ParseError[];
    meta: ParseMeta;
  }

  export interface ParseConfig<T = Record<string, unknown>> {
    header?: boolean;
    skipEmptyLines?: boolean | 'greedy';
    dynamicTyping?: boolean;
    delimiter?: string;
    encoding?: string;
    complete?: (results: ParseResult<T>) => void;
    error?: (error: Error) => void;
  }

  interface PapaStatic {
    parse<T = Record<string, unknown>>(input: string, config?: ParseConfig<T>): ParseResult<T>;
  }

  const Papa: PapaStatic;
  export default Papa;
}