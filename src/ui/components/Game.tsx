'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { currentActor, legalCommands, toView } from '@/engine';
import type { Command, GameConfig, GameState, PlayerId } from '@/engine';
import { playSfx } from '@/lib/sounds';
import { useGame } from '../hooks/useGame';
import { bubbleFor } from '../text';
import { ActionPanel } from './ActionPanel';
import type { Choice } from './ActionPanel';
import { EventLog } from './EventLog';
import { ResponseModal } from './ResponseModal';
import { Rules } from './Rules';
import { Table } from './Table';
import { TokenFlights } from './TokenFlights';

interface Props {
  config: GameConfig;
  timer: boolean;
  sound: boolean;
  onToggleSound: () => void;
  onFinish: (state: GameState) => void;
  onQuit: () => void;
}

const HUMAN: PlayerId = 'p0';

export function Game({ config, timer, sound, onToggleSound, onFinish, onQuit }: Props) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [fast, setFast] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [bubbles, setBubbles] = useState<Record<PlayerId, { text: string; key: number } | undefined>>({});
  const [shaking, setShaking] = useState<Record<PlayerId, number | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const { state, batch, dispatch, thinking } = useGame(config, { paused: rulesOpen, fast });

  const view = useMemo(() => toView(state, HUMAN), [state]);
  const legal = useMemo(() => legalCommands(view), [view]);
  const name = (id: PlayerId) => view.players.find((p) => p.id === id)?.name ?? id;
  const actor = currentActor(view);
  const myMove = actor === HUMAN;
  const me = view.players.find((p) => p.id === HUMAN)!;
  const over = view.phase.kind === 'gameOver';

  const soundRef = useRef(sound);
  soundRef.current = sound;

  // efeitos por lote de eventos: balões, tremor e sons
  useEffect(() => {
    if (batch.events.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sfx = (n: Parameters<typeof playSfx>[0]) => soundRef.current && !fast && playSfx(n);
    let coin = false;
    for (const e of batch.events) {
      const b = bubbleFor(e);
      if (b) {
        setBubbles((prev) => ({ ...prev, [b.playerId]: { text: b.text, key: e.seq } }));
        timers.push(setTimeout(() => setBubbles((prev) => (prev[b.playerId]?.key === e.seq ? { ...prev, [b.playerId]: undefined } : prev)), 2600));
      }
      if (e.type === 'INFLUENCE_LOST') {
        setShaking((prev) => ({ ...prev, [e.playerId]: e.seq }));
        sfx('lose');
      } else if (e.type === 'TOKENS_MOVED' && !coin) {
        coin = true;
        sfx('coin');
      } else if (e.type === 'CHALLENGE_DECLARED') sfx('challenge');
      else if (e.type === 'BLOCK_DECLARED') sfx('block');
      else if (e.type === 'ACTION_DECLARED') sfx('declare');
      else if (e.type === 'TURN_STARTED' && e.playerId === HUMAN) sfx('turn');
      else if (e.type === 'GAME_OVER') sfx(e.winner === HUMAN ? 'win' : 'defeat');
    }
    // os timers dos balões não são cancelados no próximo lote de propósito
  }, [batch, fast]);

  useEffect(() => {
    if (!over) return;
    const t = setTimeout(() => onFinish(state), fast ? 300 : 1800);
    return () => clearTimeout(t);
  }, [over, state, onFinish, fast]);

  const send = (cmd: Command) => {
    setChoice(null);
    setError(dispatch(cmd));
  };

  const targets =
    choice && myMove
      ? legal.flatMap((c) => (c.type === 'ACTION' && c.action === choice.action && !!c.viaPrompt === choice.viaPrompt && c.target ? [c.target] : []))
      : [];

  let status: string;
  if (over) status = `${name((view.phase as { winner: PlayerId }).winner)} venceu.`;
  else if (myMove) status = 'Sua vez.';
  else if (actor) status = `Aguardando ${name(actor)}...`;
  else status = '';

  return (
    <div className="game">
      <header className="topbar">
        <h1 className="logo">&lt;/&gt; COUP: DEV EDITION</h1>
        <span className="topbar-info">
          turno {view.turn} · IA {view.iaMode === 'chaos' ? 'caos' : 'equilibrada'}
        </span>
        <nav className="topbar-actions">
          <button type="button" className="btn btn-sm" onClick={() => setRulesOpen(true)}>
            regras
          </button>
          <button type="button" className="btn btn-sm" onClick={onToggleSound} aria-pressed={sound}>
            som: {sound ? 'on' : 'off'}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onQuit}>
            sair
          </button>
        </nav>
      </header>

      <div className="game-body">
        <main className="game-main">
          <Table
            view={view}
            thinking={thinking}
            bubbles={bubbles}
            shaking={shaking}
            targets={targets}
            onTarget={(id) => {
              const cmd = legal.find((c) => c.type === 'ACTION' && c.action === choice?.action && !!c.viaPrompt === choice?.viaPrompt && c.target === id);
              if (cmd) send(cmd);
            }}
          />
          <div className="dock">
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {me.eliminated && !over ? (
              <section className="panel">
                <p className="panel-title">Você foi eliminado. Os bots continuam a partida.</p>
                <div className="btn-row">
                  <button type="button" className="btn btn-primary" onClick={() => setFast(true)} disabled={fast}>
                    {fast ? 'acelerando...' : 'pular para o fim'}
                  </button>
                </div>
              </section>
            ) : myMove && view.phase.kind === 'action' ? (
              <ActionPanel view={view} legal={legal} choice={choice} onChoice={setChoice} onCommand={send} />
            ) : (
              <section className="panel panel-idle" aria-live="polite">
                <p className="panel-title">{status}</p>
              </section>
            )}
          </div>
        </main>
        <aside className="game-side">
          <h2 className="side-title">~/log</h2>
          <EventLog log={view.log} name={name} />
        </aside>
      </div>

      {myMove && view.phase.kind !== 'action' && !rulesOpen && (
        <ResponseModal key={state.nextEventSeq} view={view} legal={legal} timer={timer} onCommand={send} />
      )}
      <TokenFlights batch={batch} />
      {rulesOpen && (
        <div className="modal-backdrop modal-solid">
          <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Regras">
            <Rules initialTab="characters" onClose={() => setRulesOpen(false)} closeLabel="voltar à partida" />
          </div>
        </div>
      )}
    </div>
  );
}
