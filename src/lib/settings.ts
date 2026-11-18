import type { BotDifficulty, GameConfig, IaMode, PlayerSetup } from '@/engine/types';

export type DifficultyChoice = BotDifficulty | 'mixed';

export interface Settings {
  name: string;
  bots: number;
  difficulty: DifficultyChoice;
  iaMode: IaMode;
  /** classic = 3 cópias de cada; scaled = (jogadores - 1) cópias de cada. */
  deck: 'classic' | 'scaled';
  timer: boolean;
  sound: boolean;
  /** Mostra a abertura (andar até o PC) antes da partida. */
  intro: boolean;
}

export const DEFAULT_SETTINGS: Settings = { name: 'você', bots: 3, difficulty: 'medium', iaMode: 'balanced', deck: 'classic', timer: false, sound: true, intro: true };

const KEY = 'coup-dev-edition:settings:v1';
const BOT_NAMES = ['root', 'segfault', 'nullptr', 'sudo', 'grep'];
const MIXED: BotDifficulty[] = ['easy', 'medium', 'hard', 'medium', 'hard'];

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const s = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
    s.bots = Math.min(5, Math.max(1, Math.round(Number(s.bots)) || 3));
    if (!['easy', 'medium', 'hard', 'mixed'].includes(s.difficulty)) s.difficulty = 'medium';
    if (s.iaMode !== 'chaos') s.iaMode = 'balanced';
    if (s.deck !== 'scaled') s.deck = 'classic';
    s.name = String(s.name).slice(0, 12) || DEFAULT_SETTINGS.name;
    return s;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // armazenamento indisponível (modo privado etc.): o jogo segue sem persistir
  }
}

/** Cópias de cada personagem conforme o tipo de baralho escolhido. */
export function deckCopies(s: Pick<Settings, 'deck' | 'bots'>): number {
  return s.deck === 'scaled' ? Math.max(1, s.bots) : 3;
}

export function buildConfig(s: Settings, seed: number): GameConfig {
  const players: PlayerSetup[] = [{ name: s.name.trim() || 'você', kind: 'human' }];
  for (let i = 0; i < s.bots; i++) {
    players.push({ name: BOT_NAMES[i]!, kind: 'bot', difficulty: s.difficulty === 'mixed' ? MIXED[i]! : s.difficulty });
  }
  return { players, iaMode: s.iaMode, copies: deckCopies(s), seed, firstPlayer: Math.abs(seed) % players.length };
}
