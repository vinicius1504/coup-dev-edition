'use client';

import { useEffect, useRef } from 'react';
import type { EventBatch } from '../hooks/useGame';

function center(id: string): { x: number; y: number } | null {
  const el = document.querySelector(`[data-anchor="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Anima moedas voando entre jogadores e tesouro a cada TOKENS_MOVED. */
export function TokenFlights({ batch }: { batch: EventBatch }) {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = layer.current;
    if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const e of batch.events) {
      if (e.type !== 'TOKENS_MOVED') continue;
      const a = center(e.from);
      const b = center(e.to);
      if (!a || !b) continue;
      for (let i = 0; i < Math.min(e.amount, 7); i++) {
        const coin = document.createElement('span');
        coin.className = 'coin coin-fly';
        host.appendChild(coin);
        const jitter = (i - (Math.min(e.amount, 7) - 1) / 2) * 10;
        const anim = coin.animate(
          [
            { transform: `translate(${a.x + jitter}px, ${a.y}px) scale(1)`, opacity: 1 },
            { transform: `translate(${(a.x + b.x) / 2 + jitter}px, ${(a.y + b.y) / 2 - 40}px) scale(1.4)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${b.x}px, ${b.y}px) scale(1)`, opacity: 0.2 },
          ],
          { duration: 650, delay: i * 80, easing: 'steps(12)', fill: 'backwards' },
        );
        anim.onfinish = () => coin.remove();
        anim.oncancel = () => coin.remove();
      }
    }
  }, [batch]);
  return <div className="fly-layer" ref={layer} aria-hidden />;
}
