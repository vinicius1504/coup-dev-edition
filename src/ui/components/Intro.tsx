'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { GameConfig } from '@/engine/types';
import { playSfx } from '@/lib/sounds';

interface Props {
  config: GameConfig;
  sound: boolean;
  onDone: () => void;
}

const COMMAND = 'npm run coup';
const WALK_MS = 3000;
const STEP_MS = 430;

interface Node {
  id: string;
  label: string;
  depth: number;
  parent: string | null;
  folder?: boolean;
}

const TREE: Node[] = [
  { id: 'root', label: 'coup-dev-edition', depth: 0, parent: null, folder: true },
  { id: 'src', label: 'src', depth: 1, parent: 'root', folder: true },
  { id: 'app', label: 'app', depth: 2, parent: 'src', folder: true },
  { id: 'bots', label: 'bots', depth: 2, parent: 'src', folder: true },
  { id: 'bots/index.ts', label: 'index.ts', depth: 3, parent: 'bots' },
  { id: 'bots/knowledge.ts', label: 'knowledge.ts', depth: 3, parent: 'bots' },
  { id: 'engine', label: 'engine', depth: 2, parent: 'src', folder: true },
  { id: 'engine/constants.ts', label: 'constants.ts', depth: 3, parent: 'engine' },
  { id: 'engine/reducer.ts', label: 'reducer.ts', depth: 3, parent: 'engine' },
  { id: 'engine/types.ts', label: 'types.ts', depth: 3, parent: 'engine' },
  { id: 'ui', label: 'ui', depth: 2, parent: 'src', folder: true },
  { id: 'package.json', label: 'package.json', depth: 1, parent: 'root' },
];

const FILES: Record<string, string[]> = {
  'engine/types.ts': [
    "export type Character = 'senior' | 'hacker' | 'qa' | 'devops' | 'fullstack' | 'ia';",
    '',
    'export interface Player {',
    '  id: PlayerId;',
    '  tokens: number;',
    '  influences: Influence[];',
    '  eliminated: boolean;',
    '}',
  ],
  'engine/constants.ts': [
    'export const STARTING_TOKENS = 2;',
    'export const FORCED_DEPLOY_AT = 10;',
    'export const IA_CONTEXT_LIMIT = 2;',
    '',
    "  exploit: { name: 'Exploit', character: 'hacker', cost: 3 },",
    "  deploy: { name: 'Deploy na sexta', cost: 7 },",
  ],
  'engine/reducer.ts': [
    '/** Redutor puro: nunca muta `state`. */',
    'export function reduce(state: GameState, command: Command) {',
    '  const ctx = { s: structuredClone(state), events: [] };',
    '  apply(ctx, command);',
    '  return { ok: true, state: ctx.s, events: ctx.events };',
    '}',
  ],
  'bots/index.ts': [
    'export function decide(view: GameView, difficulty: BotDifficulty) {',
    '  const legal = legalCommands(view);',
    "  // 'Funciona na minha máquina.'",
    "  if (difficulty === 'easy') return easy(view, legal);",
    '  return smart(view, legal);',
    '}',
  ],
};

const TOKEN = /(\/\/.*|\/\*\*.*\*\/|'[^']*'|\b(?:export|function|const|return|if|interface|type)\b|\b\d+\b)/g;

function highlight(line: string): ReactNode[] {
  return line.split(TOKEN).map((part, i) => {
    if (!part) return null;
    let cls = '';
    if (part.startsWith('//') || part.startsWith('/**')) cls = 'c-com';
    else if (part.startsWith("'")) cls = 'c-str';
    else if (/^\d+$/.test(part)) cls = 'c-num';
    else if (/^(export|function|const|return|if|interface|type)$/.test(part)) cls = 'c-key';
    return cls ? (
      <span key={i} className={cls}>
        {part}
      </span>
    ) : (
      part
    );
  });
}

type Action = { target: string; run: () => void };

/** Abertura: anda até o PC, abre arquivos no editor, abre o terminal e roda o jogo. */
export function Intro({ config, sound, onDone }: Props) {
  // 0 = andando, 1 = editor, 4 = entrando na partida
  const [stage, setStage] = useState(0);
  const [expanded, setExpanded] = useState<string[]>(['root']);
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [terminal, setTerminal] = useState(false);
  const [typed, setTyped] = useState(0);
  const [lines, setLines] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0, shown: false, down: false });
  const hostRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const copies = config.copies ?? 3;
  const output = [
    '> coup-dev-edition@0.1.0 coup',
    `> embaralhando ${copies * 5 + 1} cartas...`,
    `> jogadores: ${config.players.map((p) => p.name).join(', ')}`,
    `> IA em modo ${config.iaMode === 'chaos' ? 'CAOS' : 'equilibrado'}`,
    '> distribuindo 2 influências e 2 tokens para cada um... ok',
    '▶ partida iniciada',
  ];
  const outputCount = output.length;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const sfx = (name: Parameters<typeof playSfx>[0]) => soundRef.current && playSfx(name);
    const open = (file: string) => {
      setTabs((t) => (t.includes(file) ? t : [...t, file]));
      setActive(file);
    };
    const expand = (id: string) => setExpanded((e) => [...e, id]);

    const actions: Action[] = [
      { target: 'src', run: () => expand('src') },
      { target: 'engine', run: () => expand('engine') },
      { target: 'engine/types.ts', run: () => open('engine/types.ts') },
      { target: 'engine/constants.ts', run: () => open('engine/constants.ts') },
      { target: 'engine/reducer.ts', run: () => open('engine/reducer.ts') },
      { target: 'bots', run: () => expand('bots') },
      { target: 'bots/index.ts', run: () => open('bots/index.ts') },
      { target: 'menu-terminal', run: () => setMenuOpen(true) },
      {
        target: 'new-terminal',
        run: () => {
          setMenuOpen(false);
          setTerminal(true);
        },
      },
    ];

    for (let t = 200; t < WALK_MS - 300; t += STEP_MS) at(t, () => sfx('step'));
    at(WALK_MS, () => setStage(1));

    // o cursor vai até cada alvo e clica
    const moveTo = (target: string) => {
      const host = hostRef.current;
      const el = host?.querySelector(`[data-intro="${target}"]`);
      if (!host || !el) return;
      const h = host.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setMouse({ x: r.left - h.left + Math.min(40, r.width / 2), y: r.top - h.top + r.height / 2, shown: true, down: false });
    };
    let t = WALK_MS + 700;
    for (const a of actions) {
      at(t, () => moveTo(a.target));
      at(t + 380, () => {
        setMouse((m) => ({ ...m, down: true }));
        sfx('key');
        a.run();
      });
      at(t + 520, () => setMouse((m) => ({ ...m, down: false })));
      t += 640;
    }

    const typeStart = t + 450;
    at(typeStart - 200, () => setMouse((m) => ({ ...m, shown: false })));
    for (let i = 1; i <= COMMAND.length; i++) {
      at(typeStart + i * 75, () => {
        setTyped(i);
        sfx('key');
      });
    }
    const outStart = typeStart + COMMAND.length * 75 + 350;
    for (let i = 1; i <= outputCount; i++) at(outStart + i * 260, () => setLines(i));
    const end = outStart + outputCount * 260 + 500;
    at(end, () => {
      setStage(4);
      sfx('turn');
    });
    at(end + 550, () => doneRef.current());
    return () => timers.forEach(clearTimeout);
  }, [outputCount]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        doneRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visible = (n: Node): boolean => !n.parent || (expanded.includes(n.parent) && visible(TREE.find((x) => x.id === n.parent)!));
  const code = active ? FILES[active]! : null;

  return (
    <div className={`intro intro-s${stage}`} aria-label="Abertura da partida" ref={hostRef}>
      <div className="intro-bob">
        <svg className="intro-room" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" aria-hidden>
          {/* parede e piso */}
          <rect width="320" height="122" fill="#131a28" />
          <rect y="122" width="320" height="58" fill="#0b0f17" />
          <rect y="120" width="320" height="2" fill="#232d42" />
          {[-200, -80, 20, 100, 160, 220, 300, 400, 520].map((x) => (
            <line key={x} x1="160" y1="122" x2={x} y2="180" stroke="#161d2b" strokeWidth="1" />
          ))}
          <rect y="140" width="320" height="1" fill="#161d2b" />
          <rect y="160" width="320" height="1" fill="#161d2b" />
          {/* janela com a cidade à noite */}
          <rect x="26" y="28" width="66" height="48" fill="#2b3648" />
          <rect x="29" y="31" width="60" height="42" fill="#070b14" />
          <rect x="58" y="31" width="2" height="42" fill="#2b3648" />
          <rect x="34" y="50" width="10" height="23" fill="#101a2e" />
          <rect x="46" y="42" width="9" height="31" fill="#0e1626" />
          <rect x="64" y="46" width="12" height="27" fill="#101a2e" />
          <rect x="78" y="56" width="8" height="17" fill="#0e1626" />
          {[[36, 54], [40, 60], [48, 46], [50, 56], [66, 50], [71, 58], [68, 64], [80, 60], [37, 66]].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="2" height="2" fill="#f5c542" />
          ))}
          <rect x="74" y="35" width="3" height="3" fill="#cfe8ff" />
          {/* pôster */}
          <rect x="236" y="34" width="44" height="34" fill="#1a2230" stroke="#39ff14" strokeWidth="1" />
          <text x="258" y="56" textAnchor="middle" fontSize="13" fontWeight="700" fill="#39ff14" fontFamily="monospace">
            &lt;/&gt;
          </text>
          {/* luz do monitor na parede */}
          <rect x="118" y="62" width="84" height="56" fill="#39ff14" opacity="0.05" />
          <rect x="126" y="70" width="68" height="44" fill="#39ff14" opacity="0.05" />
          {/* mesa */}
          <rect x="96" y="114" width="128" height="6" fill="#6b4a30" />
          <rect x="96" y="120" width="128" height="2" fill="#4a3220" />
          <rect x="100" y="122" width="5" height="34" fill="#3a2718" />
          <rect x="215" y="122" width="5" height="34" fill="#3a2718" />
          {/* gabinete */}
          <rect x="204" y="92" width="14" height="22" fill="#1a2230" stroke="#2b3648" strokeWidth="1" />
          <rect className="intro-led" x="207" y="96" width="2" height="2" fill="#39ff14" />
          <rect x="207" y="102" width="8" height="1" fill="#2b3648" />
          <rect x="207" y="105" width="8" height="1" fill="#2b3648" />
          {/* caneca e planta */}
          <rect x="112" y="107" width="7" height="7" fill="#e8e8f0" />
          <rect x="119" y="109" width="2" height="3" fill="#e8e8f0" />
          <rect x="113" y="108" width="5" height="1" fill="#6b3e1e" />
          <rect x="102" y="104" width="6" height="10" fill="#7a4a3a" />
          <rect x="100" y="96" width="4" height="8" fill="#3d7a1f" />
          <rect x="104" y="92" width="3" height="12" fill="#57a52c" />
          <rect x="107" y="98" width="3" height="6" fill="#3d7a1f" />
          {/* monitor */}
          <rect x="157" y="108" width="6" height="5" fill="#2b3648" />
          <rect x="150" y="112" width="20" height="2" fill="#2b3648" />
          <rect x="133" y="74" width="54" height="35" fill="#2b3648" />
          <rect x="135" y="76" width="50" height="31" fill="#0a0d12" />
          <rect x="137" y="78" width="46" height="2" fill="#1a2230" />
          <rect x="137" y="82" width="8" height="23" fill="#111722" />
          <rect x="147" y="83" width="16" height="1" fill="#39ff14" />
          <rect x="147" y="86" width="24" height="1" fill="#7fd4ff" />
          <rect x="149" y="89" width="20" height="1" fill="#c9d4e3" />
          <rect x="149" y="92" width="12" height="1" fill="#f5c542" />
          <rect x="147" y="95" width="6" height="1" fill="#c9d4e3" />
          <rect x="147" y="99" width="36" height="1" fill="#2b3648" />
          <rect x="147" y="102" width="10" height="1" fill="#39ff14" />
          <rect className="intro-cursor" x="158" y="101" width="2" height="3" fill="#39ff14" />
          {/* teclado e mouse */}
          <rect x="143" y="115" width="34" height="3" fill="#1a2230" />
          <rect x="145" y="116" width="30" height="1" fill="#2b3648" />
          <rect x="182" y="115" width="5" height="3" fill="#1a2230" />
          {/* cadeira, em primeiro plano */}
          <rect x="128" y="136" width="64" height="44" fill="#080b11" />
          <rect x="132" y="132" width="56" height="6" fill="#0d121b" />
        </svg>
      </div>

      <div className="intro-editor" aria-hidden={stage < 1}>
        <div className="ed-title">
          <span className="ed-dots">
            <i /> <i /> <i />
          </span>
          <span className="ed-menu">
            <span>Arquivo</span>
            <span>Editar</span>
            <span>Ver</span>
            <span className={`ed-menu-item ${menuOpen ? 'is-on' : ''}`} data-intro="menu-terminal">
              Terminal
              {menuOpen && (
                <span className="ed-dropdown">
                  <span data-intro="new-terminal">Novo Terminal</span>
                  <span>Dividir Terminal</span>
                  <span>Executar Tarefa...</span>
                </span>
              )}
            </span>
            <span>Ajuda</span>
          </span>
          <span className="ed-name">{active ? `${active.split('/').pop()} — ` : ''}coup-dev-edition</span>
        </div>
        <div className="ed-body">
          <div className="ed-activity">
            <i className="is-on" /> <i /> <i /> <i />
          </div>
          <div className="ed-side">
            <p className="ed-side-title">EXPLORADOR</p>
            {TREE.filter(visible).map((n) => (
              <p
                key={n.id}
                data-intro={n.id}
                className={`ed-node ${active === n.id ? 'is-open' : ''}`}
                style={{ paddingLeft: `${n.depth * 14 + 4}px` }}
              >
                {n.folder ? (expanded.includes(n.id) ? '▾ ' : '▸ ') : '  '}
                {n.label}
              </p>
            ))}
          </div>
          <div className="ed-main">
            <div className="ed-tabs">
              {tabs.map((f) => (
                <span key={f} className={f === active ? 'is-on' : ''}>
                  {f.split('/').pop()}
                </span>
              ))}
            </div>
            {code ? (
              <pre className="ed-code" key={active}>
                {code.map((l, i) => (
                  <span className="ed-line" key={i}>
                    <span className="ed-ln">{i + 1}</span>
                    {highlight(l)}
                    {'\n'}
                  </span>
                ))}
              </pre>
            ) : (
              <div className="ed-welcome">
                <p className="ed-logo">&lt;/&gt;</p>
                <p>Abra um arquivo para começar</p>
              </div>
            )}
            <div className={`ed-term ${terminal ? 'is-open' : ''}`}>
              <p className="ed-term-title">
                <span className="is-on">TERMINAL</span>
                <span>PROBLEMAS</span>
                <span>SAÍDA</span>
              </p>
              <p>
                <span className="t-prompt">~/coup-dev-edition $</span> {COMMAND.slice(0, typed)}
                {lines === 0 && <span className="t-cursor">█</span>}
              </p>
              {output.slice(0, lines).map((l, i) => (
                <p key={l} className={i === output.length - 1 ? 't-go' : 't-out'}>
                  {l}
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="ed-status">
          <span>⎇ main</span>
          <span>0 erros</span>
          <span className="ed-status-right">TypeScript · UTF-8</span>
        </div>
      </div>

      {mouse.shown && (
        <span className={`intro-mouse ${mouse.down ? 'is-down' : ''}`} style={{ transform: `translate(${mouse.x}px, ${mouse.y}px)` }} aria-hidden>
          <svg viewBox="0 0 12 18" shapeRendering="crispEdges">
            <path d="M0 0h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v2h-4v1h1v2h1v2h-2v1h-1v-1h-1v-2h-1v-2h-1v1h-1v1h-1v1h-1z" fill="#000" />
            <path d="M1 2h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h-4v1h1v2h1v2h-1v-2h-1v-2h-1v-1h-1v1h-1v1h-1v1h-1z" fill="#fff" />
          </svg>
        </span>
      )}

      <div className="intro-flash" aria-hidden />
      <button type="button" className="btn btn-sm intro-skip" onClick={onDone}>
        pular (Esc)
      </button>
    </div>
  );
}
