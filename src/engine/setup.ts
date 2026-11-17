import {
  BASE_CHARACTERS,
  COPIES_PER_CHARACTER,
  FIRST_PLAYER_TOKENS_2P,
  FORCED_DEPLOY_AT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  STARTING_INFLUENCES,
  STARTING_TOKENS,
} from './constants';
import { nextRandom } from './rng';
import type { Card, Character, GameConfig, GameEvent, GameEventData, GameState, Player } from './types';

export function createGame(config: GameConfig): GameState {
  const n = config.players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) {
    throw new Error(`Número de jogadores inválido: ${n} (permitido: ${MIN_PLAYERS} a ${MAX_PLAYERS})`);
  }
  const first = config.firstPlayer ?? 0;
  if (!Number.isInteger(first) || first < 0 || first >= n) throw new Error('firstPlayer inválido');

  const chars: Character[] = [];
  for (const c of BASE_CHARACTERS) for (let i = 0; i < COPIES_PER_CHARACTER; i++) chars.push(c);
  chars.push('ia');

  let rng = config.seed | 0;
  for (let i = chars.length - 1; i > 0; i--) {
    const [v, ns] = nextRandom(rng);
    rng = ns;
    const j = Math.floor(v * (i + 1));
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  // ids atribuídos depois de embaralhar: o id não revela o personagem
  const deck: Card[] = chars.map((character, i) => ({ id: `c${i}`, character, promptUses: 0 }));

  const players: Player[] = config.players.map((setup, i) => ({
    id: `p${i}`,
    name: setup.name,
    kind: setup.kind,
    ...(setup.kind === 'bot' ? { difficulty: setup.difficulty ?? 'medium' } : {}),
    tokens: n === 2 && i === first ? FIRST_PLAYER_TOKENS_2P : STARTING_TOKENS,
    influences: [],
    eliminated: false,
  }));
  for (let k = 0; k < STARTING_INFLUENCES; k++) {
    for (const p of players) p.influences.push({ card: deck.shift()!, revealed: false });
  }

  const active = players[first]!;
  const log: GameEvent[] = [];
  const emit = (data: GameEventData) => log.push({ ...data, seq: log.length, turn: 1 });
  emit({ type: 'GAME_STARTED', playerIds: players.map((p) => p.id), iaMode: config.iaMode });
  emit({ type: 'TURN_STARTED', playerId: active.id, turn: 1, mustDeploy: active.tokens >= FORCED_DEPLOY_AT });

  return {
    config,
    players,
    deck,
    turn: 1,
    activePlayer: active.id,
    phase: { kind: 'action' },
    pending: null,
    rng,
    nextCardId: deck.length + n * STARTING_INFLUENCES,
    nextEventSeq: log.length,
    log,
  };
}
