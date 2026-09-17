/*
 * Índice de símbolos del proyecto.
 *
 * Es la materia prima del autocompletado, de ir-a-definición y del esquema
 * lateral. Se reconstruye al vuelo mientras escribes, así que tiene que ser
 * barato y, sobre todo, no romperse con código a medio escribir: mientras
 * tecleas, el fichero casi nunca es CLIPS válido.
 */

export interface SlotInfo {
  name: string;
  multi: boolean;
}

export interface TemplateSymbol {
  kind: 'deftemplate';
  name: string;
  slots: SlotInfo[];
  file: string;
  line: number;
}

export interface RuleSymbol {
  kind: 'defrule';
  name: string;
  /** Variables ligadas en el LHS: lo que ofrecemos al escribir "?". */
  variables: string[];
  file: string;
  line: number;
}

export interface FunctionSymbol {
  kind: 'deffunction';
  name: string;
  params: string[];
  file: string;
  line: number;
}

export type ClipsSymbol = TemplateSymbol | RuleSymbol | FunctionSymbol;

export interface SymbolIndex {
  templates: Map<string, TemplateSymbol>;
  rules: Map<string, RuleSymbol>;
  functions: Map<string, FunctionSymbol>;
  globals: Set<string>;
  all: ClipsSymbol[];
}

/** Una forma de nivel superior: (deftemplate ...), (defrule ...), etc. */
export interface Form {
  head: string;
  name: string;
  start: number;
  end: number;
  body: string;
}


/**
 * Recorre el texto contando paréntesis, saltándose comentarios y cadenas,
 * y devuelve las formas de nivel superior. Un escáner de verdad y no una
 * expresión regular porque las expresiones regulares no saben contar
 * paréntesis, y CLIPS es casi todo paréntesis.
 */
export function parseForms(text: string): Form[] {
  const forms: Form[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (c === ';') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }

    if (c === '"') {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') i++;
        i++;
      }
      continue;
    }

    if (c === '(') {
      if (depth === 0) start = i;
      depth++;
      continue;
    }

    if (c === ')') {
      depth--;
      // Un paréntesis de más en un fichero a medio escribir no debe
      // descolocar todo lo que venga después.
      if (depth < 0) depth = 0;
      if (depth === 0 && start >= 0) {
        const body = text.slice(start, i + 1);
        const [head, name] = readHead(body);
        forms.push({ head, name, start, end: i + 1, body });
        start = -1;
      }
    }
  }

  // La última forma puede estar sin cerrar porque la estás escribiendo ahora.
  if (depth > 0 && start >= 0) {
    const body = text.slice(start);
    const [head, name] = readHead(body);
    forms.push({ head, name, start, end: text.length, body });
  }

  return forms;
}

/** Extrae los dos primeros símbolos de "(deftemplate persona ...)". */
function readHead(body: string): [string, string] {
  const words = body
    .slice(1)
    .split(/[\s()]+/)
    .filter((w) => w.length > 0);
  return [words[0] ?? '', words[1] ?? ''];
}

function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

function extractSlots(body: string): SlotInfo[] {
  const slots: SlotInfo[] = [];
  const re = /\((multislot|slot)\s+([^\s()]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    slots.push({ name: m[2], multi: m[1] === 'multislot' });
  }
  return slots;
}

function extractVariables(body: string): string[] {
  // Solo el LHS: las variables del RHS ya están ligadas o son nuevas.
  const lhs = body.split('=>')[0];
  const found = new Set<string>();
  const re = /\?([A-Za-z][\w-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lhs)) !== null) found.add(m[1]);
  return [...found];
}

function extractParams(body: string): string[] {
  const m = body.match(/\(deffunction\s+[^\s()]+\s*\(([^)]*)\)/);
  if (!m) return [];
  return m[1].split(/\s+/).filter((p) => p.startsWith('?')).map((p) => p.slice(1));
}

export function emptyIndex(): SymbolIndex {
  return {
    templates: new Map(),
    rules: new Map(),
    functions: new Map(),
    globals: new Set(),
    all: [],
  };
}

/** Construye el índice a partir de todos los ficheros del proyecto. */
export function buildIndex(files: { name: string; text: string }[]): SymbolIndex {
  const index = emptyIndex();

  for (const file of files) {
    for (const form of parseForms(file.text)) {
      const line = lineAt(file.text, form.start);

      switch (form.head) {
        case 'deftemplate': {
          const symbol: TemplateSymbol = {
            kind: 'deftemplate',
            name: form.name,
            slots: extractSlots(form.body),
            file: file.name,
            line,
          };
          index.templates.set(symbol.name, symbol);
          index.all.push(symbol);
          break;
        }

        case 'defrule': {
          const symbol: RuleSymbol = {
            kind: 'defrule',
            name: form.name,
            variables: extractVariables(form.body),
            file: file.name,
            line,
          };
          index.rules.set(symbol.name, symbol);
          index.all.push(symbol);
          break;
        }

        case 'deffunction': {
          const symbol: FunctionSymbol = {
            kind: 'deffunction',
            name: form.name,
            params: extractParams(form.body),
            file: file.name,
            line,
          };
          index.functions.set(symbol.name, symbol);
          index.all.push(symbol);
          break;
        }

        case 'defglobal': {
          const re = /\?\*([^\s*]+)\*/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(form.body)) !== null) index.globals.add(m[1]);
          break;
        }
      }
    }
  }

  return index;
}

/** La regla que contiene una posición, para saber qué variables ofrecer. */
export function ruleAt(text: string, pos: number): { variables: string[] } | null {
  for (const form of parseForms(text)) {
    if (form.head === 'defrule' && pos >= form.start && pos <= form.end) {
      return { variables: extractVariables(form.body.slice(0, pos - form.start)) };
    }
  }
  return null;
}
