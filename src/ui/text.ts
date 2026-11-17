import { ACTIONS, BLOCK_NAMES, CHARACTERS } from '@/engine/constants';
import type { ActionType, GameEvent, PendingAction, PlayerId } from '@/engine/types';

export type Names = (id: PlayerId) => string;

const tk = (n: number) => `${n} token${n === 1 ? '' : 's'}`;

export const ACTION_EFFECT: Record<ActionType, string> = {
  commit: '+1 token',
  foreignAid: '+2 tokens',
  deploy: 'paga 7: alvo perde 1 influência',
  codeReview: '+3 tokens',
  exploit: 'paga 3: alvo perde 1 influência',
  takedown: 'rouba 2 tokens do alvo',
  refactor: 'compra 2 cartas e escolhe',
};

export function describeAction(pa: Pick<PendingAction, 'type' | 'actor' | 'target' | 'viaPrompt'>, name: Names): string {
  let s = `${name(pa.actor)} usa ${ACTIONS[pa.type].name}`;
  if (pa.viaPrompt) s += ' via Prompt da IA';
  if (pa.target) s += ` em ${name(pa.target)}`;
  return s;
}

export type LogTone = 'sys' | 'turn' | 'act' | 'coin' | 'fight' | 'bad' | 'win' | 'private';

export function eventText(e: GameEvent, name: Names): { text: string; tone: LogTone } | null {
  switch (e.type) {
    case 'GAME_STARTED':
      return { text: `boot: ${e.playerIds.length} jogadores, IA em modo ${e.iaMode === 'chaos' ? 'CAOS' : 'equilibrado'}`, tone: 'sys' };
    case 'TURN_STARTED':
      return { text: `── turno ${e.turn}: ${name(e.playerId)}${e.mustDeploy ? ' (Deploy obrigatório)' : ''} ──`, tone: 'turn' };
    case 'ACTION_DECLARED':
      return { text: describeAction({ type: e.action, actor: e.actor, target: e.target, viaPrompt: e.viaPrompt }, name) + (e.claim ? ` [alega ${CHARACTERS[e.claim].name}]` : ''), tone: 'act' };
    case 'TOKENS_MOVED': {
      const who = e.to !== 'treasury' ? e.to : e.from;
      const n = name(who as PlayerId);
      switch (e.reason) {
        case 'actionCost':
          return { text: `${n} paga ${tk(e.amount)}`, tone: 'coin' };
        case 'promptFee':
          return { text: `${n} paga ${tk(e.amount)} pelo Prompt`, tone: 'coin' };
        case 'refund':
          return { text: `${n} recebe ${tk(e.amount)} de volta`, tone: 'coin' };
        case 'takedown':
          return { text: `${name(e.to as PlayerId)} rouba ${tk(e.amount)} de ${name(e.from as PlayerId)}`, tone: 'coin' };
        case 'elimination':
          return { text: `${tk(e.amount)} de ${n} voltam ao tesouro`, tone: 'coin' };
        default:
          return { text: `${n} +${tk(e.amount)}`, tone: 'coin' };
      }
    }
    case 'CHALLENGE_DECLARED':
      return { text: `${name(e.challenger)} desafia ${name(e.claimant)}: "Você não tem ${CHARACTERS[e.character].name}!"`, tone: 'fight' };
    case 'CHALLENGE_RESOLVED':
      return e.claimHeld
        ? { text: `${name(e.claimant)} mostra ${CHARACTERS[e.character].name}. ${name(e.challenger)} errou.`, tone: 'fight' }
        : { text: `${name(e.claimant)} não tinha ${CHARACTERS[e.character].name}. Blefe!`, tone: 'fight' };
    case 'CARD_SWAPPED':
      return { text: `${name(e.playerId)} devolve ${CHARACTERS[e.character].name} ao baralho e compra outra`, tone: 'sys' };
    case 'BLOCK_DECLARED':
      return { text: `${name(e.blocker)} bloqueia: "${BLOCK_NAMES[e.character]}" [alega ${CHARACTERS[e.character].name}]`, tone: 'fight' };
    case 'ACTION_CANCELLED':
      return { text: `${ACTIONS[e.action].name} de ${name(e.actor)} cancelada (${e.reason === 'blocked' ? 'bloqueio' : 'desafio'})`, tone: 'sys' };
    case 'ACTION_RESOLVED':
      return null;
    case 'INFLUENCE_LOST':
      return { text: `${name(e.playerId)} perde uma influência: ${CHARACTERS[e.character].name}`, tone: 'bad' };
    case 'PLAYER_ELIMINATED':
      return { text: `${name(e.playerId)} foi eliminado. Processo encerrado com código 1.`, tone: 'bad' };
    case 'EXCHANGE_STARTED':
      return { text: `${name(e.playerId)} compra ${e.drawnCount} carta(s) do baralho`, tone: 'sys' };
    case 'EXCHANGE_COMPLETED':
      return { text: `${name(e.playerId)} devolve o resto; baralho embaralhado`, tone: 'sys' };
    case 'IA_OUT_OF_CONTEXT':
      return { text: `(só você vê) sua IA ficou sem contexto: voltou ao baralho e você comprou outra carta`, tone: 'private' };
    case 'IA_REVEALED':
      return { text: `${name(e.playerId)} revela a IA e a embaralha de volta ao baralho`, tone: 'sys' };
    case 'GAME_OVER':
      return { text: `${name(e.winner)} venceu. exit 0`, tone: 'win' };
  }
}

/** Texto curto para o balão sobre o jogador. */
export function bubbleFor(e: GameEvent): { playerId: PlayerId; text: string } | null {
  switch (e.type) {
    case 'ACTION_DECLARED':
      return { playerId: e.actor, text: (e.viaPrompt ? 'Prompt: ' : '') + ACTIONS[e.action].name };
    case 'CHALLENGE_DECLARED':
      return { playerId: e.challenger, text: 'Desafio!' };
    case 'BLOCK_DECLARED':
      return { playerId: e.blocker, text: `Bloqueio: ${BLOCK_NAMES[e.character]}` };
    case 'IA_REVEALED':
      return { playerId: e.playerId, text: 'Era a IA!' };
    default:
      return null;
  }
}
