import type { Character } from '@/engine/types';
import { SPRITES, SPRITE_SIZE, toRuns } from '../sprites';

export function Sprite({ character, animated = true }: { character: Character; animated?: boolean }) {
  const def = SPRITES[character];
  const frame = (f: 0 | 1) => toRuns(def, f).map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.color} />);
  return (
    <svg className={`sprite ${animated ? 'is-animated' : ''}`} viewBox={`0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}`} shapeRendering="crispEdges" aria-hidden>
      <g className="sprite-f1">{frame(0)}</g>
      {animated && <g className="sprite-f2">{frame(1)}</g>}
    </svg>
  );
}
