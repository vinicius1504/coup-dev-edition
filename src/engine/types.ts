/**
 * Tipos centrais da engine. Tudo aqui é JSON-serializável (sem classes, Map, Set,
 * Date ou funções), para que estado e comandos possam trafegar pela rede no futuro.
 */

// ───────────── Cartas ─────────────

export type Character = 'senior' | 'hacker' | 'qa' | 'devops' | 'fullstack' | 'ia';

export type CardId = string;
export type PlayerId = string;

export interface Card {
  id: CardId;
  character: Character;
  /** Só relevante para a IA: Prompts já usados por ESTA carta. Zera ao voltar ao baralho. */
  promptUses: number;
}

export interface Influence {
  card: Card;
  /** true = influência perdida (carta virada para cima, fora do jogo). */
  revealed: boolean;
}

// ───────────── Jogadores ─────────────

export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type PlayerKind = 'human' | 'bot';

export interface Player {
  id: PlayerId;
  name: string;
  kind: PlayerKind;
  difficulty?: BotDifficulty;
  tokens: number;
  influences: Influence[];
  eliminated: boolean;
}

// ───────────── Configuração ─────────────

export type IaMode = 'balanced' | 'chaos';

export interface PlayerSetup {
  name: string;
  kind: PlayerKind;
  difficulty?: BotDifficulty;
}

export interface GameConfig {
  /** 2 a 6 jogadores, na ordem de turno. */
  players: PlayerSetup[];
  iaMode: IaMode;
  /** Semente do RNG: mesma semente + mesmos comandos = mesma partida. */
  seed: number;
  /** Índice de quem joga primeiro (padrão 0). */
  firstPlayer?: number;
}

// ───────────── Ações ─────────────

export type GeneralAction = 'commit' | 'foreignAid' | 'deploy';
export type CharacterAction = 'codeReview' | 'exploit' | 'takedown' | 'refactor';
export type ActionType = GeneralAction | CharacterAction;

/** Ação declarada e ainda em resolução (uma por turno). */
export interface PendingAction {
  type: ActionType;
  actor: PlayerId;
  target?: PlayerId;
  /** true = executada via Prompt da IA (a alegação passa a ser "tenho a IA"). */
  viaPrompt: boolean;
  /** Personagem alegado; null para ações gerais. */
  claim: Character | null;
  /** Custo da ação já debitado (Exploit 3, Deploy 7). Devolvido se o ator perde o desafio. */
  costPaid: number;
  /** Taxa do Prompt já debitada (1 no modo Equilibrado). Nunca é devolvida. */
  promptFeePaid: number;
  /** Prompt passou sem desafio: conta para o limite de contexto ao fim do turno. */
  promptCounts?: boolean;
  block?: BlockClaim;
}

export interface BlockClaim {
  blocker: PlayerId;
  character: Character;
}

// ───────────── Comandos (entrada da engine) ─────────────

export type Command =
  | { type: 'ACTION'; playerId: PlayerId; action: ActionType; target?: PlayerId; viaPrompt?: boolean }
  | { type: 'CHALLENGE'; playerId: PlayerId }
  | { type: 'BLOCK'; playerId: PlayerId; character: Character }
  | { type: 'PASS'; playerId: PlayerId }
  | { type: 'LOSE_INFLUENCE'; playerId: PlayerId; cardId: CardId }
  | { type: 'EXCHANGE'; playerId: PlayerId; keep: CardId[] };

export type CommandType = Command['type'];

// ───────────── Fases (máquina de estados) ─────────────

/** O que acontece depois que alguém escolhe a influência a perder. */
export type AfterLoss =
  | 'END_TURN' // ação cancelada ou efeito final já aplicado
  | 'CONTINUE_ACTION' // desafiante perdeu: abre bloqueio (se houver) ou executa
  | 'RESOLVE_ACTION'; // bloqueador perdeu o desafio: a ação é executada

export type LossReason = 'challengeLost' | 'bluffCaught' | 'exploit' | 'deploy';

export type Phase =
  /** Jogador ativo escolhe a ação. */
  | { kind: 'action' }
  /** Janela de desafio à ação. `pending` = quem ainda não respondeu, em ordem de turno. */
  | { kind: 'actionChallenge'; pending: PlayerId[] }
  /** Janela de bloqueio. `pending` = quem ainda pode bloquear, em ordem de turno. */
  | { kind: 'block'; pending: PlayerId[] }
  /** Janela de desafio ao bloqueio declarado em `PendingAction.block`. */
  | { kind: 'blockChallenge'; pending: PlayerId[] }
  /** `playerId` precisa escolher qual influência revelar. */
  | { kind: 'loseInfluence'; playerId: PlayerId; reason: LossReason; then: AfterLoss }
  /** Refactor: `playerId` escolhe o que manter entre a mão e `drawn`. */
  | { kind: 'exchange'; playerId: PlayerId; drawn: Card[] }
  | { kind: 'gameOver'; winner: PlayerId };

export type PhaseKind = Phase['kind'];

// ───────────── Eventos (saída da engine: log e animações) ─────────────

export type TokenParty = PlayerId | 'treasury';

export type TokenReason =
  | 'commit'
  | 'foreignAid'
  | 'codeReview'
  | 'takedown'
  | 'actionCost'
  | 'promptFee'
  | 'refund'
  | 'elimination';

export type CancelReason = 'challenged' | 'blocked';

export type GameEventData =
  | { type: 'GAME_STARTED'; playerIds: PlayerId[]; iaMode: IaMode }
  | { type: 'TURN_STARTED'; playerId: PlayerId; turn: number; mustDeploy: boolean }
  | { type: 'ACTION_DECLARED'; action: ActionType; actor: PlayerId; target?: PlayerId; viaPrompt: boolean; claim: Character | null }
  | { type: 'TOKENS_MOVED'; from: TokenParty; to: TokenParty; amount: number; reason: TokenReason }
  | { type: 'CHALLENGE_DECLARED'; challenger: PlayerId; claimant: PlayerId; character: Character; on: 'action' | 'block' }
  /** `claimHeld` = o alegador tinha a carta (o desafiante perde). */
  | { type: 'CHALLENGE_RESOLVED'; challenger: PlayerId; claimant: PlayerId; character: Character; claimHeld: boolean }
  /** Carta provada num desafio: volta ao baralho e o dono compra outra. */
  | { type: 'CARD_SWAPPED'; playerId: PlayerId; character: Character }
  | { type: 'BLOCK_DECLARED'; blocker: PlayerId; character: Character; action: ActionType; actor: PlayerId }
  | { type: 'ACTION_CANCELLED'; action: ActionType; actor: PlayerId; reason: CancelReason }
  | { type: 'ACTION_RESOLVED'; action: ActionType; actor: PlayerId; target?: PlayerId; viaPrompt: boolean }
  | { type: 'INFLUENCE_LOST'; playerId: PlayerId; cardId: CardId; character: Character; reason: LossReason }
  | { type: 'PLAYER_ELIMINATED'; playerId: PlayerId }
  | { type: 'EXCHANGE_STARTED'; playerId: PlayerId; drawnCount: number }
  | { type: 'EXCHANGE_COMPLETED'; playerId: PlayerId }
  /** Equilibrado: a IA atingiu o limite de contexto e foi trocada. */
  | { type: 'IA_OUT_OF_CONTEXT'; playerId: PlayerId }
  /** Caos: a IA foi revelada a todos e embaralhada de volta. */
  | { type: 'IA_REVEALED'; playerId: PlayerId }
  | { type: 'GAME_OVER'; winner: PlayerId };

export type GameEvent = GameEventData & {
  /** Sequencial, único na partida. */
  seq: number;
  turn: number;
  /** Ausente = público. Presente = só estes jogadores veem (informação oculta). */
  visibleTo?: PlayerId[];
};

export type GameEventType = GameEvent['type'];

// ───────────── Estado ─────────────

export interface GameState {
  config: GameConfig;
  /** Ordem do array = ordem de turno. */
  players: Player[];
  /** Monte central; índice 0 é o topo. */
  deck: Card[];
  /** Contador de turnos, começa em 1. */
  turn: number;
  activePlayer: PlayerId;
  phase: Phase;
  pending: PendingAction | null;
  /** Estado interno do RNG determinístico. */
  rng: number;
  /** Cartas ganham id novo ao voltar ao baralho, para não serem rastreáveis. */
  nextCardId: number;
  nextEventSeq: number;
  log: GameEvent[];
}

// ───────────── API da engine ─────────────

export type EngineErrorCode =
  | 'GAME_OVER'
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'INVALID_TARGET'
  | 'INSUFFICIENT_TOKENS'
  | 'MUST_DEPLOY'
  | 'INVALID_BLOCK'
  | 'INVALID_CARD'
  | 'INVALID_CONFIG';

export type ReduceResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: EngineErrorCode; message: string };

/** Assinatura do redutor: puro, nunca muta `state`. */
export type Reducer = (state: GameState, command: Command) => ReduceResult;

// ───────────── Visão por jogador (bots e futuro multiplayer) ─────────────

/** Influência como um observador a enxerga: `character` só existe se ele pode ver a carta. */
export interface InfluenceView {
  cardId: CardId;
  revealed: boolean;
  character?: Character;
}

export interface PlayerView {
  id: PlayerId;
  name: string;
  kind: PlayerKind;
  tokens: number;
  influences: InfluenceView[];
  eliminated: boolean;
}

/** Estado sem informação oculta, do ponto de vista de `viewer`. */
export interface GameView {
  viewer: PlayerId;
  iaMode: IaMode;
  players: PlayerView[];
  deckCount: number;
  turn: number;
  activePlayer: PlayerId;
  /** No Refactor de outro jogador, `drawn` vem vazio. */
  phase: Phase;
  pending: PendingAction | null;
  log: GameEvent[];
}
