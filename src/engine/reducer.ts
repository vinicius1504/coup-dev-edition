import {
  ACTIONS,
  FORCED_DEPLOY_AT,
  IA_CONTEXT_LIMIT,
  PROMPT_ACTIONS,
  PROMPT_FEE_BALANCED,
  PROMPT_FEE_CHAOS,
  REFACTOR_DRAW,
  TOKENS_GAINED,
} from './constants';
import { alivePlayers, getPlayer, liveCards, turnOrderAfter } from './helpers';
import { nextRandom } from './rng';
import type {
  AfterLoss,
  Card,
  CardId,
  Character,
  Command,
  EngineErrorCode,
  GameEvent,
  GameEventData,
  GameState,
  LossReason,
  PendingAction,
  Player,
  PlayerId,
  ReduceResult,
  TokenParty,
  TokenReason,
} from './types';

class EngineError extends Error {
  constructor(
    public code: EngineErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function fail(code: EngineErrorCode, message: string): never {
  throw new EngineError(code, message);
}

interface Ctx {
  s: GameState;
  events: GameEvent[];
}

/** Redutor puro: nunca muta `state`; devolve o novo estado e os eventos gerados. */
export function reduce(state: GameState, command: Command): ReduceResult {
  const ctx: Ctx = { s: structuredClone(state), events: [] };
  try {
    apply(ctx, command);
  } catch (e) {
    if (e instanceof EngineError) return { ok: false, error: e.code, message: e.message };
    throw e;
  }
  return { ok: true, state: ctx.s, events: ctx.events };
}

function apply(ctx: Ctx, cmd: Command): void {
  if (ctx.s.phase.kind === 'gameOver') fail('GAME_OVER', 'A partida já terminou');
  if (!ctx.s.players.some((p) => p.id === cmd.playerId)) fail('NOT_YOUR_TURN', 'Jogador desconhecido');
  switch (cmd.type) {
    case 'ACTION':
      return declare(ctx, cmd);
    case 'PASS':
      return pass(ctx, cmd.playerId);
    case 'CHALLENGE':
      return challenge(ctx, cmd.playerId);
    case 'BLOCK':
      return block(ctx, cmd.playerId, cmd.character);
    case 'LOSE_INFLUENCE':
      return chooseLoss(ctx, cmd.playerId, cmd.cardId);
    case 'EXCHANGE':
      return exchange(ctx, cmd.playerId, cmd.keep);
    default:
      fail('WRONG_PHASE', 'Comando desconhecido');
  }
}

// ───────────── utilitários ─────────────

function emit(ctx: Ctx, data: GameEventData, visibleTo?: PlayerId[]): void {
  const ev: GameEvent = { ...data, seq: ctx.s.nextEventSeq++, turn: ctx.s.turn, ...(visibleTo ? { visibleTo } : {}) };
  ctx.s.log.push(ev);
  ctx.events.push(ev);
}

function moveTokens(ctx: Ctx, from: TokenParty, to: TokenParty, amount: number, reason: TokenReason): void {
  if (amount <= 0) return;
  if (from !== 'treasury') getPlayer(ctx.s, from).tokens -= amount;
  if (to !== 'treasury') getPlayer(ctx.s, to).tokens += amount;
  emit(ctx, { type: 'TOKENS_MOVED', from, to, amount, reason });
}

function random(ctx: Ctx): number {
  const [v, ns] = nextRandom(ctx.s.rng);
  ctx.s.rng = ns;
  return v;
}

function shuffleDeck(ctx: Ctx): void {
  const d = ctx.s.deck;
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(random(ctx) * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
}

/** Devolve cartas ao baralho (id novo, contador da IA zerado) e embaralha. */
function returnToDeck(ctx: Ctx, cards: Card[]): void {
  for (const c of cards) {
    ctx.s.deck.push({ id: `c${ctx.s.nextCardId++}`, character: c.character, promptUses: 0 });
  }
  shuffleDeck(ctx);
}

/** Troca uma carta viva da mão por uma nova do baralho, no mesmo slot. */
function swapCard(ctx: Ctx, player: Player, cardId: CardId): void {
  const slot = player.influences.find((i) => i.card.id === cardId && !i.revealed)!;
  returnToDeck(ctx, [slot.card]);
  slot.card = ctx.s.deck.shift()!;
}

function requireResponder(ctx: Ctx, playerId: PlayerId, kinds: string[]): PlayerId[] {
  const ph = ctx.s.phase;
  if (!kinds.includes(ph.kind) || !('pending' in ph)) fail('WRONG_PHASE', 'Não há janela aberta para esse comando');
  if (ph.pending[0] !== playerId) fail('NOT_YOUR_TURN', 'Aguarde sua vez de responder');
  return ph.pending;
}

// ───────────── declaração ─────────────

function declare(ctx: Ctx, cmd: Extract<Command, { type: 'ACTION' }>): void {
  const { s } = ctx;
  if (s.phase.kind !== 'action') fail('WRONG_PHASE', 'Não é hora de declarar ação');
  if (cmd.playerId !== s.activePlayer) fail('NOT_YOUR_TURN', 'Não é o seu turno');
  const def = ACTIONS[cmd.action];
  if (!def) fail('WRONG_PHASE', 'Ação desconhecida');
  const actor = getPlayer(s, cmd.playerId);
  const viaPrompt = cmd.viaPrompt === true;

  if (viaPrompt && !(PROMPT_ACTIONS as readonly string[]).includes(cmd.action)) {
    fail('WRONG_PHASE', 'O Prompt só copia ações de personagem');
  }
  if (actor.tokens >= FORCED_DEPLOY_AT && cmd.action !== 'deploy') {
    fail('MUST_DEPLOY', `Com ${FORCED_DEPLOY_AT}+ tokens o Deploy na sexta é obrigatório`);
  }
  if (def.needsTarget) {
    const target = s.players.find((p) => p.id === cmd.target);
    if (!target || target.eliminated || target.id === actor.id) fail('INVALID_TARGET', 'Alvo inválido');
  } else if (cmd.target !== undefined) {
    fail('INVALID_TARGET', 'Essa ação não tem alvo');
  }
  const fee = viaPrompt ? (s.config.iaMode === 'chaos' ? PROMPT_FEE_CHAOS : PROMPT_FEE_BALANCED) : 0;
  if (actor.tokens < def.cost + fee) fail('INSUFFICIENT_TOKENS', 'Tokens insuficientes');

  const claim: Character | null = viaPrompt ? 'ia' : def.character;
  const pending: PendingAction = {
    type: cmd.action,
    actor: actor.id,
    ...(cmd.target !== undefined ? { target: cmd.target } : {}),
    viaPrompt,
    claim,
    costPaid: def.cost,
    promptFeePaid: fee,
  };
  s.pending = pending;
  emit(ctx, {
    type: 'ACTION_DECLARED',
    action: cmd.action,
    actor: actor.id,
    ...(cmd.target !== undefined ? { target: cmd.target } : {}),
    viaPrompt,
    claim,
  });
  // Todo custo é debitado na declaração (ver regras de reembolso em resolveChallenge).
  moveTokens(ctx, actor.id, 'treasury', fee, 'promptFee');
  moveTokens(ctx, actor.id, 'treasury', def.cost, 'actionCost');

  if (claim) s.phase = { kind: 'actionChallenge', pending: turnOrderAfter(s, actor.id) };
  else continueAction(ctx);
}

// ───────────── janelas ─────────────

function pass(ctx: Ctx, playerId: PlayerId): void {
  const queue = requireResponder(ctx, playerId, ['actionChallenge', 'block', 'blockChallenge']);
  queue.shift();
  if (queue.length > 0) return;
  const kind = ctx.s.phase.kind;
  const pa = ctx.s.pending!;
  if (kind === 'actionChallenge') {
    if (pa.viaPrompt) pa.promptCounts = true;
    continueAction(ctx);
  } else if (kind === 'block') {
    resolveAction(ctx);
  } else {
    emit(ctx, { type: 'ACTION_CANCELLED', action: pa.type, actor: pa.actor, reason: 'blocked' });
    endTurn(ctx);
  }
}

function challenge(ctx: Ctx, challengerId: PlayerId): void {
  requireResponder(ctx, challengerId, ['actionChallenge', 'blockChallenge']);
  const { s } = ctx;
  const pa = s.pending!;
  const on = s.phase.kind === 'actionChallenge' ? 'action' : 'block';
  const claimantId = on === 'action' ? pa.actor : pa.block!.blocker;
  const character = on === 'action' ? pa.claim! : pa.block!.character;
  const claimant = getPlayer(s, claimantId);

  emit(ctx, { type: 'CHALLENGE_DECLARED', challenger: challengerId, claimant: claimantId, character, on });
  const proof = liveCards(claimant).find((c) => c.character === character);
  emit(ctx, { type: 'CHALLENGE_RESOLVED', challenger: challengerId, claimant: claimantId, character, claimHeld: !!proof });

  if (proof) {
    // Alegação verdadeira: a carta volta ao baralho, o alegador compra outra, o desafiante perde 1.
    swapCard(ctx, claimant, proof.id);
    emit(ctx, { type: 'CARD_SWAPPED', playerId: claimantId, character });
    if (on === 'action') {
      requestLoss(ctx, challengerId, 'challengeLost', 'CONTINUE_ACTION');
    } else {
      emit(ctx, { type: 'ACTION_CANCELLED', action: pa.type, actor: pa.actor, reason: 'blocked' });
      requestLoss(ctx, challengerId, 'challengeLost', 'END_TURN');
    }
  } else if (on === 'action') {
    // Blefe pego: a ação é cancelada e o custo dela (não a taxa do Prompt) é devolvido.
    moveTokens(ctx, 'treasury', pa.actor, pa.costPaid, 'refund');
    emit(ctx, { type: 'ACTION_CANCELLED', action: pa.type, actor: pa.actor, reason: 'challenged' });
    requestLoss(ctx, claimantId, 'bluffCaught', 'END_TURN');
  } else {
    // Bloqueio era blefe: o bloqueador perde 1 e a ação é executada.
    requestLoss(ctx, claimantId, 'bluffCaught', 'RESOLVE_ACTION');
  }
}

function block(ctx: Ctx, blockerId: PlayerId, character: Character): void {
  requireResponder(ctx, blockerId, ['block']);
  const { s } = ctx;
  const pa = s.pending!;
  if (!ACTIONS[pa.type].blockedBy.includes(character)) fail('INVALID_BLOCK', 'Esse personagem não bloqueia essa ação');
  pa.block = { blocker: blockerId, character };
  emit(ctx, { type: 'BLOCK_DECLARED', blocker: blockerId, character, action: pa.type, actor: pa.actor });
  s.phase = { kind: 'blockChallenge', pending: turnOrderAfter(s, blockerId) };
}

// ───────────── perda de influência ─────────────

function requestLoss(ctx: Ctx, playerId: PlayerId, reason: LossReason, then: AfterLoss): void {
  const live = liveCards(getPlayer(ctx.s, playerId));
  if (live.length === 0) return proceed(ctx, then);
  if (live.length === 1) {
    loseCard(ctx, playerId, live[0]!.id, reason);
    return proceed(ctx, then);
  }
  ctx.s.phase = { kind: 'loseInfluence', playerId, reason, then };
}

function chooseLoss(ctx: Ctx, playerId: PlayerId, cardId: CardId): void {
  const ph = ctx.s.phase;
  if (ph.kind !== 'loseInfluence') fail('WRONG_PHASE', 'Ninguém precisa perder influência agora');
  if (ph.playerId !== playerId) fail('NOT_YOUR_TURN', 'Não é você quem perde influência');
  if (!liveCards(getPlayer(ctx.s, playerId)).some((c) => c.id === cardId)) fail('INVALID_CARD', 'Carta inválida');
  loseCard(ctx, playerId, cardId, ph.reason);
  proceed(ctx, ph.then);
}

function loseCard(ctx: Ctx, playerId: PlayerId, cardId: CardId, reason: LossReason): void {
  const p = getPlayer(ctx.s, playerId);
  const slot = p.influences.find((i) => i.card.id === cardId)!;
  slot.revealed = true;
  emit(ctx, { type: 'INFLUENCE_LOST', playerId, cardId, character: slot.card.character, reason });
  if (liveCards(p).length === 0) {
    p.eliminated = true;
    moveTokens(ctx, playerId, 'treasury', p.tokens, 'elimination');
    emit(ctx, { type: 'PLAYER_ELIMINATED', playerId });
  }
}

function proceed(ctx: Ctx, then: AfterLoss): void {
  const alive = alivePlayers(ctx.s);
  if (alive.length === 1) {
    const winner = alive[0]!.id;
    ctx.s.pending = null;
    ctx.s.phase = { kind: 'gameOver', winner };
    emit(ctx, { type: 'GAME_OVER', winner });
    return;
  }
  if (then === 'END_TURN') endTurn(ctx);
  else if (then === 'CONTINUE_ACTION') continueAction(ctx);
  else resolveAction(ctx);
}

// ───────────── resolução ─────────────

/** A ação sobreviveu à janela de desafio: abre o bloqueio, se houver, ou executa. */
function continueAction(ctx: Ctx): void {
  const { s } = ctx;
  const pa = s.pending!;
  const def = ACTIONS[pa.type];
  let blockers: PlayerId[] = [];
  if (def.blockScope === 'anyone') blockers = turnOrderAfter(s, pa.actor);
  else if (def.blockScope === 'target' && pa.target && !getPlayer(s, pa.target).eliminated) blockers = [pa.target];
  if (blockers.length > 0) s.phase = { kind: 'block', pending: blockers };
  else resolveAction(ctx);
}

function resolveAction(ctx: Ctx): void {
  const { s } = ctx;
  const pa = s.pending!;
  const target = pa.target ? getPlayer(s, pa.target) : undefined;
  emit(ctx, {
    type: 'ACTION_RESOLVED',
    action: pa.type,
    actor: pa.actor,
    ...(pa.target ? { target: pa.target } : {}),
    viaPrompt: pa.viaPrompt,
  });
  switch (pa.type) {
    case 'commit':
    case 'foreignAid':
    case 'codeReview':
      moveTokens(ctx, 'treasury', pa.actor, TOKENS_GAINED[pa.type], pa.type);
      return endTurn(ctx);
    case 'takedown':
      if (target && !target.eliminated) {
        moveTokens(ctx, target.id, pa.actor, Math.min(TOKENS_GAINED.takedown, target.tokens), 'takedown');
      }
      return endTurn(ctx);
    case 'exploit':
    case 'deploy':
      return requestLoss(ctx, target!.id, pa.type, 'END_TURN');
    case 'refactor': {
      const drawn = s.deck.splice(0, REFACTOR_DRAW);
      emit(ctx, { type: 'EXCHANGE_STARTED', playerId: pa.actor, drawnCount: drawn.length });
      s.phase = { kind: 'exchange', playerId: pa.actor, drawn };
      return;
    }
  }
}

function exchange(ctx: Ctx, playerId: PlayerId, keep: CardId[]): void {
  const ph = ctx.s.phase;
  if (ph.kind !== 'exchange') fail('WRONG_PHASE', 'Não há Refactor em andamento');
  if (ph.playerId !== playerId) fail('NOT_YOUR_TURN', 'O Refactor não é seu');
  const p = getPlayer(ctx.s, playerId);
  const pool = [...liveCards(p), ...ph.drawn];
  const liveSlots = p.influences.filter((i) => !i.revealed);
  const unique = new Set(keep);
  if (unique.size !== keep.length || keep.length !== liveSlots.length || !keep.every((id) => pool.some((c) => c.id === id))) {
    fail('INVALID_CARD', `Escolha exatamente ${liveSlots.length} carta(s) entre as disponíveis`);
  }
  const kept = keep.map((id) => pool.find((c) => c.id === id)!);
  liveSlots.forEach((slot, i) => (slot.card = kept[i]!));
  returnToDeck(ctx, pool.filter((c) => !unique.has(c.id)));
  emit(ctx, { type: 'EXCHANGE_COMPLETED', playerId });
  endTurn(ctx);
}

/** Limite de contexto (Equilibrado) ou revelação (Caos) depois de um Prompt não desafiado. */
function settleIa(ctx: Ctx, pa: PendingAction): void {
  if (!pa.viaPrompt || !pa.promptCounts) return;
  const actor = getPlayer(ctx.s, pa.actor);
  const ia = liveCards(actor).find((c) => c.character === 'ia');
  if (!ia) return;
  if (ctx.s.config.iaMode === 'chaos') {
    emit(ctx, { type: 'IA_REVEALED', playerId: actor.id });
    swapCard(ctx, actor, ia.id);
    return;
  }
  ia.promptUses += 1;
  if (ia.promptUses >= IA_CONTEXT_LIMIT) {
    swapCard(ctx, actor, ia.id);
    emit(ctx, { type: 'IA_OUT_OF_CONTEXT', playerId: actor.id }, [actor.id]);
  }
}

function endTurn(ctx: Ctx): void {
  const { s } = ctx;
  if (s.pending) settleIa(ctx, s.pending);
  s.pending = null;
  const next = getPlayer(s, turnOrderAfter(s, s.activePlayer)[0]!);
  s.activePlayer = next.id;
  s.turn += 1;
  s.phase = { kind: 'action' };
  emit(ctx, { type: 'TURN_STARTED', playerId: next.id, turn: s.turn, mustDeploy: next.tokens >= FORCED_DEPLOY_AT });
}
