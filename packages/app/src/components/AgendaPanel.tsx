/*
 * La agenda: qué reglas pueden dispararse y en qué orden.
 *
 * La primera fila es la que se disparará al pulsar Paso, y se marca como tal
 * porque es la única información que de verdad cambia lo que vas a hacer
 * después. El resto se mantiene en voz baja.
 */

import type { ActivationRow } from '../engine/protocol';

interface Props {
  agenda: ActivationRow[];
  loaded: boolean;
  onGoToRule: (rule: string) => void;
}

/**
 * ActivationPPForm devuelve algo como "   0      saludar: f-1,f-2". El
 * salience y el nombre ya los tenemos en campos aparte, así que de esa
 * cadena solo nos interesa la lista de hechos que casaron.
 */
function matchedFacts(text: string): string {
  const colon = text.lastIndexOf(': ');
  if (colon === -1) return '';
  return text
    .slice(colon + 2)
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)
    .join(' ');
}

export function AgendaPanel({ agenda, loaded, onGoToRule }: Props) {
  return (
    <div className="panel panel-agenda">
      <div className="panel-head">
        Agenda <span className="panel-count">{agenda.length}</span>
      </div>

      <div className="panel-body">
        {agenda.length === 0 && (
          <p className="empty">
            {loaded
              ? 'Ninguna regla puede dispararse con los hechos actuales.'
              : 'Pulsa Ejecutar para cargar el proyecto.'}
          </p>
        )}

        {agenda.map((activation, i) => (
          <button
            key={`${activation.rule}-${i}`}
            className={`activation${i === 0 ? ' activation-next' : ''}`}
            onClick={() => onGoToRule(activation.rule)}
            title={`Ir a la regla ${activation.rule}`}
          >
            <span className="activation-rule">{activation.rule}</span>
            {activation.salience !== 0 && (
              <span className="activation-salience">salience {activation.salience}</span>
            )}
            <span className="activation-facts">{matchedFacts(activation.text)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
