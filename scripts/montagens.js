/*
 * Fotos de produto: aplicam a capa real do álbum sobre fotografias reais
 * (camiseta, disco de vinil, caixa de CD, parede de tijolos e tecido jeans)
 * e devolvem um JPG 900x900. Usado por scripts/baixar-fotos.js.
 *
 * As fotografias de base ficam em .cache/bases/ (ver BASES em baixar-fotos.js).
 */
const path = require('path');
const sharp = require('sharp');

const LADO = 900;
const DIR_BASES = path.join(__dirname, '..', '.cache', 'bases');
const base = nome => path.join(DIR_BASES, nome);

// ------------------------------------------------------------------ utilidades
async function bruto(entrada, largura, altura) {
  const { data, info } = await sharp(entrada).resize(largura, altura, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function paraSharp(data, w, h, canais) {
  return sharp(data, { raw: { width: w, height: h, channels: canais } });
}

// Sombra suave (retângulo ou círculo desfocado) para pousar o objeto no fundo
function sombra(largura, altura, raio, opacidade, desfoque, forma = 'rect') {
  const m = desfoque * 3;
  const fig = forma === 'circ'
    ? `<ellipse cx="${largura / 2 + m}" cy="${altura / 2 + m}" rx="${largura / 2}" ry="${altura / 2}" fill="#000" fill-opacity="${opacidade}"/>`
    : `<rect x="${m}" y="${m}" width="${largura}" height="${altura}" rx="${raio}" fill="#000" fill-opacity="${opacidade}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largura + m * 2}" height="${altura + m * 2}">${fig}</svg>`;
  return sharp(Buffer.from(svg)).blur(desfoque).png().toBuffer();
}

async function fundoEstudio() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}">
    <defs><radialGradient id="g" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#fafafa"/><stop offset="1" stop-color="#e4e4e4"/></radialGradient></defs>
    <rect width="${LADO}" height="${LADO}" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const capaQuadrada = (capa, lado) => sharp(capa).resize(lado, lado, { fit: 'cover' }).removeAlpha().png().toBuffer();
const jpg = img => img.jpeg({ quality: 84, mozjpeg: true }).toBuffer();

// ------------------------------------------------------------------ camiseta
async function camiseta(produto, capa) {
  const { data, w, h } = await bruto(base('camiseta.jpg'), LADO, LADO);
  // apaga o logotipo e a etiqueta da gola da foto original (a malha é preta lisa)
  const limpar = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 3;
      if (data[i] > 30 || data[i + 1] > 30 || data[i + 2] > 30) data[i] = data[i + 1] = data[i + 2] = 9;
    }
  };
  limpar(390, 205, 525, 310);
  limpar(425, 130, 495, 198);
  // estampa: capa com leve textura de malha
  const lado = 300;
  const textura = await sharp({ create: { width: lado, height: lado, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 22 } } }).png().toBuffer();
  const estampa = await sharp(await capaQuadrada(capa, lado))
    .modulate({ saturation: 0.92 })
    .composite([{ input: textura, blend: 'soft-light' }])
    .png().toBuffer();
  return jpg(paraSharp(data, w, h, 3).composite([{ input: estampa, left: 300, top: 222, blend: 'over' }]));
}

// ------------------------------------------------------------------ vinil
// Disco real recortado do fundo branco, com a capa no lugar do selo amarelo (PNG transparente)
async function discoComSelo(capa, D) {
  const { data, w, h } = await bruto(base('vinil.jpg'), D, D);
  // o selo amarelo do disco vira um recorte circular da capa
  const selo = await bruto(await capaQuadrada(capa, D), D, D);
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const amarelo = Math.max(0, Math.min(1, ((r + g) / 2 - b - 35) / 45));
    const sombraSelo = (r + g) / 2 / 220;
    for (let c = 0; c < 3; c++) rgba[j + c] = Math.round(data[i + c] * (1 - amarelo) + selo.data[i + c] * Math.min(1, sombraSelo) * amarelo);
    rgba[j + 3] = Math.max(0, Math.min(255, Math.round((248 - Math.min(r, g, b)) * 255 / 40)));
  }
  return paraSharp(rgba, w, h, 4).png().toBuffer();
}

async function vinil(produto, capa) {
  const D = 600;
  const disco = await discoComSelo(capa, D);
  const L = 540;
  return jpg(sharp(await fundoEstudio()).composite([
    { input: await sombra(D - 40, D - 40, 0, 0.35, 18, 'circ'), left: 300 - 34, top: 150 + 4 },
    { input: disco, left: 300, top: 150 },
    { input: await sombra(L, L, 4, 0.45, 16), left: 40 - 30, top: 180 - 22 },
    { input: await capaQuadrada(capa, L), left: 40, top: 180 }
  ]));
}

// ------------------------------------------------------------------ CD
async function cd(produto, capa) {
  // recorte da caixa na foto original (1920x1527), sem o fundo branco
  const recorte = { left: 74, top: 40, width: 1726, height: 1408 };
  const CW = 740, CH = Math.round(CW * recorte.height / recorte.width);
  const escala = CW / recorte.width;
  const caixa = await sharp(base('cd-caixa.jpg')).extract(recorte).resize(CW, CH).removeAlpha().png().toBuffer();
  // área da tampa (à direita da lombada) onde fica o encarte
  const x0 = Math.round((270 - recorte.left) * escala), y0 = Math.round((62 - recorte.top) * escala);
  const x1 = Math.round((1774 - recorte.left) * escala), y1 = Math.round((1432 - recorte.top) * escala);
  const encarte = await sharp(capa).resize(x1 - x0, y1 - y0, { fit: 'cover' }).removeAlpha().png().toBuffer();
  // o plástico da caixa (reflexos e arranhões) por cima do encarte
  const montada = await sharp(caixa)
    .composite([{ input: encarte, left: x0, top: y0, blend: 'over' }, { input: caixa, blend: 'screen' }])
    .png().toBuffer();
  const left = Math.round((LADO - CW) / 2), top = Math.round((LADO - CH) / 2);
  const disco = await sharp(base('cd-disco.png')).resize(560, 560).png().toBuffer();
  return jpg(sharp(await fundoEstudio()).composite([
    { input: await sombra(540, 540, 0, 0.3, 16, 'circ'), left: 330 - 48 + 10, top: top - 70 - 48 + 14 },
    { input: disco, left: 330, top: top - 70 },
    { input: await sombra(CW, CH, 6, 0.4, 16), left: left - 48 + 6, top: top - 48 + 18 },
    { input: montada, left, top }
  ]));
}

// ------------------------------------------------------------------ pôster
async function poster(produto, capa) {
  const parede = await sharp(base('parede.jpg')).resize(LADO, LADO, { fit: 'cover' }).modulate({ brightness: 1.04 }).png().toBuffer();
  const PW = 520, PH = 680, margem = 26;
  const arte = await capaQuadrada(capa, PW - margem * 2);
  const papel = await sharp({ create: { width: PW, height: PH, channels: 3, background: '#f7f6f1' } })
    .composite([
      { input: arte, left: margem, top: margem },
      { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}">
          <rect x="${margem}" y="${PW - margem + 22}" width="${PW - margem * 2}" height="4" fill="#b01116"/>
          <text x="${margem}" y="${PW - margem + 70}" font-family="Impact, Arial Black, sans-serif" font-size="38" fill="#151515">${(produto.banda || '').toUpperCase().replace(/&/g, '&amp;')}</text>
          <text x="${margem}" y="${PW - margem + 104}" font-family="Arial, sans-serif" font-size="19" letter-spacing="3" fill="#555">${(produto.nome.split('–')[1] || '').trim().toUpperCase().replace(/&/g, '&amp;').replace(/'/g, '&#39;')}</text>
          <defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></linearGradient></defs>
          <rect width="${PW}" height="${PH}" fill="url(#l)"/></svg>`) }
    ]).png().toBuffer();
  const fita = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="110" height="40"><rect x="5" y="8" width="100" height="26" fill="#ece3c4" fill-opacity=".86"/></svg>`);
  const left = Math.round((LADO - PW) / 2), top = 100;
  return jpg(sharp(parede).composite([
    { input: await sombra(PW, PH, 0, 0.45, 14), left: left - 42 + 10, top: top - 42 + 16 },
    { input: papel, left, top },
    { input: await sharp(fita).rotate(-32, { background: '#0000' }).png().toBuffer(), left: left - 52, top: top - 46 },
    { input: await sharp(fita).rotate(32, { background: '#0000' }).png().toBuffer(), left: left + PW - 66, top: top - 46 }
  ]));
}

// ------------------------------------------------------------------ patch bordado
async function patch(produto, capa) {
  const jeans = await sharp(base('jeans.jpg')).resize(LADO, LADO, { fit: 'cover', position: 'right' }).png().toBuffer();
  const R = 250, borda = 22, T = (R + borda) * 2;
  const mascara = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${R * 2}" height="${R * 2}"><circle cx="${R}" cy="${R}" r="${R}" fill="#fff"/></svg>`);
  const textura = await sharp({ create: { width: R * 2, height: R * 2, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } } }).png().toBuffer();
  const miolo = await sharp(await capaQuadrada(capa, R * 2))
    .composite([{ input: textura, blend: 'soft-light' }, { input: mascara, blend: 'dest-in' }])
    .png().toBuffer();
  let pontos = '';
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2, c = T / 2;
    pontos += `<line x1="${c + Math.cos(a) * (R + 2)}" y1="${c + Math.sin(a) * (R + 2)}" x2="${c + Math.cos(a) * (R + borda - 2)}" y2="${c + Math.sin(a) * (R + borda - 2)}" stroke="#d8262c" stroke-width="7" stroke-linecap="round"/>`;
  }
  const aro = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}"><circle cx="${T / 2}" cy="${T / 2}" r="${R + borda}" fill="#7d0b0f"/>${pontos}</svg>`);
  const peca = await sharp(aro).composite([{ input: miolo, left: borda, top: borda }]).png().toBuffer();
  const pos = Math.round((LADO - T) / 2);
  return jpg(sharp(jeans).composite([
    { input: await sombra(T, T, 0, 0.55, 12, 'circ'), left: pos - 36 + 6, top: pos - 36 + 10 },
    { input: await sharp(peca).rotate(-8, { background: '#0000' }).png().toBuffer(), left: pos - 20, top: pos - 20 }
  ]));
}

const TIPOS = { camiseta, vinil, cd, poster, patch };

async function montar(produto, capa) {
  const fn = TIPOS[produto.real.tipo];
  if (!fn) throw new Error(`tipo de montagem desconhecido: ${produto.real.tipo}`);
  return fn(produto, capa);
}

// Disco girando no banner da home: recorte circular perfeito, para não "balançar" ao girar
async function discoBanner(capa) {
  const D = 960, L = 820;
  // contorno do disco na foto original (fração da largura/altura), esticado para um círculo
  const caixa = { left: Math.round(D * 0.077), top: Math.round(D * 0.07), width: Math.round(D * 0.842), height: Math.round(D * 0.862) };
  const mascara = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${L}"><circle cx="${L / 2}" cy="${L / 2}" r="${L / 2 - 6}" fill="#fff"/></svg>`);
  const recortado = await sharp(await discoComSelo(capa, D)).extract(caixa).resize(L, L, { fit: 'fill' }).png().toBuffer();
  return sharp(recortado)
    .composite([{ input: mascara, blend: 'dest-in' }])
    .webp({ quality: 82, alphaQuality: 90 }).toBuffer();
}

module.exports = { montar, discoBanner };
