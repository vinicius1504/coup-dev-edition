'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { decide, thinkingTime } from '@/bots';
import { createGame, currentActor, getPlayer, makeRng, reduce, toView } from '@/engine';
import type { Command, GameConfig, GameEvent, GameState } from '@/engine';

export interface EventBatch {
  id: number;
  events: GameEvent[];
}

interface Options {
  /** Congela os bots (ex.: tela de regras aberta). */
  paused: boolean;
  /** Bots sem tempo de "pensando" (pular para o fim). */
  fast: boolean;
}

/** Liga a engine pura ao React e conduz os bots. */
export function useGame(config: GameConfig, { paused, fast }: Options) {
  const [state, setState] = useState<GameState>(() => createGame(config));
  const [batch, setBatch] = useState<EventBatch>({ id: 0, events: [] });
  const stateRef = useRef(state);
  const rand = useMemo(() => makeRng(config.seed ^ 0x5bd1e995), [config.seed]);

  const dispatch = useCallback((cmd: Command): string | null => {
    const r = reduce(stateRef.current, cmd);
    if (!r.ok) return r.message;
    stateRef.current = r.state;
    setState(r.state);
    setBatch((b) => ({ id: b.id + 1, events: r.events }));
    return null;
  }, []);

  const actorId = currentActor(state);
  const botId = actorId && getPlayer(state, actorId).kind === 'bot' ? actorId : null;

  useEffect(() => {
    if (!botId || paused) return;
    const s = stateRef.current;
    const cmd = decide(toView(s, botId), getPlayer(s, botId).difficulty ?? 'medium', rand);
    // passar numa janela é rápido; qualquer decisão de verdade leva 0,5 a 1,5s
    const delay = fast ? 0 : cmd.type === 'PASS' ? 300 + rand() * 300 : thinkingTime(rand);
    const t = setTimeout(() => dispatch(cmd), delay);
    return () => clearTimeout(t);
  }, [state, botId, paused, fast, rand, dispatch]);

  return { state, batch, dispatch, thinking: paused ? null : botId };
}
