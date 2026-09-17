/*
 * El contrato entre la UI y el motor CLIPS. Es la única forma en que las dos
 * mitades se hablan, y está escrito para que ninguna de las dos necesite
 * saber nada de la otra: la UI no sabe que hay WASM, el worker no sabe que
 * hay React.
 */

export interface ClipsFile {
  name: string;
  text: string;
}

export interface FactRow {
  index: number;
  template: string;
  text: string;
  /** Valor de cada slot, ya formateado. Vacío en los hechos ordenados,
   *  que no tienen slots con nombre y solo se pueden mostrar como texto. */
  slots: Record<string, string>;
}

export interface ActivationRow {
  rule: string;
  salience: number;
  text: string;
}

export interface TemplateInfo {
  name: string;
  slots: string[];
}

/** Resultado propio de CLIPS. No se mezcla con Response.ok, que indica si el
 * worker pudo atender la petición y conservar su correlación. */
export type OperationResult =
  | { readonly type: 'none' }
  | { readonly type: 'load'; readonly ok: boolean }
  | { readonly type: 'eval'; readonly ok: boolean };

/** Estado completo del motor tras una operación. Devolvemos todo en cada
 *  respuesta a propósito: a escala de prácticas cuesta microsegundos y evita
 *  que la UI tenga que orquestar varias llamadas para pintarse. */
export interface Snapshot {
  output: string;
  facts: FactRow[];
  agenda: ActivationRow[];
  templates: TemplateInfo[];
  operation: OperationResult;
  /** Reglas disparadas por la última ejecución, si la hubo. */
  fired?: number;
}

/** La petición sin el identificador de correlación, que pone el cliente. Va
 *  aparte porque Omit<> sobre una unión la aplasta y pierde las variantes. */
export type RequestBody =
  /** clear + load de todos los ficheros + reset: el ciclo entero en un paso. */
  | { type: 'load'; files: ClipsFile[] }
  | { type: 'reset' }
  /** limit = -1 hasta agotar la agenda, 1 para el paso a paso. */
  | { type: 'run'; limit: number }
  | { type: 'eval'; command: string }
  | { type: 'snapshot' };

export type Request = RequestBody & { id: number };

export type Response =
  | { id: number; ok: true; snapshot: Snapshot }
  | { id: number; ok: false; error: string };
