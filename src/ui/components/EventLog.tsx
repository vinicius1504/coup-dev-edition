'use client';

import { useEffect, useRef } from 'react';
import type { GameEvent } from '@/engine/types';
import { eventText } from '../text';
import type { Names } from '../text';

export function EventLog({ log, name }: { log: GameEvent[]; name: Names }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  return (
    <div className="log" ref={ref} role="log" aria-label="Log de eventos" tabIndex={0}>
      {log.map((e) => {
        const t = eventText(e, name);
        return t ? (
          <p key={e.seq} className={`log-line log-${t.tone}`}>
            {t.tone === 'turn' ? t.text : `> ${t.text}`}
          </p>
        ) : null;
      })}
    </div>
  );
}
