import type { GameView, PlayerId } from '@/engine/types';
import { CardView } from './CardView';

interface Props {
  view: GameView;
  thinking: PlayerId | null;
  bubbles: Record<PlayerId, { text: string; key: number } | undefined>;
  shaking: Record<PlayerId, number | undefined>;
  /** Alvos clicáveis (quando o humano está escolhendo um alvo). */
  targets: PlayerId[];
  onTarget: (id: PlayerId) => void;
}

export function Table({ view, thinking, bubbles, shaking, targets, onTarget }: Props) {
  const n = view.players.length;
  const meIdx = view.players.findIndex((p) => p.id === view.viewer);
  const responding = 'pending' in view.phase ? view.phase.pending[0] : 'playerId' in view.phase ? view.phase.playerId : null;

  return (
    <div className={`table table-n${n}`}>
      <div className="table-center">
        <div className="pile" aria-label={`Baralho: ${view.deckCount} cartas`}>
          <CardView size="sm" />
          <span className="pile-count">×{view.deckCount}</span>
        </div>
        <div className="treasury" data-anchor="treasury" aria-label="Tesouro de tokens">
          <span className="coin" />
          <span>tesouro ∞</span>
        </div>
      </div>
      {view.players.map((p, i) => {
        const offset = (i - meIdx + n) % n;
        const angle = Math.PI / 2 + (2 * Math.PI * offset) / n;
        const isMe = p.id === view.viewer;
        const active = view.activePlayer === p.id && view.phase.kind !== 'gameOver';
        const bubble = bubbles[p.id];
        const targetable = targets.includes(p.id);
        const cls = [
          'seat',
          isMe ? 'seat-me' : '',
          active ? 'is-active' : '',
          p.eliminated ? 'is-out' : '',
          targetable ? 'is-target' : '',
          responding === p.id && !active ? 'is-responding' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const body = (
          <>
            {bubble && (
              <span className="bubble" key={bubble.key}>
                {bubble.text}
              </span>
            )}
            <span className="seat-head">
              <span className="seat-name">
                {active ? '▶ ' : ''}
                {p.name}
                {isMe && p.name.toLowerCase() !== 'você' ? ' (você)' : ''}
              </span>
              <span className="seat-tokens" data-anchor={p.id} aria-label={`${p.tokens} tokens`}>
                <span className="coin" />
                {p.tokens}
              </span>
            </span>
            <span className="seat-cards">
              {p.influences.map((inf) => (
                <CardView key={inf.cardId} character={inf.character} dead={inf.revealed} size={isMe ? 'md' : 'sm'} />
              ))}
            </span>
            <span className="seat-status">
              {p.eliminated ? 'eliminado' : thinking === p.id ? <span className="thinking">pensando</span> : targetable ? 'clique para mirar' : ' '}
            </span>
          </>
        );
        const style = { left: `${50 + 41 * Math.cos(angle)}%`, top: `${50 + 34 * Math.sin(angle)}%` };
        return (
          <div className="seat-pos" style={style} key={p.id}>
            <div className={shaking[p.id] ? 'shake' : ''} key={shaking[p.id] ?? 0}>
              {targetable ? (
                <button type="button" className={cls} onClick={() => onTarget(p.id)}>
                  {body}
                </button>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
