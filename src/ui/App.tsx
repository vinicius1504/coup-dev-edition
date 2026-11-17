'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GameConfig, GameState } from '@/engine/types';
import { DEFAULT_SETTINGS, buildConfig, loadSettings, saveSettings } from '@/lib/settings';
import type { Settings } from '@/lib/settings';
import { Game } from './components/Game';
import { Menu } from './components/Menu';
import { Result } from './components/Result';
import { Rules } from './components/Rules';
import type { RulesTab } from './components/Rules';

type Screen = { kind: 'menu' } | { kind: 'rules'; tab: RulesTab } | { kind: 'game'; config: GameConfig } | { kind: 'result'; state: GameState };

export function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });

  // lido depois da hidratação para o HTML do servidor bater com o do cliente
  useEffect(() => setSettings(loadSettings()), []);

  const update = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };
  const start = () => setScreen({ kind: 'game', config: buildConfig(settings, (Date.now() % 2147483647) | 0) });
  const finish = useCallback((state: GameState) => setScreen({ kind: 'result', state }), []);

  switch (screen.kind) {
    case 'menu':
      return <Menu settings={settings} onChange={update} onStart={start} onRules={(tab) => setScreen({ kind: 'rules', tab })} />;
    case 'rules':
      return (
        <main className="rules-page">
          <Rules initialTab={screen.tab} onClose={() => setScreen({ kind: 'menu' })} closeLabel="voltar ao menu" />
        </main>
      );
    case 'game':
      return (
        <Game
          key={screen.config.seed}
          config={screen.config}
          timer={settings.timer}
          sound={settings.sound}
          onToggleSound={() => update({ ...settings, sound: !settings.sound })}
          onFinish={finish}
          onQuit={() => setScreen({ kind: 'menu' })}
        />
      );
    case 'result':
      return <Result state={screen.state} onAgain={start} onMenu={() => setScreen({ kind: 'menu' })} />;
  }
}
