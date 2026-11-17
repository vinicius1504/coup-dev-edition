import type { Character } from '@/engine/types';

/**
 * Pixel art das cartas, 16x16, desenhada em texto: cada caractere é um pixel
 * e aponta para uma cor da paleta ('.' = transparente).
 */
export interface SpriteDef {
  palette: Record<string, string>;
  rows: string[];
  /** Segundo quadro da animação: linhas que mudam em relação a `rows`. */
  alt: Record<number, string>;
}

export const SPRITE_SIZE = 16;

export const SPRITES: Record<Character, SpriteDef> = {
  // Tech lead grisalho, de óculos e barba, com a caneca de café
  senior: {
    palette: { h: '#b8b8c8', s: '#f1c27d', d: '#c68642', g: '#1b1b2b', w: '#cfe8ff', b: '#e8e8f0', k: '#7a4a3a', t: '#f5c542', m: '#ffffff', c: '#6b3e1e' },
    rows: [
      '................',
      '....hhhhhhhh....',
      '...hhhhhhhhhh...',
      '..hhhsssssshhh..',
      '..hhsssssssshh..',
      '..hsggggsggggh..',
      '..sgwwgggwwgs...',
      '..ssggsssggss...',
      '...ssssddssss...',
      '...bbssssssbb...',
      '...bbbbkkbbbb...',
      '....bbbbbbbb....',
      '.....bbbbbb.....',
      '..ttttttttt.mmmm',
      '.tttttttttt.mccm',
      '.tttttttttt.mmmm',
    ],
    alt: { 6: '..sgggggggggs...' },
  },
  // Figura de capuz, rosto na sombra, olhos acesos e notebook
  hacker: {
    palette: { o: '#1f3a1f', O: '#2f5a2f', k: '#060a06', e: '#39ff14', l: '#3a3f4a', L: '#5a6170', g: '#39ff14' },
    rows: [
      '................',
      '.....oooooo.....',
      '....oOOOOOOo....',
      '...oOOooooOOo...',
      '..oOOokkkkoOOo..',
      '..oOokkkkkkoOo..',
      '..oOokekkekoOo..',
      '..oOokkkkkkoOo..',
      '..oOOokkkkoOOo..',
      '...oOOokkoOOo...',
      '..ooOOOooOOOoo..',
      '.oOOOOOOOOOOOOo.',
      '.oOllllllllllOo.',
      '.oOlLLLgLLLLlOo.',
      '..llllllllllll..',
      '................',
    ],
    alt: { 6: '..oOokkkkkkoOo..', 13: '.oOlLLLLLLLLlOo.' },
  },
  // Lupa com um bug dentro
  qa: {
    palette: { r: '#ff5c8a', g: '#1c2740', G: '#7f96c8', b: '#9be564', B: '#3d7a1f', h: '#c98a4b' },
    rows: [
      '................',
      '.....rrrrrr.....',
      '...rrggggggrr...',
      '..rgGGgggggggr..',
      '..rgGgBggBgggr..',
      '.rggggBbbBggggr.',
      '.rggBBbbbbBBggr.',
      '.rggggbbbbggggr.',
      '.rggBBbbbbBBggr.',
      '..rgggBbbBgggr..',
      '..rggggggggggr..',
      '...rrggggggrr...',
      '.....rrrrrrhh...',
      '...........hhh..',
      '............hhh.',
      '.............hh.',
    ],
    alt: { 6: '.rgggBbbbbBgggr.', 8: '.rgggBbbbbBgggr.' },
  },
  // Rack de servidores pegando fogo
  devops: {
    palette: { s: '#3a4a63', S: '#5b7396', l: '#39ff14', r: '#ff4d6d', f: '#ff8a1f', y: '#ffd23f', k: '#0f1622' },
    rows: [
      '......f....f....',
      '.....ff...fyf...',
      '....fyf..ffyff..',
      '...ffyyf.fyyyf..',
      '...fyyyffyyyff..',
      '..SSSSSSSSSSSS..',
      '..SkkkkkkkklrS..',
      '..SSSSSSSSSSSS..',
      '..ssssssssssss..',
      '..skkkkkkkklls..',
      '..ssssssssssss..',
      '..SSSSSSSSSSSS..',
      '..SkkkkkkkkrrS..',
      '..SSSSSSSSSSSS..',
      '..ss........ss..',
      '................',
    ],
    alt: { 0: '.....f....f.....', 1: '....fyf...ff....', 2: '....ffyf.fyyf...', 6: '..SkkkkkkkkrrS..' },
  },
  // Janela de front colorida na frente, terminal de back atrás
  fullstack: {
    palette: { d: '#4a3a80', k: '#0c0f18', g: '#39ff14', W: '#7c4dff', w: '#b388ff', p: '#2a2140', y: '#ffd23f', c: '#6fe3ff', q: '#ff8ad8' },
    rows: [
      '................',
      '................',
      '.....ddddddddddd',
      '.....dkkkkkkkkkd',
      '.....dkggkkkkkkd',
      '.WWWWWWWWWWgkkkd',
      '.wppppppppwkkkkd',
      '.wpyyyppccwggkkd',
      '.wpyyyppccwkkkkd',
      '.wpyyyppppwkgkkd',
      '.wppppppppwddddd',
      '.wpccccpqqw.....',
      '.wppppppppw.....',
      '.wwwwwwwwww.....',
      '................',
      '................',
    ],
    alt: { 9: '.wpyyyppppwkkkkd', 11: '.wpccccpyyw.....' },
  },
  // Faísca de oito pontas
  ia: {
    palette: { o: '#ff8a50', O: '#ffe0c8' },
    rows: [
      '................',
      '.......oo.......',
      '.......oo.......',
      '..oo...oo...oo..',
      '...oo..oo..oo...',
      '....oo.oo.oo....',
      '.....oooooo.....',
      '.ooooooOOoooooo.',
      '.ooooooOOoooooo.',
      '.....oooooo.....',
      '....oo.oo.oo....',
      '...oo..oo..oo...',
      '..oo...oo...oo..',
      '.......oo.......',
      '.......oo.......',
      '................',
    ],
    alt: { 6: '.....oOOOOo.....', 7: '.oooooOOOOooooo.', 8: '.oooooOOOOooooo.', 9: '.....oOOOOo.....' },
  },
};

export interface Run {
  x: number;
  y: number;
  w: number;
  color: string;
}

/** Junta pixels vizinhos da mesma cor em retângulos horizontais. */
export function toRuns(def: SpriteDef, frame: 0 | 1): Run[] {
  const runs: Run[] = [];
  def.rows.forEach((base, y) => {
    const row = frame === 1 ? (def.alt[y] ?? base) : base;
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      let w = 1;
      while (row[x + w] === ch) w++;
      if (ch !== '.') runs.push({ x, y, w, color: def.palette[ch] ?? '#f0f' });
      x += w;
    }
  });
  return runs;
}

export const CARD_SHORT: Record<Character, string> = {
  senior: 'SÊNIOR',
  hacker: 'HACKER',
  qa: 'QA',
  devops: 'DEVOPS',
  fullstack: 'FULL',
  ia: 'IA',
};

export const CARD_ABILITY: Record<Character, string> = {
  senior: '+3 tokens',
  hacker: 'alvo perde 1',
  qa: 'barra Exploit',
  devops: 'rouba 2 tokens',
  fullstack: 'troca cartas',
  ia: 'copia uma ação',
};
