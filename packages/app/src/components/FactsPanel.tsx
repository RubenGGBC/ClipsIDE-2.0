/*
 * La memoria de trabajo como tabla.
 *
 * Leer la salida de (facts) es leer un párrafo; aquí los hechos se agrupan
 * por template y cada slot es una columna, así que comparar dos hechos es
 * mirar hacia abajo en vez de leer dos líneas enteras. Los hechos ordenados
 * —los que no tienen template— no tienen columnas que enseñar, así que se
 * quedan como texto en su propio grupo.
 */

import { useMemo } from 'react';
import type { FactRow } from '../engine/protocol';

interface Props {
  facts: FactRow[];
  /** Índices añadidos por el último paso. */
  added: Set<number>;
  /** Hechos retractados por el último paso, que seguimos mostrando. */
  removed: Set<number>;
  filter: string;
  onFilter: (value: string) => void;
}

interface Group {
  template: string;
  columns: string[];
  rows: FactRow[];
}

function groupByTemplate(facts: FactRow[]): Group[] {
  const groups = new Map<string, Group>();

  for (const fact of facts) {
    let group = groups.get(fact.template);
    if (!group) {
      group = { template: fact.template, columns: [], rows: [] };
      groups.set(fact.template, group);
    }
    group.rows.push(fact);

    // Las columnas son la unión de los slots vistos: un hecho puede traer
    // menos slots que otro del mismo template si alguno quedó por defecto.
    for (const slot of Object.keys(fact.slots ?? {})) {
      if (!group.columns.includes(slot)) group.columns.push(slot);
    }
  }

  return [...groups.values()].sort((a, b) => a.template.localeCompare(b.template));
}

export function FactsPanel({ facts, added, removed, filter, onFilter }: Props) {
  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const visible = needle
      ? facts.filter(
          (f) =>
            f.template.toLowerCase().includes(needle) ||
            f.text.toLowerCase().includes(needle),
        )
      : facts;
    return groupByTemplate(visible);
  }, [facts, filter]);

  const live = facts.filter((f) => !removed.has(f.index)).length;

  return (
    <div className="panel panel-facts">
      <div className="panel-head">
        Hechos <span className="panel-count">{live}</span>
      </div>

      <input
        className="filter"
        placeholder="filtrar por template o contenido"
        value={filter}
        onChange={(e) => onFilter(e.target.value)}
        spellCheck={false}
      />

      <div className="panel-body">
        {groups.length === 0 && (
          <p className="empty">
            {filter ? 'Ningún hecho coincide con el filtro.' : 'La memoria de trabajo está vacía.'}
          </p>
        )}

        {groups.map((group) => (
          <div className="fact-group" key={group.template}>
            <div className="fact-group-head">
              <span className="fact-group-name">{group.template}</span>
              <span className="fact-group-count">{group.rows.length}</span>
            </div>

            <table className="fact-table">
              {group.columns.length > 0 && (
                <thead>
                  <tr>
                    <th className="col-index" />
                    {group.columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {group.rows.map((fact) => {
                  const gone = removed.has(fact.index);
                  const isNew = added.has(fact.index);
                  return (
                    <tr
                      key={fact.index}
                      className={`${isNew ? 'fact-new just-fired' : ''}${gone ? ' fact-gone' : ''}`}
                      title={fact.text}
                    >
                      <td className="col-index">
                        {/* El signo y el texto oculto cumplen la regla del
                            DESIGN.md: el estado nunca se dice solo con color. */}
                        <span className="fact-mark" aria-hidden="true">
                          {isNew ? '+' : gone ? '\u2212' : ''}
                        </span>
                        f-{fact.index}
                        {isNew && <span className="sr-only"> (nuevo)</span>}
                        {gone && <span className="sr-only"> (retractado)</span>}
                      </td>
                      {group.columns.length > 0 ? (
                        group.columns.map((c) => (
                          <td key={c}>{fact.slots?.[c] ?? <span className="col-unset">·</span>}</td>
                        ))
                      ) : (
                        <td>{fact.text}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
