import type { GameState, GameView, Phase, PlayerId } from './types';

/** Estado visto por `viewer`: sem cartas ocultas alheias, sem baralho, sem eventos privados. */
export function toView(state: GameState, viewer: PlayerId): GameView {
  const phase: Phase =
    state.phase.kind === 'exchange' && state.phase.playerId !== viewer ? { ...state.phase, drawn: [] } : state.phase;
  return structuredClone({
    viewer,
    iaMode: state.config.iaMode,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      tokens: p.tokens,
      eliminated: p.eliminated,
      influences: p.influences.map((inf) => ({
        cardId: inf.card.id,
        revealed: inf.revealed,
        ...(inf.revealed || p.id === viewer ? { character: inf.card.character } : {}),
      })),
    })),
    deckCount: state.deck.length,
    turn: state.turn,
    activePlayer: state.activePlayer,
    phase,
    pending: state.pending,
    log: state.log.filter((e) => !e.visibleTo || e.visibleTo.includes(viewer)),
  });
}
