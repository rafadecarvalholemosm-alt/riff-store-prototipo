/*
 * Gera as prévias de áudio (public/audio/previa-N.wav): riffs curtos de
 * guitarra distorcida com bateria, sintetizados por código. Assim o site
 * não depende de faixas de terceiros.
 *
 * Uso: node scripts/gerar-audios.js
 */
const fs = require('fs');
const path = require('path');

const TAXA = 22050;
const DIR = path.join(__dirname, '..', 'public', 'audio');
fs.mkdirSync(DIR, { recursive: true });

const freq = nota => 440 * Math.pow(2, (nota - 69) / 12); // número MIDI -> Hz

// Power chord (fundamental + quinta + oitava) com distorção
function guitarra(buf, inicio, dur, nota, abafado = false) {
  const i0 = Math.floor(inicio * TAXA);
  const n = Math.floor(dur * TAXA);
  const fs_ = [freq(nota), freq(nota + 7), freq(nota + 12)];
  for (let i = 0; i < n && i0 + i < buf.length; i++) {
    const t = i / TAXA;
    let s = 0;
    for (const f of fs_) {
      // dente de serra levemente desafinado (dá corpo ao som)
      s += ((t * f) % 1) * 2 - 1;
      s += ((t * f * 1.004) % 1) * 2 - 1;
    }
    s /= 6;
    const ganho = abafado ? 6 : 14;
    s = Math.tanh(s * ganho) * 0.9; // distorção
    const ataque = Math.min(1, t / 0.005);
    const decaimento = abafado ? Math.exp(-t * 18) : Math.exp(-t * 1.2);
    const fim = Math.min(1, (dur - t) / 0.02);
    buf[i0 + i] += s * ataque * decaimento * fim * 0.32;
  }
}

function bumbo(buf, inicio) {
  const i0 = Math.floor(inicio * TAXA);
  for (let i = 0; i < TAXA * 0.25 && i0 + i < buf.length; i++) {
    const t = i / TAXA;
    const f = 50 + 90 * Math.exp(-t * 30);
    buf[i0 + i] += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 14) * 0.7;
  }
}

function caixa(buf, inicio, rnd) {
  const i0 = Math.floor(inicio * TAXA);
  for (let i = 0; i < TAXA * 0.18 && i0 + i < buf.length; i++) {
    const t = i / TAXA;
    buf[i0 + i] += ((rnd() * 2 - 1) * 0.5 + Math.sin(2 * Math.PI * 190 * t) * 0.3) * Math.exp(-t * 22) * 0.6;
  }
}

function chimbal(buf, inicio, rnd) {
  const i0 = Math.floor(inicio * TAXA);
  let anterior = 0;
  for (let i = 0; i < TAXA * 0.05 && i0 + i < buf.length; i++) {
    const t = i / TAXA;
    const r = rnd() * 2 - 1;
    const agudo = r - anterior; // filtro passa-altas simples
    anterior = r;
    buf[i0 + i] += agudo * Math.exp(-t * 80) * 0.12;
  }
}

function gerarRnd(semente) {
  let s = semente;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// riff: lista de [nota MIDI, duração em colcheias, abafado?]
function compor(nome, bpm, riff, repeticoes) {
  const colcheia = 60 / bpm / 2;
  const totalColcheias = riff.reduce((s, r) => s + r[1], 0) * repeticoes;
  const dur = totalColcheias * colcheia + 0.6;
  const buf = new Float32Array(Math.ceil(dur * TAXA));
  const rnd = gerarRnd(nome.length * 977);

  let t = 0;
  for (let r = 0; r < repeticoes; r++) {
    for (const [nota, colcheias, abafado] of riff) {
      if (nota !== null) guitarra(buf, t, colcheias * colcheia, nota, abafado);
      t += colcheias * colcheia;
    }
  }
  for (let c = 0; c < totalColcheias; c++) {
    const tc = c * colcheia;
    chimbal(buf, tc, rnd);
    if (c % 4 === 0) bumbo(buf, tc);
    if (c % 4 === 2) caixa(buf, tc, rnd);
    if (c % 8 === 7) bumbo(buf, tc);
  }

  // normaliza, com fade-in e fade-out
  let pico = 0;
  for (const v of buf) pico = Math.max(pico, Math.abs(v));
  const pcm = Buffer.alloc(44 + buf.length * 2);
  for (let i = 0; i < buf.length; i++) {
    const fade = Math.min(1, i / (TAXA * 0.05), (buf.length - i) / (TAXA * 0.5));
    pcm.writeInt16LE(Math.round((buf[i] / pico) * 0.85 * fade * 32767), 44 + i * 2);
  }
  // cabeçalho WAV (PCM 16 bits, mono)
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + buf.length * 2, 4); pcm.write('WAVE', 8);
  pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(TAXA, 24); pcm.writeUInt32LE(TAXA * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36); pcm.writeUInt32LE(buf.length * 2, 40);
  fs.writeFileSync(path.join(DIR, nome), pcm);
  console.log(`${nome}: ${dur.toFixed(1)} s`);
}

// E = 40, G = 43, A = 45, D = 38, C = 36
compor('previa-1.wav', 112, [[40, 2], [43, 2], [45, 3], [null, 1], [40, 2], [43, 2], [46, 1], [45, 3]], 2);
compor('previa-2.wav', 138, [[40, 1, true], [40, 1, true], [45, 2], [43, 2], [40, 1, true], [40, 1, true], [38, 2], [36, 2]], 3);
compor('previa-3.wav', 126, [[45, 1, true], [45, 1, true], [48, 2], [45, 1, true], [50, 2], [48, 1], [45, 1, true], [43, 3], [45, 4]], 2);
