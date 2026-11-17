import { createGame, reduce } from '..';
import type { Character, Command, GameEvent, GameState, IaMode } from '..';

let cardSeq = 1000;
const card = (character: Character) => ({ id: `t${cardSeq++}`, character, promptUses: 0 });

export interface Rig {
  n?: number;
  iaMode?: IaMode;
  /** Mãos por jogador, na ordem (p0, p1, ...). */
  hands: Character[][];
  tokens?: number[];
  deck?: Character[];
}

/** Cria uma partida com mãos, tokens e baralho controlados. */
export function rig({ n, iaMode = 'balanced', hands, tokens, deck }: Rig): GameState {
  const count = n ?? hands.length;
  const s = createGame({
    players: Array.from({ length: count }, (_, i) => ({ name: `P${i}`, kind: 'human' as const })),
    iaMode,
    seed: 42,
  });
  s.players.forEach((p, i) => {
    p.influences = (hands[i] ?? ['qa', 'qa']).map((c) => ({ card: card(c), revealed: false }));
    p.tokens = tokens?.[i] ?? 2;
  });
  s.deck = (deck ?? ['senior', 'hacker', 'qa', 'devops', 'fullstack']).map(card);
  return s;
}

export class Game {
  events: GameEvent[] = [];
  constructor(public s: GameState) {}

  do(cmd: Command): this {
    const r = reduce(this.s, cmd);
    if (!r.ok) throw new Error(`${r.error}: ${r.message}`);
    this.s = r.state;
    this.events.push(...r.events);
    return this;
  }

  err(cmd: Command): string {
    const r = reduce(this.s, cmd);
    return r.ok ? 'ok' : r.error;
  }

  /** Todos os que faltam responder passam. */
  allPass(): this {
    const kind = this.s.phase.kind;
    while (this.s.phase.kind === kind && 'pending' in this.s.phase && this.s.phase.pending.length > 0) {
      this.do({ type: 'PASS', playerId: this.s.phase.pending[0]! });
    }
    return this;
  }

  /** Passam até chegar a vez de `id` responder. */
  passUntil(id: string): this {
    while ('pending' in this.s.phase && this.s.phase.pending[0] !== id) {
      this.do({ type: 'PASS', playerId: this.s.phase.pending[0]! });
    }
    return this;
  }

  p(i: number) {
    return this.s.players[i]!;
  }
  live(i: number): Character[] {
    return this.p(i).influences.filter((x) => !x.revealed).map((x) => x.card.character);
  }
  cardId(i: number, c: Character): string {
    return this.p(i).influences.find((x) => !x.revealed && x.card.character === c)!.card.id;
  }
  has(type: GameEvent['type']): boolean {
    return this.events.some((e) => e.type === type);
  }
}
