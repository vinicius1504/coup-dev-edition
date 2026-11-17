import { CHARACTERS } from '@/engine/constants';
import type { Character } from '@/engine/types';

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
        <span className="card-glyph">&lt;/&gt;</span>
      </span>
      <span className="card-face card-front" style={def ? { ['--c' as string]: def.color } : undefined} aria-hidden={!def}>
        {def && (
          <>
            <span className="card-icon">{def.icon}</span>
            <span className="card-name">{def.name}</span>
            {size !== 'sm' && <span className="card-role">{def.role}</span>}
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
    <span className={cls} role="img" aria-label={aria}>
      {inner}
    </span>
  );
}
