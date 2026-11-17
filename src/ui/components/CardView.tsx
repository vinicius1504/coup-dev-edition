import { CHARACTERS } from '@/engine/constants';
import type { Character } from '@/engine/types';
import { CARD_ABILITY, CARD_SHORT } from '../sprites';
import { Sprite } from './Sprite';

interface Props {
  /** undefined = carta oculta de outro jogador (verso). */
  character?: Character;
  /** Influência perdida. */
  dead?: boolean;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  onClick?: () => void;
  label?: string;
}

export function CardView({ character, dead, size = 'md', selected, onClick, label }: Props) {
  const def = character ? CHARACTERS[character] : null;
  const cls = ['card', `card-${size}`, def ? 'is-up' : '', dead ? 'is-dead' : '', selected ? 'is-selected' : '', onClick ? 'is-click' : '']
    .filter(Boolean)
    .join(' ');
  const inner = (
    <span className="card-inner">
      <span className="card-face card-back" aria-hidden={!!def}>
        <span className="card-glyph">
          &lt;/&gt;<span className="card-cursor">_</span>
        </span>
      </span>
      <span className="card-face card-front" style={def ? { ['--c' as string]: def.color } : undefined} aria-hidden={!def}>
        {def && character && (
          <>
            <span className="card-art">
              <Sprite character={character} animated={!dead && size !== 'sm'} />
            </span>
            <span className="card-name">{size === 'sm' ? CARD_SHORT[character] : def.name}</span>
            {size === 'lg' && <span className="card-role">{CARD_ABILITY[character]}</span>}
          </>
        )}
      </span>
    </span>
  );
  const aria = label ?? (def ? `${def.name}${dead ? ' (perdida)' : ''}` : 'carta oculta');
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-label={aria} aria-pressed={selected}>
      {inner}
    </button>
  ) : (
    <span className={cls} role="img" aria-label={aria} title={def ? `${def.name}: ${CARD_ABILITY[character!]}` : undefined}>
      {inner}
    </span>
  );
}
