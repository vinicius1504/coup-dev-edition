import { describe, expect, it } from 'vitest';
import { createGame, legalCommandsFor, reduce, toView } from '..';
import { Game, rig } from './helpers';

const mk = (n: number, seed = 1) =>
  createGame({ players: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, kind: 'human' as const })), iaMode: 'balanced', seed });

describe('preparação', () => {
  it('distribui 2 cartas e 2 tokens; sobra o resto das 16 no monte', () => {
    for (const n of [3, 4, 5, 6]) {
      const s = mk(n);
      expect(s.players.every((p) => p.influences.length === 2 && p.tokens === 2)).toBe(true);
      expect(s.deck.length).toBe(16 - 2 * n);
    }
  });

  it('com 2 jogadores, quem começa tem 1 token', () => {
    const s = mk(2);
    expect(s.players.map((p) => p.tokens)).toEqual([1, 2]);
  });

  it('rejeita menos de 2 ou mais de 6 jogadores', () => {
    expect(() => mk(1)).toThrow();
    expect(() => mk(7)).toThrow();
  });

  it('é determinística: mesma semente, mesma partida', () => {
    expect(mk(4, 7)).toEqual(mk(4, 7));
    expect(mk(4, 7).deck).not.toEqual(mk(4, 8).deck);
  });

  it('não muta o estado de entrada e sobrevive a JSON', () => {
    const s = mk(3);
    const snap = JSON.stringify(s);
    const r = reduce(s, { type: 'ACTION', playerId: 'p0', action: 'commit' });
    expect(JSON.stringify(s)).toBe(snap);
    expect(r.ok && reduce(JSON.parse(JSON.stringify(r.state)), { type: 'ACTION', playerId: 'p1', action: 'commit' }).ok).toBe(true);
  });
});

describe('ações gerais', () => {
  it('Commit dá 1 token, sem janelas, e passa o turno', () => {
    const g = new Game(rig({ hands: [[], [], []].map(() => ['qa', 'qa']) }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'commit' });
    expect(g.p(0).tokens).toBe(3);
    expect(g.s.activePlayer).toBe('p1');
    expect(g.s.phase.kind).toBe('action');
  });

  it('Ajuda Externa dá 2 tokens se ninguém bloqueia', () => {
    const g = new Game(rig({ hands: [['qa', 'qa'], ['qa', 'qa'], ['qa', 'qa']] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'foreignAid' });
    expect(g.s.phase).toEqual({ kind: 'block', pending: ['p1', 'p2'] });
    g.allPass();
    expect(g.p(0).tokens).toBe(4);
  });

  it('Ajuda Externa pode ser bloqueada por qualquer um com Dev Sênior', () => {
    const g = new Game(rig({ hands: [['qa', 'qa'], ['qa', 'qa'], ['senior', 'qa']] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'foreignAid' }).passUntil('p2');
    g.do({ type: 'BLOCK', playerId: 'p2', character: 'senior' }).allPass();
    expect(g.p(0).tokens).toBe(2);
    expect(g.s.activePlayer).toBe('p1');
  });

  it('QA não bloqueia Ajuda Externa', () => {
    const g = new Game(rig({ hands: [['qa', 'qa'], ['qa', 'qa']] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'foreignAid' });
    expect(g.err({ type: 'BLOCK', playerId: 'p1', character: 'qa' })).toBe('INVALID_BLOCK');
  });

  it('Deploy na sexta custa 7 e não abre janelas', () => {
    const g = new Game(rig({ hands: [['qa', 'qa'], ['qa', 'devops']], tokens: [7, 2] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'deploy', target: 'p1' });
    expect(g.p(0).tokens).toBe(0);
    expect(g.s.phase).toMatchObject({ kind: 'loseInfluence', playerId: 'p1' });
    g.do({ type: 'LOSE_INFLUENCE', playerId: 'p1', cardId: g.cardId(1, 'devops') });
    expect(g.live(1)).toEqual(['qa']);
    expect(g.s.activePlayer).toBe('p1');
  });

  it('Deploy exige 7 tokens e alvo válido', () => {
    const g = new Game(rig({ hands: [['qa', 'qa'], ['qa', 'qa']], tokens: [6, 2] }));
    expect(g.err({ type: 'ACTION', playerId: 'p0', action: 'deploy', target: 'p1' })).toBe('INSUFFICIENT_TOKENS');
    g.p(0).tokens = 7;
    expect(g.err({ type: 'ACTION', playerId: 'p0', action: 'deploy', target: 'p0' })).toBe('INVALID_TARGET');
    expect(g.err({ type: 'ACTION', playerId: 'p0', action: 'deploy' })).toBe('INVALID_TARGET');
  });

  it('com 10+ tokens o Deploy é obrigatório', () => {
    const g = new Game(rig({ hands: [['senior', 'qa'], ['qa', 'qa'], ['qa', 'qa']], tokens: [10, 2, 2] }));
    expect(g.err({ type: 'ACTION', playerId: 'p0', action: 'commit' })).toBe('MUST_DEPLOY');
    expect(g.err({ type: 'ACTION', playerId: 'p0', action: 'codeReview' })).toBe('MUST_DEPLOY');
    const legal = legalCommandsFor(g.s, 'p0');
    expect(legal).toHaveLength(2);
    expect(legal.every((c) => c.type === 'ACTION' && c.action === 'deploy')).toBe(true);
    g.do({ type: 'ACTION', playerId: 'p0', action: 'deploy', target: 'p1' });
    g.do({ type: 'LOSE_INFLUENCE', playerId: 'p1', cardId: g.p(1).influences[0]!.card.id });
    g.p(2).tokens = 10;
    g.do({ type: 'ACTION', playerId: 'p1', action: 'commit' });
    expect(g.s.log.at(-1)).toMatchObject({ type: 'TURN_STARTED', playerId: 'p2', mustDeploy: true });
  });
});

describe('ações de personagem', () => {
  it('Code Review dá 3 tokens', () => {
    const g = new Game(rig({ hands: [['senior', 'qa'], ['qa', 'qa']] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'codeReview' }).allPass();
    expect(g.p(0).tokens).toBe(5);
  });

  it('Exploit: paga 3 e o alvo perde 1 influência', () => {
    const g = new Game(rig({ hands: [['hacker', 'qa'], ['devops', 'senior'], ['qa', 'qa']], tokens: [3, 2, 2] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1' });
    expect(g.p(0).tokens).toBe(0);
    g.allPass(); // desafio
    expect(g.s.phase).toEqual({ kind: 'block', pending: ['p1'] });
    g.allPass(); // bloqueio
    g.do({ type: 'LOSE_INFLUENCE', playerId: 'p1', cardId: g.cardId(1, 'senior') });
    expect(g.live(1)).toEqual(['devops']);
    expect(g.p(0).tokens).toBe(0);
  });

  it('Exploit exige 3 tokens antes de declarar', () => {
    const g = new Game(rig({ hands: [['hacker', 'qa'], ['qa', 'qa']], tokens: [2, 2] }));
    expect(g.err({ type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1' })).toBe('INSUFFICIENT_TOKENS');
  });

  it('Exploit bloqueado por QA: ação cancelada, os 3 tokens ficam pagos', () => {
    const g = new Game(rig({ hands: [['hacker', 'qa'], ['qa', 'senior']], tokens: [3, 2] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1' }).allPass();
    g.do({ type: 'BLOCK', playerId: 'p1', character: 'qa' }).allPass();
    expect(g.p(0).tokens).toBe(0);
    expect(g.live(1)).toHaveLength(2);
    expect(g.events.some((e) => e.type === 'ACTION_CANCELLED' && e.reason === 'blocked')).toBe(true);
  });

  it('só o alvo pode bloquear o Exploit', () => {
    const g = new Game(rig({ hands: [['hacker', 'qa'], ['qa', 'qa'], ['qa', 'qa']], tokens: [3, 2, 2] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1' }).allPass();
    expect(g.err({ type: 'BLOCK', playerId: 'p2', character: 'qa' })).toBe('NOT_YOUR_TURN');
  });

  it('Derrubar servidor rouba 2 (ou o que o alvo tiver)', () => {
    const g = new Game(rig({ hands: [['devops', 'qa'], ['qa', 'qa'], ['qa', 'qa']], tokens: [2, 1, 5] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'takedown', target: 'p1' }).allPass().allPass();
    expect([g.p(0).tokens, g.p(1).tokens]).toEqual([3, 0]);
    g.do({ type: 'ACTION', playerId: 'p1', action: 'takedown', target: 'p2' }).allPass().allPass();
    expect([g.p(1).tokens, g.p(2).tokens]).toEqual([2, 3]);
  });

  it('Derrubar servidor é bloqueado por DevOps ou Full-Stack, não por QA', () => {
    for (const c of ['devops', 'fullstack'] as const) {
      const g = new Game(rig({ hands: [['devops', 'qa'], [c, 'qa']] }));
      g.do({ type: 'ACTION', playerId: 'p0', action: 'takedown', target: 'p1' }).allPass();
      expect(g.err({ type: 'BLOCK', playerId: 'p1', character: 'qa' })).toBe('INVALID_BLOCK');
      g.do({ type: 'BLOCK', playerId: 'p1', character: c }).allPass();
      expect(g.p(1).tokens).toBe(2);
    }
  });

  it('Refactor: compra 2, mantém o mesmo nº de cartas, devolve o resto', () => {
    const g = new Game(rig({ hands: [['fullstack', 'qa'], ['qa', 'qa']], deck: ['senior', 'hacker', 'devops'] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'refactor' }).allPass();
    const ph = g.s.phase;
    if (ph.kind !== 'exchange') throw new Error('fase errada');
    expect(ph.drawn.map((c) => c.character)).toEqual(['senior', 'hacker']);
    expect(g.err({ type: 'EXCHANGE', playerId: 'p0', keep: [ph.drawn[0]!.id] })).toBe('INVALID_CARD');
    expect(g.err({ type: 'EXCHANGE', playerId: 'p0', keep: [ph.drawn[0]!.id, ph.drawn[0]!.id] })).toBe('INVALID_CARD');
    g.do({ type: 'EXCHANGE', playerId: 'p0', keep: [ph.drawn[0]!.id, g.cardId(0, 'qa')] });
    expect(g.live(0).sort()).toEqual(['qa', 'senior']);
    expect(g.s.deck.map((c) => c.character).sort()).toEqual(['devops', 'fullstack', 'hacker']);
    expect(g.s.activePlayer).toBe('p1');
  });

  it('Refactor com 1 carta viva mantém só 1', () => {
    const g = new Game(rig({ hands: [['fullstack', 'qa'], ['qa', 'qa']], deck: ['senior', 'hacker', 'devops'] }));
    g.p(0).influences[1]!.revealed = true;
    g.do({ type: 'ACTION', playerId: 'p0', action: 'refactor' }).allPass();
    const ph = g.s.phase;
    if (ph.kind !== 'exchange') throw new Error('fase errada');
    expect(legalCommandsFor(g.s, 'p0')).toHaveLength(3);
    g.do({ type: 'EXCHANGE', playerId: 'p0', keep: [ph.drawn[1]!.id] });
    expect(g.live(0)).toEqual(['hacker']);
    expect(g.p(0).influences).toHaveLength(2);
    expect(g.s.deck).toHaveLength(3);
  });
});

describe('desafios', () => {
  it('alegação verdadeira: desafiante perde 1, carta é trocada, ação continua', () => {
    const g = new Game(rig({ hands: [['senior', 'qa'], ['devops', 'hacker']], deck: ['fullstack'] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'codeReview' });
    g.do({ type: 'CHALLENGE', playerId: 'p1' });
    expect(g.s.phase).toMatchObject({ kind: 'loseInfluence', playerId: 'p1', reason: 'challengeLost' });
    // a carta provada voltou ao baralho (2 cartas possíveis: fullstack ou a própria senior)
    expect(g.s.deck).toHaveLength(1);
    expect([...g.live(0), g.s.deck[0]!.character].sort()).toEqual(['fullstack', 'qa', 'senior']);
    g.do({ type: 'LOSE_INFLUENCE', playerId: 'p1', cardId: g.cardId(1, 'hacker') });
    expect(g.p(0).tokens).toBe(5);
    expect(g.live(1)).toEqual(['devops']);
    expect(g.has('CARD_SWAPPED')).toBe(true);
  });

  it('blefe pego: alegador perde 1 e a ação é cancelada', () => {
    const g = new Game(rig({ hands: [['qa', 'devops'], ['qa', 'qa']] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'codeReview' });
    g.do({ type: 'CHALLENGE', playerId: 'p1' });
    expect(g.s.phase).toMatchObject({ kind: 'loseInfluence', playerId: 'p0', reason: 'bluffCaught' });
    g.do({ type: 'LOSE_INFLUENCE', playerId: 'p0', cardId: g.cardId(0, 'qa') });
    expect(g.p(0).tokens).toBe(2);
    expect(g.s.activePlayer).toBe('p1');
  });

  it('Exploit desafiado e perdido: os 3 tokens são devolvidos', () => {
    const g = new Game(rig({ hands: [['qa', 'devops'], ['qa', 'qa']], tokens: [3, 2] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1' });
    expect(g.p(0).tokens).toBe(0);
    g.do({ type: 'CHALLENGE', playerId: 'p1' });
    expect(g.p(0).tokens).toBe(3);
    expect(g.live(1)).toHaveLength(2);
  });

  it('prioridade: só o primeiro na ordem de turno pode responder', () => {
    const g = new Game(rig({ hands: [['qa', 'qa'], ['qa', 'qa'], ['qa', 'qa']] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'codeReview' });
    expect(g.err({ type: 'CHALLENGE', playerId: 'p2' })).toBe('NOT_YOUR_TURN');
    expect(g.err({ type: 'CHALLENGE', playerId: 'p0' })).toBe('NOT_YOUR_TURN');
    g.do({ type: 'PASS', playerId: 'p1' });
    expect(g.err({ type: 'PASS', playerId: 'p1' })).toBe('NOT_YOUR_TURN');
    g.do({ type: 'CHALLENGE', playerId: 'p2' });
    expect(g.s.phase).toMatchObject({ kind: 'loseInfluence', playerId: 'p0' });
  });

  it('desafio ao bloqueio verdadeiro: desafiante perde e a ação é cancelada', () => {
    const g = new Game(rig({ hands: [['hacker', 'devops'], ['qa', 'senior']], tokens: [3, 2] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1' }).allPass();
    g.do({ type: 'BLOCK', playerId: 'p1', character: 'qa' });
    g.do({ type: 'CHALLENGE', playerId: 'p0' });
    expect(g.s.phase).toMatchObject({ kind: 'loseInfluence', playerId: 'p0', then: 'END_TURN' });
    g.do({ type: 'LOSE_INFLUENCE', playerId: 'p0', cardId: g.cardId(0, 'devops') });
    expect(g.live(1)).toHaveLength(2);
    expect(g.p(0).tokens).toBe(0);
    expect(g.s.activePlayer).toBe('p1');
  });

  it('desafio ao bloqueio blefado: bloqueador perde 1 e a ação é executada', () => {
    const g = new Game(rig({ hands: [['devops', 'qa'], ['qa', 'senior'], ['qa', 'qa']] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'takedown', target: 'p1' }).allPass();
    g.do({ type: 'BLOCK', playerId: 'p1', character: 'fullstack' }).passUntil('p0');
    g.do({ type: 'CHALLENGE', playerId: 'p0' });
    g.do({ type: 'LOSE_INFLUENCE', playerId: 'p1', cardId: g.cardId(1, 'senior') });
    expect([g.p(0).tokens, g.p(1).tokens]).toEqual([4, 0]);
    expect(g.live(1)).toEqual(['qa']);
  });

  it('um terceiro pode desafiar o bloqueio', () => {
    const g = new Game(rig({ hands: [['qa', 'qa'], ['qa', 'qa'], ['hacker', 'qa']] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'foreignAid' });
    g.do({ type: 'BLOCK', playerId: 'p1', character: 'senior' });
    expect(g.s.phase).toEqual({ kind: 'blockChallenge', pending: ['p2', 'p0'] });
    g.do({ type: 'CHALLENGE', playerId: 'p2' });
    g.do({ type: 'LOSE_INFLUENCE', playerId: 'p1', cardId: g.p(1).influences[0]!.card.id });
    expect(g.p(0).tokens).toBe(4);
  });
});

describe('IA (Claude)', () => {
  it('Prompt custa 1 token extra e executa a ação copiada', () => {
    const g = new Game(rig({ hands: [['ia', 'qa'], ['qa', 'qa']], tokens: [2, 2] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'codeReview', viaPrompt: true });
    expect(g.s.pending).toMatchObject({ claim: 'ia', promptFeePaid: 1 });
    expect(g.p(0).tokens).toBe(1);
    g.allPass();
    expect(g.p(0).tokens).toBe(4);
  });

  it('Prompt + Exploit custa 3 + 1 = 4', () => {
    const g = new Game(rig({ hands: [['ia', 'qa'], ['devops', 'senior']], tokens: [3, 2] }));
    expect(g.err({ type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1', viaPrompt: true })).toBe('INSUFFICIENT_TOKENS');
    g.p(0).tokens = 4;
    g.do({ type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1', viaPrompt: true });
    expect(g.p(0).tokens).toBe(0);
  });

  it('Prompt não copia ações gerais', () => {
    const g = new Game(rig({ hands: [['ia', 'qa'], ['qa', 'qa']], tokens: [9, 2] }));
    for (const action of ['commit', 'foreignAid', 'deploy'] as const) {
      expect(g.err({ type: 'ACTION', playerId: 'p0', action, target: 'p1', viaPrompt: true })).toBe('WRONG_PHASE');
    }
  });

  it('a ação copiada continua bloqueável pelas mesmas cartas', () => {
    const g = new Game(rig({ hands: [['ia', 'qa'], ['qa', 'senior']], tokens: [4, 2] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1', viaPrompt: true }).allPass();
    g.do({ type: 'BLOCK', playerId: 'p1', character: 'qa' }).allPass();
    expect(g.live(1)).toHaveLength(2);
    expect(g.p(0).tokens).toBe(0);
  });

  it('Prompt blefado e desafiado: custo da ação volta, taxa do Prompt não', () => {
    const g = new Game(rig({ hands: [['hacker', 'qa'], ['qa', 'qa']], tokens: [4, 2] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1', viaPrompt: true });
    g.do({ type: 'CHALLENGE', playerId: 'p1' });
    // tinha o Hacker, mas alegou a IA: é blefe
    expect(g.s.phase).toMatchObject({ kind: 'loseInfluence', playerId: 'p0' });
    expect(g.p(0).tokens).toBe(3);
  });

  it('Alucinação bloqueia Ajuda Externa, Exploit e Derrubar servidor', () => {
    const a = new Game(rig({ hands: [['qa', 'qa'], ['ia', 'qa']] }));
    a.do({ type: 'ACTION', playerId: 'p0', action: 'foreignAid' }).do({ type: 'BLOCK', playerId: 'p1', character: 'ia' }).allPass();
    expect(a.p(0).tokens).toBe(2);
    const b = new Game(rig({ hands: [['hacker', 'qa'], ['ia', 'qa']], tokens: [3, 2] }));
    b.do({ type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1' }).allPass().do({ type: 'BLOCK', playerId: 'p1', character: 'ia' }).allPass();
    expect(b.live(1)).toHaveLength(2);
    const c = new Game(rig({ hands: [['devops', 'qa'], ['ia', 'qa']] }));
    c.do({ type: 'ACTION', playerId: 'p0', action: 'takedown', target: 'p1' }).allPass().do({ type: 'BLOCK', playerId: 'p1', character: 'ia' }).allPass();
    expect(c.p(1).tokens).toBe(2);
  });

  it('Alucinação blefada pode ser desafiada', () => {
    const g = new Game(rig({ hands: [['hacker', 'qa'], ['senior', 'qa']], tokens: [3, 2] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1' }).allPass();
    g.do({ type: 'BLOCK', playerId: 'p1', character: 'ia' }).do({ type: 'CHALLENGE', playerId: 'p0' });
    // perde 1 pelo blefe e a outra pelo Exploit: eliminado, p0 vence
    g.do({ type: 'LOSE_INFLUENCE', playerId: 'p1', cardId: g.cardId(1, 'qa') });
    expect(g.s.phase).toEqual({ kind: 'gameOver', winner: 'p0' });
  });

  it('limite de contexto: no 2º Prompt a IA volta ao baralho e o jogador compra outra', () => {
    const g = new Game(rig({ hands: [['ia', 'qa'], ['qa', 'qa']], tokens: [5, 2], deck: ['senior'] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'codeReview', viaPrompt: true }).allPass();
    expect(g.p(0).influences[0]!.card).toMatchObject({ character: 'ia', promptUses: 1 });
    expect(g.has('IA_OUT_OF_CONTEXT')).toBe(false);
    g.do({ type: 'ACTION', playerId: 'p1', action: 'commit' });
    g.do({ type: 'ACTION', playerId: 'p0', action: 'codeReview', viaPrompt: true }).allPass();
    const ev = g.events.find((e) => e.type === 'IA_OUT_OF_CONTEXT')!;
    expect(ev.visibleTo).toEqual(['p0']);
    expect(g.live(0)).toHaveLength(2);
    expect(g.s.deck).toHaveLength(1);
    const all = [...g.p(0).influences.map((i) => i.card), ...g.s.deck];
    expect(all.find((c) => c.character === 'ia')!.promptUses).toBe(0);
    // evento privado não aparece para os outros
    expect(toView(g.s, 'p1').log.some((e) => e.type === 'IA_OUT_OF_CONTEXT')).toBe(false);
    expect(toView(g.s, 'p0').log.some((e) => e.type === 'IA_OUT_OF_CONTEXT')).toBe(true);
  });

  it('Prompt bloqueado também gasta contexto; Prompt blefado não mexe em nada', () => {
    const g = new Game(rig({ hands: [['ia', 'qa'], ['devops', 'qa']], tokens: [5, 2] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'takedown', target: 'p1', viaPrompt: true }).allPass();
    g.do({ type: 'BLOCK', playerId: 'p1', character: 'devops' }).allPass();
    expect(g.p(0).influences[0]!.card.promptUses).toBe(1);
    g.do({ type: 'ACTION', playerId: 'p1', action: 'codeReview', viaPrompt: true }).allPass();
    expect(g.p(1).tokens).toBe(4);
    expect(g.live(1)).toEqual(['devops', 'qa']);
  });

  it('IA provada em desafio volta ao baralho com o contador zerado', () => {
    const g = new Game(rig({ hands: [['ia', 'qa'], ['qa', 'devops']], tokens: [5, 2], deck: [] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'codeReview', viaPrompt: true }).allPass();
    g.do({ type: 'ACTION', playerId: 'p1', action: 'commit' });
    g.do({ type: 'ACTION', playerId: 'p0', action: 'codeReview', viaPrompt: true });
    g.do({ type: 'CHALLENGE', playerId: 'p1' });
    g.do({ type: 'LOSE_INFLUENCE', playerId: 'p1', cardId: g.cardId(1, 'devops') });
    // baralho vazio: recomprou a própria IA, zerada, e este Prompt não conta
    expect(g.p(0).influences[0]!.card).toMatchObject({ character: 'ia', promptUses: 0 });
    expect(g.p(0).tokens).toBe(5 - 1 + 3 - 1 + 3);
  });

  it('modo Caos: Prompt grátis, IA revelada e embaralhada de volta', () => {
    const g = new Game(rig({ iaMode: 'chaos', hands: [['ia', 'qa'], ['qa', 'qa']], tokens: [2, 2], deck: ['senior', 'hacker'] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'codeReview', viaPrompt: true });
    expect(g.p(0).tokens).toBe(2);
    g.allPass();
    expect(g.p(0).tokens).toBe(5);
    const ev = g.events.find((e) => e.type === 'IA_REVEALED')!;
    expect(ev.visibleTo).toBeUndefined();
    expect(g.live(0)).toHaveLength(2);
    expect(g.s.deck).toHaveLength(2);
  });
});

describe('regras de borda e fim de jogo', () => {
  it('perde o desafio e depois o Exploit no mesmo ciclo: eliminado', () => {
    const g = new Game(rig({ hands: [['hacker', 'qa'], ['senior', 'devops'], ['qa', 'qa']], tokens: [3, 4, 2] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1' });
    g.do({ type: 'CHALLENGE', playerId: 'p1' });
    g.do({ type: 'LOSE_INFLUENCE', playerId: 'p1', cardId: g.cardId(1, 'senior') });
    expect(g.s.phase).toEqual({ kind: 'block', pending: ['p1'] });
    g.do({ type: 'PASS', playerId: 'p1' });
    expect(g.p(1).eliminated).toBe(true);
    expect(g.p(1).tokens).toBe(0);
    expect(g.has('PLAYER_ELIMINATED')).toBe(true);
    expect(g.s.activePlayer).toBe('p2');
  });

  it('desafiante eliminado pelo próprio desafio: Exploit não tem mais efeito', () => {
    const g = new Game(rig({ hands: [['hacker', 'qa'], ['senior', 'devops'], ['qa', 'qa']], tokens: [3, 2, 2] }));
    g.p(1).influences[0]!.revealed = true;
    g.do({ type: 'ACTION', playerId: 'p0', action: 'exploit', target: 'p1' });
    g.do({ type: 'CHALLENGE', playerId: 'p1' });
    expect(g.p(1).eliminated).toBe(true);
    expect(g.s.phase.kind).toBe('action');
    expect(g.s.activePlayer).toBe('p2');
  });

  it('jogadores eliminados são pulados e não entram nas janelas', () => {
    const g = new Game(rig({ hands: [['senior', 'qa'], ['qa', 'qa'], ['qa', 'qa']] }));
    g.p(1).influences.forEach((i) => (i.revealed = true));
    g.p(1).eliminated = true;
    g.do({ type: 'ACTION', playerId: 'p0', action: 'codeReview' });
    expect(g.s.phase).toEqual({ kind: 'actionChallenge', pending: ['p2'] });
    g.allPass();
    expect(g.s.activePlayer).toBe('p2');
    expect(g.err({ type: 'ACTION', playerId: 'p2', action: 'takedown', target: 'p1' })).toBe('INVALID_TARGET');
  });

  it('ator eliminado ao blefar: o turno segue para o próximo vivo', () => {
    const g = new Game(rig({ hands: [['qa', 'qa'], ['qa', 'qa'], ['qa', 'qa']] }));
    g.p(0).influences[0]!.revealed = true;
    g.do({ type: 'ACTION', playerId: 'p0', action: 'codeReview' });
    g.do({ type: 'CHALLENGE', playerId: 'p1' });
    expect(g.p(0).eliminated).toBe(true);
    expect(g.s.activePlayer).toBe('p1');
  });

  it('último jogador com carta vence e a partida trava', () => {
    const g = new Game(rig({ hands: [['qa', 'qa'], ['qa', 'qa']], tokens: [7, 2] }));
    g.p(1).influences[0]!.revealed = true;
    g.do({ type: 'ACTION', playerId: 'p0', action: 'deploy', target: 'p1' });
    expect(g.s.phase).toEqual({ kind: 'gameOver', winner: 'p0' });
    expect(g.s.log.at(-1)).toMatchObject({ type: 'GAME_OVER', winner: 'p0' });
    expect(g.err({ type: 'ACTION', playerId: 'p1', action: 'commit' })).toBe('GAME_OVER');
  });

  it('comandos fora de fase ou de turno são rejeitados', () => {
    const g = new Game(rig({ hands: [['qa', 'qa'], ['qa', 'qa']] }));
    expect(g.err({ type: 'ACTION', playerId: 'p1', action: 'commit' })).toBe('NOT_YOUR_TURN');
    expect(g.err({ type: 'PASS', playerId: 'p1' })).toBe('WRONG_PHASE');
    expect(g.err({ type: 'CHALLENGE', playerId: 'p1' })).toBe('WRONG_PHASE');
    expect(g.err({ type: 'LOSE_INFLUENCE', playerId: 'p1', cardId: 'x' })).toBe('WRONG_PHASE');
  });

  it('a visão de um jogador não vaza cartas alheias nem o baralho', () => {
    const g = new Game(rig({ hands: [['fullstack', 'qa'], ['ia', 'hacker']] }));
    g.do({ type: 'ACTION', playerId: 'p0', action: 'refactor' }).allPass();
    const v = toView(g.s, 'p1');
    expect(v.players[0]!.influences.every((i) => i.character === undefined)).toBe(true);
    expect(v.players[1]!.influences.map((i) => i.character)).toEqual(['ia', 'hacker']);
    expect(v.phase).toMatchObject({ kind: 'exchange', drawn: [] });
    expect(JSON.stringify(v)).not.toContain('"deck"');
    expect(toView(g.s, 'p0').phase).toMatchObject({ drawn: [{}, {}] });
  });

  it('todo comando legal é aceito pela engine (fuzz com 200 partidas)', () => {
    for (let seed = 0; seed < 200; seed++) {
      let s = mk(2 + (seed % 5), seed);
      let x = seed * 7919 + 1;
      for (let step = 0; step < 3000 && s.phase.kind !== 'gameOver'; step++) {
        const actor = s.phase.kind === 'action' ? s.activePlayer : 'pending' in s.phase ? s.phase.pending[0]! : s.phase.playerId;
        const legal = legalCommandsFor(s, actor);
        expect(legal.length).toBeGreaterThan(0);
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        const r = reduce(s, legal[x % legal.length]!);
        if (!r.ok) throw new Error(`seed ${seed}: ${r.error} ${r.message}`);
        s = r.state;
        const cards = s.deck.length + s.players.reduce((a, p) => a + p.influences.length, 0) + (s.phase.kind === 'exchange' ? s.phase.drawn.length : 0);
        expect(cards).toBe(16);
        expect(s.players.every((p) => p.tokens >= 0)).toBe(true);
      }
      expect(s.phase.kind).toBe('gameOver');
    }
  });
});
