import type { GameState, PlayerId } from '@/engine/types';
import { CardView } from './CardView';

interface Props {
  state: GameState;
  onAgain: () => void;
  onMenu: () => void;
}

const DIFF = { easy: 'fácil', medium: 'médio', hard: 'difícil' } as const;

export function Result({ state, onAgain, onMenu }: Props) {
  const winner = state.phase.kind === 'gameOver' ? state.phase.winner : null;
  const won = winner === 'p0';
  const stats: Record<PlayerId, { won: number; lost: number; caught: number; blocks: number; outTurn: number | null }> = {};
  for (const p of state.players) stats[p.id] = { won: 0, lost: 0, caught: 0, blocks: 0, outTurn: null };
  for (const e of state.log) {
    if (e.type === 'CHALLENGE_RESOLVED') {
      if (e.claimHeld) stats[e.challenger]!.lost++;
      else {
        stats[e.challenger]!.won++;
        stats[e.claimant]!.caught++;
      }
    } else if (e.type === 'BLOCK_DECLARED') stats[e.blocker]!.blocks++;
    else if (e.type === 'PLAYER_ELIMINATED') stats[e.playerId]!.outTurn = e.turn;
  }
  const order = [...state.players].sort((a, b) => (stats[b.id]!.outTurn ?? Infinity) - (stats[a.id]!.outTurn ?? Infinity));
  const winnerName = state.players.find((p) => p.id === winner)?.name;

  return (
    <main className="result">
      <p className={`result-banner ${won ? 'is-win' : 'is-loss'}`}>{won ? 'BUILD PASSED' : 'BUILD FAILED'}</p>
      <h1 className="title">{won ? 'Você venceu!' : `${winnerName} venceu.`}</h1>
      <p className="tagline">
        {won ? 'Último dev de pé. Pode fazer o deploy.' : 'Você foi eliminado. Culpa do estagiário, claro.'} Partida de {state.turn} turnos.
      </p>
      <div className="table-scroll">
        <table className="rules-table">
          <thead>
            <tr>
              <th>#</th>
              <th>jogador</th>
              <th>cartas</th>
              <th>desafios certos</th>
              <th>desafios errados</th>
              <th>blefes pegos</th>
              <th>bloqueios</th>
              <th>saiu no turno</th>
            </tr>
          </thead>
          <tbody>
            {order.map((p, i) => {
              const s = stats[p.id]!;
              return (
                <tr key={p.id} className={p.id === winner ? 'row-win' : ''}>
                  <td>{i + 1}</td>
                  <td>
                    {p.name}
                    {p.kind === 'bot' ? ` (bot ${DIFF[p.difficulty ?? 'medium']})` : p.name.toLowerCase() !== 'você' ? ' (você)' : ''}
                  </td>
                  <td>
                    <span className="mini-cards">
                      {p.influences.map((inf) => (
                        <CardView key={inf.card.id} character={inf.card.character} dead={inf.revealed} size="sm" />
                      ))}
                    </span>
                  </td>
                  <td>{s.won}</td>
                  <td>{s.lost}</td>
                  <td>{s.caught}</td>
                  <td>{s.blocks}</td>
                  <td>{s.outTurn ?? 'venceu'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-big" onClick={onAgain}>
          jogar de novo
        </button>
        <button type="button" className="btn btn-big" onClick={onMenu}>
          menu
        </button>
      </div>
    </main>
  );
}
