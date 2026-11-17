import type { ActionType, Character, CharacterAction } from './types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const STARTING_TOKENS = 2;
/** No jogo de 2, quem joga primeiro começa com 1. */
export const FIRST_PLAYER_TOKENS_2P = 1;
export const STARTING_INFLUENCES = 2;
export const FORCED_DEPLOY_AT = 10;
export const PROMPT_FEE_BALANCED = 1;
export const PROMPT_FEE_CHAOS = 0;
export const IA_CONTEXT_LIMIT = 2;
export const COPIES_PER_CHARACTER = 3;
export const REFACTOR_DRAW = 2;

/** Personagens com 3 cópias; a IA é carta única. */
export const BASE_CHARACTERS = ['senior', 'hacker', 'qa', 'devops', 'fullstack'] as const satisfies readonly Character[];
export const ALL_CHARACTERS: readonly Character[] = [...BASE_CHARACTERS, 'ia'];
export const DECK_SIZE = BASE_CHARACTERS.length * COPIES_PER_CHARACTER + 1;

export interface CharacterDef {
  name: string;
  role: string;
  icon: string;
  color: string;
  quote: string;
}

export const CHARACTERS: Record<Character, CharacterDef> = {
  senior: { name: 'DEV SÊNIOR', role: 'Tech Lead', icon: '[S]', color: '#f5c542', quote: 'Funciona na minha máquina.' },
  hacker: { name: 'HACKER', role: 'Pentester', icon: '>_', color: '#39ff14', quote: 'Achei uma brecha.' },
  qa: { name: 'QA', role: 'Quality Assurance', icon: '[!]', color: '#ff5c8a', quote: 'Isso não vai pra produção.' },
  devops: { name: 'DEVOPS', role: 'Infra', icon: '{∞}', color: '#4fc3f7', quote: 'Subi pra produção e caiu tudo.' },
  fullstack: { name: 'FULL-STACK', role: 'Front + Back', icon: '<=>', color: '#b388ff', quote: 'Eu faço front e back.' },
  ia: { name: 'IA', role: 'Claude', icon: '(*)', color: '#ff8a50', quote: 'Posso ajudar com isso! (Não sei do que se trata.)' },
};

export type BlockScope = 'none' | 'target' | 'anyone';

export interface ActionDef {
  name: string;
  /** Personagem que a ação exige alegar; null = ação geral (não desafiável). */
  character: Character | null;
  cost: number;
  needsTarget: boolean;
  /** Quem pode bloquear: ninguém, só o alvo ou qualquer outro jogador. */
  blockScope: BlockScope;
  /** Personagens que bloqueiam (a IA entra em toda ação bloqueável: Alucinação). */
  blockedBy: readonly Character[];
}

export const ACTIONS: Record<ActionType, ActionDef> = {
  commit: { name: 'Commit', character: null, cost: 0, needsTarget: false, blockScope: 'none', blockedBy: [] },
  foreignAid: { name: 'Ajuda Externa', character: null, cost: 0, needsTarget: false, blockScope: 'anyone', blockedBy: ['senior', 'ia'] },
  deploy: { name: 'Deploy na sexta', character: null, cost: 7, needsTarget: true, blockScope: 'none', blockedBy: [] },
  codeReview: { name: 'Code Review', character: 'senior', cost: 0, needsTarget: false, blockScope: 'none', blockedBy: [] },
  exploit: { name: 'Exploit', character: 'hacker', cost: 3, needsTarget: true, blockScope: 'target', blockedBy: ['qa', 'ia'] },
  takedown: { name: 'Derrubar servidor', character: 'devops', cost: 0, needsTarget: true, blockScope: 'target', blockedBy: ['devops', 'fullstack', 'ia'] },
  refactor: { name: 'Refactor', character: 'fullstack', cost: 0, needsTarget: false, blockScope: 'none', blockedBy: [] },
};

/** Ações que o Prompt da IA pode copiar. */
export const PROMPT_ACTIONS: readonly CharacterAction[] = ['codeReview', 'exploit', 'takedown', 'refactor'];

export const BLOCK_NAMES: Partial<Record<Character, string>> = {
  senior: 'Precisa de testes',
  qa: 'Bug reportado',
  devops: 'Rollback',
  fullstack: 'Hotfix',
  ia: 'Alucinação',
};

export const TOKENS_GAINED = { commit: 1, foreignAid: 2, codeReview: 3, takedown: 2 } as const;
