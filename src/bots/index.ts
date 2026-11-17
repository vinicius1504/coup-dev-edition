import { ACTIONS } from '@/engine/constants';
import { legalCommands } from '@/engine/legal';
import type { BotDifficulty, Character, Command, GameView, PlayerId } from '@/engine/types';
import { beliefHolds, cardValue, liveCount, me, myLive, opponents, player, probHolds, readLog, threat, unseenCopies } from './knowledge';
import type { Reads } from './knowledge';

export type Rand = () => number;
type ActionCmd = Extract<Command, { type: 'ACTION' }>;

/**
 * Decide o próximo comando do bot `view.viewer`. Função pura: recebe só a visão
 * do jogador (sem cartas alheias) e uma fonte de aleatoriedade.
 */
export function decide(view: GameView, difficulty: BotDifficulty, rand: Rand): Command {
  const legal = legalCommands(view);
  if (legal.length === 0) throw new Error('Não é a vez deste bot');
  if (legal.length === 1) return legal[0]!;
  const cmd = difficulty === 'easy' ? easy(view, legal, rand) : smart(view, legal, rand, difficulty === 'hard');
  return cmd;
}

/** Tempo de "pensando..." simulado, em ms (0,5 a 1,5s). */
export function thinkingTime(rand: Rand): number {
  return 500 + Math.floor(rand() * 1000);
}

const pick = <T>(xs: T[], rand: Rand): T => xs[Math.floor(rand() * xs.length)]!;

function truthful(view: GameView, cmd: ActionCmd): boolean {
  const claim: Character | null = cmd.viaPrompt ? 'ia' : ACTIONS[cmd.action].character;
  return claim === null || myLive(view).includes(claim);
}

// ───────────── Fácil: acaso com regras simples ─────────────

function easy(view: GameView, legal: Command[], rand: Rand): Command {
  const ph = view.phase;
  const hand = myLive(view);
  switch (ph.kind) {
    case 'action': {
      const actions = legal as ActionCmd[];
      const deploys = actions.filter((c) => c.action === 'deploy');
      if (deploys.length > 0 && (actions.length === deploys.length || rand() < 0.6)) return pick(deploys, rand);
      const honest = actions.filter((c) => truthful(view, c) && c.action !== 'deploy');
      const bluffs = actions.filter((c) => !truthful(view, c) && !c.viaPrompt);
      return rand() < 0.15 && bluffs.length > 0 ? pick(bluffs, rand) : pick(honest, rand);
    }
    case 'actionChallenge':
    case 'blockChallenge':
      return rand() < 0.08 ? legal.find((c) => c.type === 'CHALLENGE')! : legal.find((c) => c.type === 'PASS')!;
    case 'block': {
      const blocks = legal.filter((c): c is Extract<Command, { type: 'BLOCK' }> => c.type === 'BLOCK');
      const real = blocks.filter((c) => hand.includes(c.character));
      if (real.length > 0) return real[0]!;
      const nonIa = blocks.filter((c) => c.character !== 'ia');
      return rand() < 0.12 ? pick(nonIa, rand) : legal.find((c) => c.type === 'PASS')!;
    }
    default:
      return pick(legal, rand);
  }
}

// ───────────── Médio e Difícil ─────────────

function smart(view: GameView, legal: Command[], rand: Rand, hard: boolean): Command {
  const reads = hard ? readLog(view) : null;
  const holds = (id: PlayerId, c: Character) => (reads ? beliefHolds(view, reads, id, c) : probHolds(view, id, c));
  switch (view.phase.kind) {
    case 'action':
      return chooseAction(view, legal as ActionCmd[], rand, reads, holds);
    case 'actionChallenge':
    case 'blockChallenge':
      return chooseChallenge(view, legal, rand, hard, holds);
    case 'block':
      return chooseBlock(view, legal, rand, hard, reads);
    case 'loseInfluence': {
      const mine = me(view).influences.filter((i) => !i.revealed);
      const worst = [...mine].sort((a, b) => cardValue(a.character!, view) - cardValue(b.character!, view))[0]!;
      return legal.find((c) => c.type === 'LOSE_INFLUENCE' && c.cardId === worst.cardId)!;
    }
    case 'exchange': {
      const ph = view.phase;
      const chars = new Map<string, Character>();
      for (const i of me(view).influences) if (!i.revealed) chars.set(i.cardId, i.character!);
      for (const c of ph.drawn) chars.set(c.id, c.character);
      const score = (keep: string[]) => {
        const cs = keep.map((id) => chars.get(id)!);
        const dup = new Set(cs).size < cs.length ? (hard ? 2.5 : 1) : 0;
        return cs.reduce((a, c) => a + cardValue(c, view), 0) - dup;
      };
      const options = legal.filter((c): c is Extract<Command, { type: 'EXCHANGE' }> => c.type === 'EXCHANGE');
      return options.sort((a, b) => score(b.keep) - score(a.keep))[0]!;
    }
    default:
      return pick(legal, rand);
  }
}

/** Chance estimada de alguém desafiar uma alegação minha. */
function challengeRisk(view: GameView, reads: Reads | null, character: Character): number {
  if (!reads) return 0.2;
  const total = Object.values(reads.challenges).reduce((a, b) => a + b, 0);
  const table = reads.claimsMade > 3 ? total / reads.claimsMade : 0.15;
  // quanto menos cópias sobram fora da minha vista, mais gente sabe que é blefe
  const scarcity = unseenCopies(view, character) <= 1 ? 0.15 : 0;
  return Math.min(0.9, table * 1.2 + scarcity + 0.08 * (reads.caught[view.viewer] ?? 0));
}

function chooseAction(
  view: GameView,
  actions: ActionCmd[],
  rand: Rand,
  reads: Reads | null,
  holds: (id: PlayerId, c: Character) => number,
): Command {
  const self = me(view);
  const lives = liveCount(self);
  const opps = opponents(view);
  const hard = reads !== null;
  const bluffAppetite = hard ? 0.9 : 0.6;

  const score = (cmd: ActionCmd): number => {
    const def = ACTIONS[cmd.action];
    const target = cmd.target ? player(view, cmd.target) : null;
    const honest = truthful(view, cmd);
    const claim: Character | null = cmd.viaPrompt ? 'ia' : def.character;
    const fee = cmd.viaPrompt && view.iaMode === 'balanced' ? 1 : 0;

    // chance de a ação ser barrada por um bloqueio (verdadeiro ou não)
    let pBlocked = 0;
    if (def.blockScope === 'target' && target) {
      pBlocked = Math.min(0.85, def.blockedBy.reduce((a, c) => a + holds(target.id, c) * 0.9, 0) + 0.08);
    } else if (def.blockScope === 'anyone') {
      const pNone = opps.reduce((a, o) => a * (1 - holds(o.id, 'senior') * (hard ? 0.7 : 0.5)), 1);
      pBlocked = 1 - pNone;
    }

    let value: number;
    switch (cmd.action) {
      case 'commit':
        value = 1;
        break;
      case 'foreignAid':
        value = 2 * (1 - pBlocked);
        break;
      case 'codeReview':
        value = 3;
        break;
      case 'takedown':
        // tirar do adversário vale mais que ganhar do tesouro
        value = Math.min(2, target!.tokens) * 1.6 * (1 - pBlocked) + (hard ? threat(target!) * 0.02 : 0);
        break;
      case 'exploit':
        value = (5.5 + threat(target!) * 0.08 + (liveCount(target!) === 1 ? 2 : 0)) * (1 - pBlocked) - 3 * 0.45;
        break;
      case 'deploy':
        value = 7 + threat(target!) * 0.1 + (liveCount(target!) === 1 ? 2.5 : 0);
        break;
      case 'refactor': {
        const weakest = Math.min(...myLive(view).map((c) => cardValue(c, view)));
        value = weakest < 3.2 ? 2 : 0.6;
        break;
      }
    }
    value -= fee * 0.9;
    // a IA tem contexto limitado: usar Prompt para algo que já tenho carta é desperdício
    if (cmd.viaPrompt && honest && def.character && myLive(view).includes(def.character)) value -= 3;

    if (!honest && claim) {
      if (unseenCopies(view, claim) <= 0) return -99; // todo mundo com a conta feita sabe que é blefe
      const risk = challengeRisk(view, reads, claim);
      // perder a última carta por um blefe é fim de jogo
      const penalty = lives === 1 ? 9 : 4.5;
      value = (value * (1 - risk) - penalty * risk) * bluffAppetite - (cmd.viaPrompt ? 1.5 : 0);
    }
    return value + rand() * 0.9;
  };

  let best = actions[0]!;
  let bestScore = -Infinity;
  for (const cmd of actions) {
    const sc = score(cmd);
    if (sc > bestScore) {
      best = cmd;
      bestScore = sc;
    }
  }
  return best;
}

function chooseChallenge(
  view: GameView,
  legal: Command[],
  rand: Rand,
  hard: boolean,
  holds: (id: PlayerId, c: Character) => number,
): Command {
  const yes = legal.find((c) => c.type === 'CHALLENGE')!;
  const no = legal.find((c) => c.type === 'PASS')!;
  const pa = view.pending!;
  const onBlock = view.phase.kind === 'blockChallenge';
  const claimant = onBlock ? pa.block!.blocker : pa.actor;
  const character = onBlock ? pa.block!.character : pa.claim!;
  const p = holds(claimant, character);
  if (p === 0) return yes; // todas as cópias estão à vista: blefe certo

  const self = me(view);
  const lives = liveCount(self);
  const hand = myLive(view);
  const iAmTarget = !onBlock && pa.target === self.id;
  const iAmActor = onBlock && pa.actor === self.id;

  // ameaça fatal: Exploit em mim com 1 carta. Se tenho bloqueio de verdade, guardo para a janela seguinte.
  if (iAmTarget && pa.type === 'exploit') {
    const canBlock = ACTIONS.exploit.blockedBy.some((c) => hand.includes(c));
    if (canBlock) return no;
    if (lives === 1) {
      // nada a perder: desafio se o blefe é plausível; senão tento blefar o bloqueio depois
      return p < (hard ? 0.55 : 0.4) ? yes : no;
    }
  }

  let threshold = hard ? 0.22 : 0.15;
  if (iAmTarget) threshold += 0.1;
  if (iAmActor) threshold += pa.type === 'exploit' ? 0.2 : 0.1; // meu investimento está em jogo
  if (!iAmTarget && !iAmActor) threshold -= 0.08; // deixo os envolvidos arriscarem
  if (lives === 1) threshold -= 0.1;
  if (hard && !onBlock && pa.type === 'codeReview' && player(view, claimant).tokens >= 4) threshold += 0.06; // a 3 tokens do Deploy
  if (p < threshold) return rand() < (hard ? 0.85 : 0.6) ? yes : no;
  return no;
}

function chooseBlock(
  view: GameView,
  legal: Command[],
  rand: Rand,
  hard: boolean,
  reads: Reads | null,
): Command {
  const no = legal.find((c) => c.type === 'PASS')!;
  const blocks = legal.filter((c): c is Extract<Command, { type: 'BLOCK' }> => c.type === 'BLOCK');
  const hand = myLive(view);
  const pa = view.pending!;
  const self = me(view);
  const lives = liveCount(self);
  const actor = player(view, pa.actor);

  // bloqueio verdadeiro: prefiro mostrar a carta comum e esconder a IA
  const real = blocks.filter((c) => hand.includes(c.character)).sort((a, b) => Number(a.character === 'ia') - Number(b.character === 'ia'));
  if (real.length > 0) {
    if (pa.type !== 'foreignAid') return real[0]!;
    // Ajuda Externa: só vale revelar que tenho o Sênior contra quem está na frente
    const leader = Math.max(...opponents(view).map(threat));
    return !hard || threat(actor) >= leader - 1 || rand() < 0.4 ? real[0]! : no;
  }

  // blefe de bloqueio: só com personagens que ainda podem existir
  const viable = blocks.filter((c) => unseenCopies(view, c.character) > 0 && c.character !== 'ia');
  if (viable.length === 0) return no;
  const best = [...viable].sort((a, b) => unseenCopies(view, b.character) - unseenCopies(view, a.character))[0]!;
  const actorChallenges = reads ? (reads.challenges[actor.id] ?? 0) : 0;

  let chance: number;
  if (pa.type === 'exploit') {
    // com 1 carta, não bloquear = eliminação certa; blefar não custa nada
    chance = lives === 1 ? (hard ? 1 : 0.7) : hard ? 0.22 : 0.12;
  } else if (pa.type === 'takedown') {
    chance = self.tokens >= 2 ? (hard ? 0.18 : 0.1) : 0;
  } else {
    chance = hard && threat(actor) >= Math.max(...opponents(view).map(threat)) ? 0.08 : 0.03;
  }
  if (lives > 1 || pa.type !== 'exploit') chance *= Math.max(0.3, 1 - 0.25 * actorChallenges);
  if (lives === 1 && pa.type !== 'exploit') chance *= 0.3;
  return rand() < chance ? best : no;
}

