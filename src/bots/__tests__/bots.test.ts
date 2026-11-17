import { describe, expect, it } from 'vitest';
import { createGame, currentActor, getPlayer, makeRng, reduce, toView } from '@/engine';
import type { BotDifficulty, GameState, IaMode } from '@/engine';
import { rig } from '@/engine/__tests__/helpers';
import { decide, thinkingTime } from '..';

function play(difficulties: BotDifficulty[], seed: number, iaMode: IaMode = 'balanced', copies?: number): GameState {
  let s = createGame({
    players: difficulties.map((d, i) => ({ name: `B${i}`, kind: 'bot' as const, difficulty: d })),
    iaMode,
    seed,
    ...(copies ? { copies } : {}),
    firstPlayer: seed % difficulties.length,
  });
  const rand = makeRng(seed * 31 + 7);
  for (let step = 0; step < 5000 && s.phase.kind !== 'gameOver'; step++) {
    const actor = currentActor(s)!;
    const cmd = decide(toView(s, actor), getPlayer(s, actor).difficulty!, rand);
    const r = reduce(s, cmd);
    if (!r.ok) throw new Error(`seed ${seed}: bot enviou comando ilegal: ${r.error} ${JSON.stringify(cmd)}`);
    s = r.state;
  }
  return s;
}

const winner = (s: GameState) => (s.phase.kind === 'gameOver' ? s.phase.winner : null);

describe('bots', () => {
  it('todos os níveis terminam partidas só com comandos legais (2 a 6 jogadores, dois modos)', () => {
    const levels: BotDifficulty[] = ['easy', 'medium', 'hard'];
    for (let seed = 0; seed < 90; seed++) {
      const n = 2 + (seed % 5);
      const diffs = Array.from({ length: n }, (_, i) => levels[(seed + i) % 3]!);
      const s = play(diffs, seed, seed % 2 ? 'chaos' : 'balanced');
      expect(winner(s)).not.toBeNull();
    }
  });

  it('também terminam partidas com baralho proporcional', () => {
    for (let seed = 0; seed < 40; seed++) {
      const n = 2 + (seed % 5);
      const s = play(Array.from({ length: n }, () => (seed % 2 ? 'hard' : 'medium') as BotDifficulty), seed, 'balanced', n - 1);
      expect(winner(s)).not.toBeNull();
    }
  });

  it('o tempo de "pensando" fica entre 0,5s e 1,5s', () => {
    const rand = makeRng(3);
    for (let i = 0; i < 200; i++) {
      const t = thinkingTime(rand);
      expect(t).toBeGreaterThanOrEqual(500);
      expect(t).toBeLessThanOrEqual(1500);
    }
  });

  it('Médio e Difícil desafiam quando todas as cópias estão à vista', () => {
    for (const d of ['medium', 'hard'] as const) {
      const s = rig({ hands: [['qa', 'qa'], ['senior', 'senior'], ['qa', 'devops']] });
      s.players[2]!.influences[0] = { card: { id: 'x', character: 'senior', promptUses: 0 }, revealed: true };
      const r = reduce(s, { type: 'ACTION', playerId: 'p0', action: 'codeReview' });
      if (!r.ok) throw new Error(r.message);
      expect(decide(toView(r.state, 'p1'), d, makeRng(1)).type).toBe('CHALLENGE');
    }
  });

  it('bloqueiam o Exploit quando têm o QA de verdade', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const s = rig({ hands: [['hacker', 'qa'], ['qa', 'senior']], tokens: [3, 2] });
      let r = reduce(s, { type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1' });
      if (!r.ok) throw new Error(r.message);
      expect(decide(toView(r.state, 'p1'), d, makeRng(5)).type).toBe('PASS');
      r = reduce(r.state, { type: 'PASS', playerId: 'p1' });
      if (!r.ok) throw new Error(r.message);
      expect(decide(toView(r.state, 'p1'), d, makeRng(5))).toMatchObject({ type: 'BLOCK', character: 'qa' });
    }
  });

  it('Difícil nunca aceita calado um Exploit fatal', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = rig({ hands: [['hacker', 'qa'], ['devops', 'senior']], tokens: [3, 2] });
      s.players[1]!.influences[1]!.revealed = true;
      let r = reduce(s, { type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1' });
      if (!r.ok) throw new Error(r.message);
      const rand = makeRng(seed);
      const first = decide(toView(r.state, 'p1'), 'hard', rand);
      if (first.type === 'CHALLENGE') continue;
      r = reduce(r.state, first);
      if (!r.ok) throw new Error(r.message);
      expect(decide(toView(r.state, 'p1'), 'hard', rand).type).toBe('BLOCK');
    }
  });

  it('descartam a carta menos valiosa ao perder influência', () => {
    const s = rig({ hands: [['qa', 'qa'], ['senior', 'fullstack']], tokens: [7, 2] });
    const r = reduce(s, { type: 'ACTION', playerId: 'p0', action: 'deploy', target: 'p1' });
    if (!r.ok) throw new Error(r.message);
    const cmd = decide(toView(r.state, 'p1'), 'medium', makeRng(1));
    const lost = r.state.players[1]!.influences.find((i) => cmd.type === 'LOSE_INFLUENCE' && i.card.id === cmd.cardId)!;
    expect(lost.card.character).toBe('fullstack');
  });

  it('ranking de força: Difícil > Médio > Fácil em duelos', () => {
    const duel = (a: BotDifficulty, b: BotDifficulty) => {
      let wins = 0;
      const games = 300;
      for (let seed = 0; seed < games; seed++) {
        const s = seed % 2 === 0 ? play([a, b], seed) : play([b, a], seed);
        const w = winner(s)!;
        if (getPlayer(s, w).difficulty === a) wins++;
      }
      return wins / games;
    };
    const me = duel('medium', 'easy');
    const he = duel('hard', 'easy');
    const hm = duel('hard', 'medium');
    console.log(`medium>easy ${me.toFixed(2)}  hard>easy ${he.toFixed(2)}  hard>medium ${hm.toFixed(2)}`);
    expect(me).toBeGreaterThan(0.55);
    expect(he).toBeGreaterThan(0.6);
    expect(hm).toBeGreaterThan(0.5);
  });
});
