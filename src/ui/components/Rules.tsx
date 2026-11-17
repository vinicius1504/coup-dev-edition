'use client';

import { useState } from 'react';
import { ACTIONS, BLOCK_NAMES, CHARACTERS } from '@/engine/constants';
import type { ActionType, Character } from '@/engine/types';
import { ACTION_EFFECT } from '../text';
import { CardView } from './CardView';

export type RulesTab = 'tutorial' | 'characters' | 'actions' | 'challenges' | 'ia';

const TABS: [RulesTab, string][] = [
  ['tutorial', 'tutorial'],
  ['characters', 'personagens'],
  ['actions', 'ações'],
  ['challenges', 'desafios'],
  ['ia', 'IA'],
];

const ABILITIES: Record<Character, { action?: ActionType; blocks?: string; copies: string }> = {
  senior: { action: 'codeReview', blocks: 'Ajuda Externa de qualquer jogador', copies: '3 cópias' },
  hacker: { action: 'exploit', copies: '3 cópias' },
  qa: { blocks: 'Exploit direcionado a você', copies: '3 cópias' },
  devops: { action: 'takedown', blocks: 'Derrubar servidor direcionado a você', copies: '3 cópias' },
  fullstack: { action: 'refactor', blocks: 'Derrubar servidor direcionado a você', copies: '3 cópias' },
  ia: { blocks: 'Ajuda Externa, Exploit e Derrubar servidor', copies: 'carta única' },
};

export function Rules({ initialTab, onClose, closeLabel }: { initialTab: RulesTab; onClose: () => void; closeLabel: string }) {
  const [tab, setTab] = useState<RulesTab>(initialTab);
  return (
    <div className="rules">
      <div className="rules-head">
        <h2 className="modal-title">man coup</h2>
        <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'is-on' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="rules-body" role="tabpanel">
        {tab === 'tutorial' && (
          <ol className="steps">
            <li>
              <b>Objetivo.</b> O baralho tem 3 cópias de cada personagem (ou jogadores − 1, no baralho proporcional) mais 1 IA. Você começa com 2 cartas (influências) viradas para baixo e 2 tokens. Vence quem for o último com pelo menos 1 carta.
            </li>
            <li>
              <b>No seu turno, escolha 1 ação.</b> Ações gerais não precisam de carta. Ações de personagem exigem que você <i>alegue</i> ter a carta. Você pode
              mentir.
            </li>
            <li>
              <b>Qualquer um pode desafiar a alegação.</b> Se você tinha a carta, o desafiante perde 1 influência e você troca a carta por outra do baralho. Se
              não tinha, você perde 1 influência e a ação é cancelada.
            </li>
            <li>
              <b>Algumas ações podem ser bloqueadas.</b> Bloquear também é alegar uma carta, então o bloqueio também pode ser desafiado.
            </li>
            <li>
              <b>Junte 7 tokens e faça Deploy na sexta.</b> O alvo perde 1 influência, sem desafio e sem bloqueio. Com 10 ou mais tokens, o Deploy é obrigatório.
            </li>
            <li>
              <b>Leia a mesa.</b> O painel marca suas ações como “blefe” ou “tem a carta”. O log lateral mostra tudo o que foi alegado e revelado: use isso para
              decidir quando desafiar.
            </li>
          </ol>
        )}
        {tab === 'characters' && (
          <div className="char-grid">
            {(Object.keys(CHARACTERS) as Character[]).map((c) => {
              const def = CHARACTERS[c];
              const ab = ABILITIES[c];
              return (
                <article className="char" key={c} style={{ ['--c' as string]: def.color }}>
                  <CardView character={c} size="lg" />
                  <div>
                    <h3>
                      {def.name} <small>({def.role}, {ab.copies})</small>
                    </h3>
                    {c === 'ia' ? (
                      <p>
                        <b>Prompt:</b> copia Code Review, Exploit, Derrubar servidor ou Refactor.
                      </p>
                    ) : ab.action ? (
                      <p>
                        <b>{ACTIONS[ab.action].name}:</b> {ACTION_EFFECT[ab.action]}.
                      </p>
                    ) : (
                      <p>Sem ação própria.</p>
                    )}
                    {ab.blocks && (
                      <p>
                        <b>“{BLOCK_NAMES[c]}”:</b> bloqueia {ab.blocks}.
                      </p>
                    )}
                    <p className="quote">“{def.quote}”</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {tab === 'actions' && (
          <div className="table-scroll">
            <table className="rules-table">
              <thead>
                <tr>
                  <th>ação</th>
                  <th>alega</th>
                  <th>efeito</th>
                  <th>bloqueada por</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(ACTIONS) as ActionType[]).map((a) => {
                  const def = ACTIONS[a];
                  return (
                    <tr key={a}>
                      <td>{def.name}</td>
                      <td>{def.character ? CHARACTERS[def.character].name : 'ninguém'}</td>
                      <td>{ACTION_EFFECT[a]}</td>
                      <td>{def.blockedBy.length ? def.blockedBy.map((c) => CHARACTERS[c].name).join(', ') : 'não bloqueável'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="hint">Commit e Deploy na sexta não podem ser desafiados nem bloqueados. Com 10+ tokens no início do turno, o Deploy é obrigatório.</p>
          </div>
        )}
        {tab === 'challenges' && (
          <ul className="steps">
            <li>As janelas correm em ordem de turno, a partir de quem vem depois do jogador da ação. O primeiro que desafiar ou bloquear tem prioridade.</li>
            <li>Primeiro todos decidem se desafiam a ação. Só depois o alvo decide se bloqueia (na Ajuda Externa, qualquer um pode bloquear).</li>
            <li>
              <b>Tokens:</b> todo custo é pago ao declarar. Se você perde o desafio à sua ação, o custo dela volta (os 3 do Exploit). Se a ação é bloqueada, não
              volta nada. A taxa do Prompt nunca volta.
            </li>
            <li>Quem perde influência escolhe qual carta revelar. Com 1 carta só, ela é revelada direto.</li>
            <li>
              Dá para perder 2 influências no mesmo ciclo: desafie um Exploit verdadeiro contra você e perca; se depois não bloquear, o Exploit leva a segunda
              carta.
            </li>
            <li>Jogador eliminado devolve os tokens ao tesouro.</li>
          </ul>
        )}
        {tab === 'ia' && (
          <ul className="steps">
            <li>
              <b>Prompt:</b> alegue a IA para executar a ação de outro personagem. Alvo e bloqueios seguem a ação copiada. O que se desafia é “eu tenho a IA”.
            </li>
            <li>
              <b>Custo:</b> 1 token extra, pago antes (Prompt + Exploit = 4 tokens).
            </li>
            <li>
              <b>Alucinação:</b> a IA bloqueia Ajuda Externa, Exploit e Derrubar servidor. Pode ser desafiada.
            </li>
            <li>
              <b>Limite de contexto:</b> depois de 2 Prompts com a mesma carta, a IA volta ao baralho em segredo e você compra outra carta. Prompt blefado não
              conta, e a contagem zera quando a carta volta ao baralho.
            </li>
            <li>
              <b>Modo Caos:</b> o Prompt é grátis, mas depois de usar você revela a IA para todos e ela é embaralhada de volta ao baralho.
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
