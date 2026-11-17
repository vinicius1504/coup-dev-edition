import type { Card, GameState, Phase, Player, PlayerId } from './types';

export function getPlayer(s: { players: Player[] }, id: PlayerId): Player {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new Error(`Jogador inexistente: ${id}`);
  return p;
}

export function liveCards(p: Player): Card[] {
  return p.influences.filter((i) => !i.revealed).map((i) => i.card);
}

export function alivePlayers(s: GameState): Player[] {
  return s.players.filter((p) => !p.eliminated);
}

/** Jogadores vivos depois de `id`, em ordem de turno, sem incluir `id`. */
export function turnOrderAfter(s: GameState, id: PlayerId): PlayerId[] {
  const n = s.players.length;
  const idx = s.players.findIndex((p) => p.id === id);
  const out: PlayerId[] = [];
  for (let i = 1; i < n; i++) {
    const p = s.players[(idx + i) % n]!;
    if (!p.eliminated) out.push(p.id);
  }
  return out;
}

/** Quem precisa agir agora (null se a partida acabou). */
export function currentActor(s: { phase: Phase; activePlayer: PlayerId }): PlayerId | null {
  const ph = s.phase;
  switch (ph.kind) {
    case 'action':
      return s.activePlayer;
    case 'actionChallenge':
    case 'block':
    case 'blockChallenge':
      return ph.pending[0] ?? null;
    case 'loseInfluence':
    case 'exchange':
      return ph.playerId;
    case 'gameOver':
      return null;
  }
}
