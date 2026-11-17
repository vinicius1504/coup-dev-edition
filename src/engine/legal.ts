import { ACTIONS, FORCED_DEPLOY_AT, PROMPT_ACTIONS, PROMPT_FEE_BALANCED, PROMPT_FEE_CHAOS } from './constants';
import { currentActor } from './helpers';
import type { ActionType, CardId, Command, GameState, GameView, PlayerId } from './types';
import { toView } from './view';

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [head, ...rest] = items;
  return [...combinations(rest, k - 1).map((c) => [head as T, ...c]), ...combinations(rest, k)];
}

/** Todos os comandos que `view.viewer` pode enviar agora (vazio se não é a vez dele). */
export function legalCommands(view: GameView): Command[] {
  const me = view.viewer;
  if (currentActor(view) !== me) return [];
  const self = view.players.find((p) => p.id === me)!;
  const ph = view.phase;
  switch (ph.kind) {
    case 'action': {
      const targets = view.players.filter((p) => !p.eliminated && p.id !== me).map((p) => p.id);
      const out: Command[] = [];
      const add = (action: ActionType, viaPrompt: boolean) => {
        const def = ACTIONS[action];
        const fee = viaPrompt ? (view.iaMode === 'chaos' ? PROMPT_FEE_CHAOS : PROMPT_FEE_BALANCED) : 0;
        if (self.tokens < def.cost + fee) return;
        const base = { type: 'ACTION' as const, playerId: me, action, ...(viaPrompt ? { viaPrompt } : {}) };
        if (def.needsTarget) for (const target of targets) out.push({ ...base, target });
        else out.push(base);
      };
      if (self.tokens >= FORCED_DEPLOY_AT) {
        add('deploy', false);
        return out;
      }
      for (const action of Object.keys(ACTIONS) as ActionType[]) add(action, false);
      for (const action of PROMPT_ACTIONS) add(action, true);
      return out;
    }
    case 'actionChallenge':
    case 'blockChallenge':
      return [
        { type: 'CHALLENGE', playerId: me },
        { type: 'PASS', playerId: me },
      ];
    case 'block':
      return [
        { type: 'PASS', playerId: me },
        ...ACTIONS[view.pending!.type].blockedBy.map((character) => ({ type: 'BLOCK' as const, playerId: me, character })),
      ];
    case 'loseInfluence':
      return self.influences
        .filter((i) => !i.revealed)
        .map((i) => ({ type: 'LOSE_INFLUENCE' as const, playerId: me, cardId: i.cardId }));
    case 'exchange': {
      const live = self.influences.filter((i) => !i.revealed).map((i) => i.cardId);
      const pool: CardId[] = [...live, ...ph.drawn.map((c) => c.id)];
      return combinations(pool, live.length).map((keep) => ({ type: 'EXCHANGE' as const, playerId: me, keep }));
    }
    case 'gameOver':
      return [];
  }
}

export function legalCommandsFor(state: GameState, playerId: PlayerId): Command[] {
  return legalCommands(toView(state, playerId));
}
