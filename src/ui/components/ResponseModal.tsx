'use client';

import { useEffect, useRef, useState } from 'react';
import { ACTIONS, BLOCK_NAMES, CHARACTERS } from '@/engine/constants';
import type { CardId, Character, Command, GameView, PlayerId } from '@/engine/types';
import { ACTION_EFFECT, describeAction } from '../text';
import { CardView } from './CardView';

interface Props {
  view: GameView;
  legal: Command[];
  timer: boolean;
  onCommand: (c: Command) => void;
}

const TIMER_SECONDS = 10;

const REASONS = {
  challengeLost: 'Você perdeu o desafio.',
  bluffCaught: 'Seu blefe foi pego.',
  exploit: 'Você sofreu um Exploit.',
  deploy: 'Fizeram Deploy na sexta em você.',
} as const;

/** Janela modal para as respostas do humano: desafio, bloqueio, perda de influência e Refactor. */
export function ResponseModal({ view, legal, timer, onCommand }: Props) {
  const ph = view.phase;
  const pa = view.pending;
  const me = view.viewer;
  const self = view.players.find((p) => p.id === me)!;
  const hand = self.influences.filter((i) => !i.revealed);
  const name = (id: PlayerId) => view.players.find((p) => p.id === id)!.name;
  const [keep, setKeep] = useState<CardId[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const isWindow = ph.kind === 'actionChallenge' || ph.kind === 'block' || ph.kind === 'blockChallenge';
  const passCmd = legal.find((c) => c.type === 'PASS');
  const [left, setLeft] = useState(TIMER_SECONDS);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    if (!timer || !isWindow || !passCmd) return;
    const started = Date.now();
    const t = setInterval(() => {
      const remaining = TIMER_SECONDS - (Date.now() - started) / 1000;
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(t);
        onCommandRef.current(passCmd);
      }
    }, 100);
    return () => clearInterval(t);
    // o modal é remontado a cada janela (key no pai), então roda uma vez por janela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let title = '';
  let body: React.ReactNode = null;

  if ((ph.kind === 'actionChallenge' || ph.kind === 'blockChallenge') && pa) {
    const onBlock = ph.kind === 'blockChallenge';
    const claimant = onBlock ? pa.block!.blocker : pa.actor;
    const character = onBlock ? pa.block!.character : pa.claim!;
    const def = CHARACTERS[character];
    const iHold = hand.filter((i) => i.character === character).length;
    title = 'Desafiar?';
    body = (
      <>
        <p>
          {onBlock ? (
            <>
              <b>{name(claimant)}</b> bloqueia {ACTIONS[pa.type].name} com “{BLOCK_NAMES[character]}”
            </>
          ) : (
            <>
              <b>{describeAction(pa, name)}</b> ({ACTION_EFFECT[pa.type]})
            </>
          )}{' '}
          e alega ter{' '}
          <b style={{ color: def.color }}>
            {def.icon} {def.name}
          </b>
          .
        </p>
        <p className="hint">
          Se for blefe, {name(claimant)} perde 1 influência. Se a carta existir, quem perde é você.
          {iHold > 0 ? ` Você tem ${iHold} ${def.name} na mão.` : ''}
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn-danger" onClick={() => onCommand({ type: 'CHALLENGE', playerId: me })}>
            Desafiar: “Você não tem essa carta!”
          </button>
          <button type="button" className="btn" onClick={() => onCommand(passCmd!)}>
            Passar
          </button>
        </div>
      </>
    );
  } else if (ph.kind === 'block' && pa) {
    title = 'Bloquear?';
    body = (
      <>
        <p>
          <b>{describeAction(pa, name)}</b> ({ACTION_EFFECT[pa.type]}).
        </p>
        <p className="hint">Alegue um personagem para bloquear. Se você não tiver a carta, é blefe e pode ser desafiado.</p>
        <div className="btn-row">
          {ACTIONS[pa.type].blockedBy.map((c: Character) => {
            const real = hand.some((i) => i.character === c);
            return (
              <button
                key={c}
                type="button"
                className="btn btn-action"
                style={{ ['--c' as string]: CHARACTERS[c].color }}
                onClick={() => onCommand({ type: 'BLOCK', playerId: me, character: c })}
              >
                <span className="btn-main">{BLOCK_NAMES[c]}</span>
                <span className="btn-sub">alega {CHARACTERS[c].name}</span>
                <span className={`tag ${real ? 'tag-real' : 'tag-bluff'}`}>{real ? 'você tem' : 'blefe'}</span>
              </button>
            );
          })}
          <button type="button" className="btn" onClick={() => onCommand(passCmd!)}>
            Não bloquear
          </button>
        </div>
      </>
    );
  } else if (ph.kind === 'loseInfluence') {
    title = 'Perder influência';
    body = (
      <>
        <p>{REASONS[ph.reason]} Escolha qual carta revelar.</p>
        <div className="card-row">
          {hand.map((i) => (
            <CardView
              key={i.cardId}
              character={i.character}
              size="lg"
              onClick={() => onCommand({ type: 'LOSE_INFLUENCE', playerId: me, cardId: i.cardId })}
              label={`Revelar ${CHARACTERS[i.character!].name}`}
            />
          ))}
        </div>
      </>
    );
  } else if (ph.kind === 'exchange') {
    const pool = [...hand.map((i) => ({ id: i.cardId, character: i.character!, from: 'mão' })), ...ph.drawn.map((c) => ({ id: c.id, character: c.character, from: 'baralho' }))];
    const need = hand.length;
    const toggle = (id: CardId) => setKeep((k) => (k.includes(id) ? k.filter((x) => x !== id) : k.length < need ? [...k, id] : k));
    title = 'Refactor';
    body = (
      <>
        <p>
          Escolha {need} carta{need > 1 ? 's' : ''} para manter. O resto volta ao baralho.
        </p>
        <div className="card-row">
          {pool.map((c) => (
            <div className="card-pick" key={c.id}>
              <CardView character={c.character} size="lg" selected={keep.includes(c.id)} onClick={() => toggle(c.id)} label={`${CHARACTERS[c.character].name} (${c.from})`} />
              <span className="hint">{c.from}</span>
            </div>
          ))}
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" disabled={keep.length !== need} onClick={() => onCommand({ type: 'EXCHANGE', playerId: me, keep })}>
            Manter {keep.length}/{need}
          </button>
        </div>
      </>
    );
  } else {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <h2 className="modal-title">{title}</h2>
        {body}
        {timer && isWindow && (
          <div className="timer" aria-label={`${Math.ceil(left)} segundos para responder`}>
            <div className="timer-bar" style={{ width: `${(left / TIMER_SECONDS) * 100}%` }} />
            <span>{Math.ceil(left)}s e você passa</span>
          </div>
        )}
      </div>
    </div>
  );
}
