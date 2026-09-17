import type { ActivationRow, FactRow } from '../engine/protocol';
import { AgendaPanel } from './AgendaPanel';
import { FactsPanel } from './FactsPanel';

interface Props {
  readonly agenda: readonly ActivationRow[];
  readonly loaded: boolean;
  readonly facts: readonly FactRow[];
  readonly added: ReadonlySet<number>;
  readonly removed: ReadonlySet<number>;
  readonly filter: string;
  readonly onFilter: (value: string) => void;
  readonly onGoToRule: (rule: string) => void;
}

export function InferencePanel(props: Props) {
  return (
    <section className="panels" aria-label="Inferencia">
      <div className="region-head">
        <span>Motor de inferencia</span>
        <span className="region-meta">agenda + memoria</span>
      </div>
      <div className="inference-body">
        <AgendaPanel agenda={[...props.agenda]} loaded={props.loaded} onGoToRule={props.onGoToRule} />
        <FactsPanel
          facts={[...props.facts]}
          added={new Set(props.added)}
          removed={new Set(props.removed)}
          filter={props.filter}
          onFilter={props.onFilter}
        />
      </div>
    </section>
  );
}
