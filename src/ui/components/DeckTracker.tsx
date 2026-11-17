import { ALL_CHARACTERS, CHARACTERS } from '@/engine/constants';
import type { GameView } from '@/engine/types';
import { Sprite } from './Sprite';

/** Contador de cartas: quantas cópias de cada personagem existem, quantas já saíram e quantas estão na sua mão. */
export function DeckTracker({ view }: { view: GameView }) {
  return (
    <div className="tracker" aria-label="Cartas em jogo">
      {ALL_CHARACTERS.map((c) => {
        const def = CHARACTERS[c];
        const total = c === 'ia' ? 1 : view.copies;
        let out = 0;
        let mine = 0;
        for (const p of view.players) {
          for (const i of p.influences) {
            if (i.character !== c) continue;
            if (i.revealed) out++;
            else if (p.id === view.viewer) mine++;
          }
        }
        const pips = Array.from({ length: total }, (_, i) => (i < out ? 'is-out' : i < out + mine ? 'is-mine' : ''));
        return (
          <div className="tracker-row" key={c} style={{ ['--c' as string]: def.color }} aria-label={`${def.name}: ${total - out} de ${total} em jogo, ${mine} na sua mão`}>
            <span className="tracker-art">
              <Sprite character={c} animated={false} />
            </span>
            <span className="tracker-name">{def.name}</span>
            <span className="pips" aria-hidden>
              {pips.map((cls, i) => (
                <span key={i} className={`pip ${cls}`} />
              ))}
            </span>
            <span className="tracker-count" aria-hidden>
              {total - out}/{total}
            </span>
          </div>
        );
      })}
      <p className="tracker-legend">cheio = na sua mão · riscado = já revelada</p>
    </div>
  );
}
