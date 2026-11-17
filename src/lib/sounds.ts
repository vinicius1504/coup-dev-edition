export type Sfx = 'coin' | 'declare' | 'challenge' | 'block' | 'lose' | 'win' | 'defeat' | 'turn';

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', gain = 0.05): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

const PATTERNS: Record<Sfx, [number, number, number][]> = {
  coin: [[988, 0, 0.06], [1319, 0.06, 0.12]],
  declare: [[440, 0, 0.07]],
  challenge: [[330, 0, 0.09], [262, 0.09, 0.16]],
  block: [[196, 0, 0.14]],
  lose: [[220, 0, 0.1], [165, 0.1, 0.1], [110, 0.2, 0.25]],
  win: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.3]],
  defeat: [[392, 0, 0.15], [311, 0.15, 0.15], [233, 0.3, 0.4]],
  turn: [[660, 0, 0.05], [880, 0.07, 0.08]],
};

/** Bipes 8-bit via WebAudio; silencioso se o navegador bloquear o áudio. */
export function playSfx(name: Sfx): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    for (const [f, s, d] of PATTERNS[name]) tone(f, s, d);
  } catch {
    // sem áudio
  }
}
