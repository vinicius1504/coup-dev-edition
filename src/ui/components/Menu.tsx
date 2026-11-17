'use client';

import type { Settings } from '@/lib/settings';
import { CardView } from './CardView';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onStart: () => void;
  onRules: (tab: 'tutorial' | 'characters') => void;
}

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      <div className="seg">
        {options.map(([v, text]) => (
          <button key={String(v)} type="button" className={`seg-btn ${v === value ? 'is-on' : ''}`} aria-pressed={v === value} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Menu({ settings, onChange, onStart, onRules }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  return (
    <main className="menu">
      <div className="menu-hero">
        <div className="menu-cards" aria-hidden>
          <CardView character="hacker" size="md" />
          <CardView size="md" />
          <CardView character="ia" size="md" />
        </div>
        <h1 className="title">
          COUP<span className="title-sub">DEV EDITION</span>
        </h1>
        <p className="tagline">Blefe, dedução e deploy na sexta.</p>
      </div>

      <form
        className="menu-form"
        onSubmit={(e) => {
          e.preventDefault();
          onStart();
        }}
      >
        <label className="field">
          <span className="field-label">seu nome</span>
          <input className="input" value={settings.name} maxLength={12} onChange={(e) => set('name', e.target.value)} spellCheck={false} />
        </label>
        <Segmented
          label={`jogadores: você + ${settings.bots} bot${settings.bots > 1 ? 's' : ''}`}
          value={settings.bots + 1}
          options={[2, 3, 4, 5, 6].map((n) => [n, String(n)] as [number, string])}
          onChange={(n) => set('bots', n - 1)}
        />
        <Segmented
          label="dificuldade dos bots"
          value={settings.difficulty}
          options={[
            ['easy', 'fácil'],
            ['medium', 'médio'],
            ['hard', 'difícil'],
            ['mixed', 'misto'],
          ]}
          onChange={(v) => set('difficulty', v)}
        />
        <Segmented
          label="modo da IA"
          value={settings.iaMode}
          options={[
            ['balanced', 'equilibrado'],
            ['chaos', 'caos'],
          ]}
          onChange={(v) => set('iaMode', v)}
        />
        <p className="hint">
          {settings.iaMode === 'balanced'
            ? 'Prompt custa 1 token extra. Depois de 2 usos, a IA volta ao baralho.'
            : 'Prompt grátis. Depois de usar, a IA é revelada e embaralhada de volta.'}
        </p>
        <div className="checks">
          <label className="toggle">
            <input type="checkbox" checked={settings.timer} onChange={(e) => set('timer', e.target.checked)} />
            timer de 10s nas janelas
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.sound} onChange={(e) => set('sound', e.target.checked)} />
            sons
          </label>
        </div>
        <button type="submit" className="btn btn-primary btn-big">
          ▶ npm run coup
        </button>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => onRules('tutorial')}>
            tutorial
          </button>
          <button type="button" className="btn" onClick={() => onRules('characters')}>
            regras
          </button>
        </div>
      </form>
    </main>
  );
}
