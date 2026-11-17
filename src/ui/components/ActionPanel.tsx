'use client';

import { useState } from 'react';
import { ACTIONS, CHARACTERS, FORCED_DEPLOY_AT, PROMPT_ACTIONS } from '@/engine/constants';
import type { ActionType, Character, Command, GameView, PlayerId } from '@/engine/types';
import { ACTION_EFFECT } from '../text';

export interface Choice {
  action: ActionType;
  viaPrompt: boolean;
}

interface Props {
  view: GameView;
  legal: Command[];
  choice: Choice | null;
  onChoice: (c: Choice | null) => void;
  onCommand: (c: Command) => void;
}

const GENERAL: ActionType[] = ['commit', 'foreignAid', 'deploy'];
const BY_CHARACTER: ActionType[] = ['codeReview', 'exploit', 'takedown', 'refactor'];

export function ActionPanel({ view, legal, choice, onChoice, onCommand }: Props) {
  const [prompt, setPrompt] = useState(false);
  const self = view.players.find((p) => p.id === view.viewer)!;
  const hand = self.influences.filter((i) => !i.revealed).map((i) => i.character) as Character[];
  const mustDeploy = self.tokens >= FORCED_DEPLOY_AT;
  const fee = view.iaMode === 'chaos' ? 0 : 1;
  const name = (id: PlayerId) => view.players.find((p) => p.id === id)!.name;

  const can = (action: ActionType, viaPrompt: boolean) =>
    legal.some((c) => c.type === 'ACTION' && c.action === action && !!c.viaPrompt === viaPrompt);

  const pickAction = (action: ActionType, viaPrompt: boolean) => {
    if (ACTIONS[action].needsTarget) onChoice({ action, viaPrompt });
    else onCommand({ type: 'ACTION', playerId: view.viewer, action, ...(viaPrompt ? { viaPrompt } : {}) });
  };

  if (choice) {
    const targets = legal.filter(
      (c): c is Extract<Command, { type: 'ACTION' }> => c.type === 'ACTION' && c.action === choice.action && !!c.viaPrompt === choice.viaPrompt,
    );
    return (
      <section className="panel" aria-label="Escolha o alvo">
        <p className="panel-title">
          {ACTIONS[choice.action].name}
          {choice.viaPrompt ? ' via Prompt' : ''}: escolha o alvo
        </p>
        <div className="btn-row">
          {targets.map((c) => (
            <button key={c.target} type="button" className="btn btn-danger" onClick={() => onCommand(c)}>
              {name(c.target!)}
            </button>
          ))}
          <button type="button" className="btn btn-ghost" onClick={() => onChoice(null)}>
            cancelar
          </button>
        </div>
      </section>
    );
  }

  const button = (action: ActionType, viaPrompt: boolean) => {
    const def = ACTIONS[action];
    const claim: Character | null = viaPrompt ? 'ia' : def.character;
    const bluff = claim !== null && !hand.includes(claim);
    const cost = def.cost + (viaPrompt ? fee : 0);
    const color = claim ? CHARACTERS[claim].color : undefined;
    return (
      <button
        key={action + String(viaPrompt)}
        type="button"
        className="btn btn-action"
        style={color ? { ['--c' as string]: color } : undefined}
        disabled={!can(action, viaPrompt)}
        onClick={() => pickAction(action, viaPrompt)}
      >
        <span className="btn-main">
          {def.name}
          {cost > 0 ? ` (-${cost})` : ''}
        </span>
        <span className="btn-sub">{ACTION_EFFECT[action]}</span>
        {claim && <span className={`tag ${bluff ? 'tag-bluff' : 'tag-real'}`}>{bluff ? 'blefe' : `tem ${CHARACTERS[claim].name}`}</span>}
      </button>
    );
  };

  return (
    <section className="panel" aria-label="Suas ações">
      <p className="panel-title">
        Seu turno.{' '}
        {mustDeploy ? `Você tem ${self.tokens} tokens: Deploy na sexta é obrigatório.` : 'Escolha uma ação. Alegar um personagem que você não tem é blefe.'}
      </p>
      <div className="panel-group">
        <span className="panel-label">gerais</span>
        <div className="btn-row">{GENERAL.map((a) => button(a, false))}</div>
      </div>
      <div className="panel-group">
        <span className="panel-label">
          personagem
          <label className="toggle">
            <input type="checkbox" checked={prompt} onChange={(e) => setPrompt(e.target.checked)} disabled={mustDeploy} />
            via Prompt da IA{fee > 0 ? ` (+${fee} token)` : ' (grátis no Caos)'}
          </label>
        </span>
        <div className="btn-row">{(prompt ? [...PROMPT_ACTIONS] : BY_CHARACTER).map((a) => button(a, prompt))}</div>
      </div>
    </section>
  );
}
