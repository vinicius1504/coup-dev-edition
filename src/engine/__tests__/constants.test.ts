import { describe, expect, it } from 'vitest';
import { ACTIONS, ALL_CHARACTERS, CHARACTERS, DECK_SIZE, PROMPT_ACTIONS } from '../constants';

describe('constantes do jogo', () => {
  it('o baralho tem 16 cartas', () => {
    expect(DECK_SIZE).toBe(16);
  });

  it('todo personagem tem cor e ícone próprios', () => {
    const colors = new Set(ALL_CHARACTERS.map((c) => CHARACTERS[c].color));
    const icons = new Set(ALL_CHARACTERS.map((c) => CHARACTERS[c].icon));
    expect(colors.size).toBe(6);
    expect(icons.size).toBe(6);
  });

  it('a IA (Alucinação) bloqueia toda ação bloqueável', () => {
    for (const def of Object.values(ACTIONS)) {
      expect(def.blockedBy.includes('ia')).toBe(def.blockScope !== 'none');
    }
  });

  it('o Prompt só copia ações de personagem', () => {
    for (const a of PROMPT_ACTIONS) expect(ACTIONS[a].character).not.toBeNull();
  });
});
