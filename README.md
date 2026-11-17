# COUP: DEV EDITION

Jogo de cartas de blefe e dedução (baseado em Coup) com tema de desenvolvedores. Você contra 1 a 5 bots, direto no navegador.

```bash
npm install
npm run dev
npm test
```

- `src/engine`: regras do jogo como máquina de estados pura (sem React), com testes.
- `src/bots`: bots em três níveis, que só enxergam a visão do próprio jogador.
- `src/ui`: telas e componentes React.
