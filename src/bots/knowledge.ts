import { ACTIONS, COPIES_PER_CHARACTER, DECK_SIZE } from '@/engine/constants';
import type { Character, GameView, PlayerId, PlayerView } from '@/engine/types';

export const copiesOf = (c: Character): number => (c === 'ia' ? 1 : COPIES_PER_CHARACTER);

export const me = (v: GameView): PlayerView => v.players.find((p) => p.id === v.viewer)!;
export const player = (v: GameView, id: PlayerId): PlayerView => v.players.find((p) => p.id === id)!;
export const liveCount = (p: PlayerView): number => p.influences.filter((i) => !i.revealed).length;
export const opponents = (v: GameView): PlayerView[] => v.players.filter((p) => !p.eliminated && p.id !== v.viewer);

export function myLive(v: GameView): Character[] {
  return me(v)
    .influences.filter((i) => !i.revealed)
    .map((i) => i.character!);
}

/** Cartas cuja identidade o bot conhece: as dele e as reveladas na mesa. */
function seen(v: GameView): Character[] {
  const out = [...myLive(v)];
  for (const p of v.players) for (const i of p.influences) if (i.revealed && i.character) out.push(i.character);
  return out;
}

export function unseenCopies(v: GameView, c: Character): number {
  return copiesOf(c) - seen(v).filter((x) => x === c).length;
}

/** Probabilidade a priori de `id` ter ao menos uma cópia de `c` (contagem de cartas). */
export function probHolds(v: GameView, id: PlayerId, c: Character): number {
  const k = unseenCopies(v, c);
  if (k <= 0) return 0;
  const n = liveCount(player(v, id));
  const unseenTotal = DECK_SIZE - seen(v).length;
  let pNone = 1;
  for (let i = 0; i < n; i++) pNone *= Math.max(0, unseenTotal - k - i) / (unseenTotal - i);
  return 1 - pNone;
}

export interface Reads {
  /** Alegações não desmentidas de cada jogador desde a última vez que a mão dele mudou. */
  claims: Record<PlayerId, Partial<Record<Character, number>>>;
  /** Quantas vezes cada jogador desafiou alguém. */
  challenges: Record<PlayerId, number>;
  /** Quantas vezes cada jogador foi pego blefando. */
  caught: Record<PlayerId, number>;
  /** Janelas de desafio que já aconteceram (para estimar a agressividade da mesa). */
  claimsMade: number;
}

/** Leitura do log público: é isso que diferencia o bot Difícil. */
export function readLog(v: GameView): Reads {
  const r: Reads = { claims: {}, challenges: {}, caught: {}, claimsMade: 0 };
  for (const p of v.players) {
    r.claims[p.id] = {};
    r.challenges[p.id] = 0;
    r.caught[p.id] = 0;
  }
  const claim = (id: PlayerId, c: Character) => {
    r.claims[id]![c] = (r.claims[id]![c] ?? 0) + 1;
    r.claimsMade++;
  };
  for (const e of v.log) {
    switch (e.type) {
      case 'ACTION_DECLARED':
        if (e.claim) claim(e.actor, e.claim);
        break;
      case 'BLOCK_DECLARED':
        claim(e.blocker, e.character);
        break;
      case 'CHALLENGE_DECLARED':
        r.challenges[e.challenger]!++;
        break;
      case 'CHALLENGE_RESOLVED':
        if (!e.claimHeld) {
          r.caught[e.claimant]!++;
          r.claims[e.claimant]![e.character] = 0;
        }
        break;
      case 'CARD_SWAPPED':
        r.claims[e.playerId]![e.character] = 0;
        break;
      case 'EXCHANGE_COMPLETED':
      case 'IA_REVEALED':
        r.claims[e.playerId] = {};
        break;
      case 'INFLUENCE_LOST':
        // a carta revelada explica (ou não) as alegações antigas
        r.claims[e.playerId]![e.character] = 0;
        break;
    }
  }
  return r;
}

/** Probabilidade ajustada pelo histórico de alegações (bot Difícil). */
export function beliefHolds(v: GameView, reads: Reads, id: PlayerId, c: Character): number {
  const prior = probHolds(v, id, c);
  if (prior === 0) return 0;
  const mine = reads.claims[id] ?? {};
  const consistent = mine[c] ?? 0;
  const distinct = Object.values(mine).filter((n) => (n ?? 0) > 0).length;
  let p = prior;
  // repetir a mesma alegação sem ser desmentido aumenta a crença
  for (let i = 0; i < Math.min(consistent, 3); i++) p += (1 - p) * 0.3;
  // alegar mais personagens do que tem de cartas: alguma é mentira
  const excess = distinct - liveCount(player(v, id));
  if (excess > 0) p *= consistent > 0 ? 0.8 : 0.6;
  // blefador reincidente
  p *= Math.max(0.6, 1 - 0.12 * (reads.caught[id] ?? 0));
  return Math.min(0.97, p);
}

/** Valor de manter cada carta. */
export function cardValue(c: Character, v: GameView): number {
  const duel = opponents(v).length === 1;
  const base: Record<Character, number> = { senior: 5, hacker: duel ? 5.2 : 4.4, ia: 4.2, devops: 3.6, qa: duel ? 3.8 : 3, fullstack: 2.6 };
  return base[c];
}

export function threat(p: PlayerView): number {
  return liveCount(p) * 10 + p.tokens;
}

export const blockersOf = (action: keyof typeof ACTIONS): readonly Character[] => ACTIONS[action].blockedBy;
