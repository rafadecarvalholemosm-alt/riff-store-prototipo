/*
 * Ferramenta de preparação dos arquivos visuais; não participa das requisições do site.
 * Busca fontes externas, monta produtos com sharp e registra créditos das imagens.
 * A pasta .cache guarda bases de trabalho, e public/img recebe os arquivos utilizados.
 */
/*
 * Baixa e monta as imagens reais do site (precisa do Node, de internet e do
 * pacote "sharp", instalado com npm install):
 *  1. Fotos de fundo e banners (public/js/fotos.js, Unsplash) -> public/img/fotos/<nome>.jpg
 *  2. Fotografias de base dos produtos (Wikimedia Commons)    -> .cache/bases/<nome>.<ext>
 *  3. Capas dos álbuns (Wikipedia, campo "real.capa")          -> public/img/fotos/capas/<slug>.jpg
 *  4. Foto de cada produto: capa aplicada sobre a fotografia   -> public/img/fotos/produtos/<slug>.jpg
 *     de base (scripts/montagens.js) ou foto do Unsplash
 *     e o disco girando do banner da home                   -> public/img/fotos/disco-banner.webp
 *  5. Logos das bandas (Wikipedia/Commons), em branco         -> public/img/bandas/<slug>.png
 *  6. Créditos das imagens                                     -> public/img/fotos/CREDITOS.txt
 *
 * Uso: npm run fotos            (baixa só o que ainda não existe; as fotos de produto são sempre remontadas)
 *      npm run fotos -- --tudo  (baixa tudo de novo)
 * Depois, faça commit da pasta public/img/fotos.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');
const FOTOS = require('../public/js/fotos.js');
const { produtos } = require('../database/catalogo');
const { montar, discoBanner } = require('./montagens');

const RAIZ = path.join(__dirname, '..', 'public', 'img', 'fotos');
const DIR_CAPAS = path.join(RAIZ, 'capas');
const DIR_PRODUTOS = path.join(RAIZ, 'produtos');
const DIR_BASES = path.join(__dirname, '..', '.cache', 'bases');
const DIR_LOGOS = path.join(__dirname, '..', 'public', 'img', 'bandas');
[RAIZ, DIR_CAPAS, DIR_PRODUTOS, DIR_BASES, DIR_LOGOS].forEach(d => fs.mkdirSync(d, { recursive: true }));

const REFAZER = process.argv.includes('--tudo');
const AGENTE = 'RiffStore/1.0 (trabalho academico; Programacao para Web I - UFU)';

// Fotografias de base das montagens (Wikimedia Commons, licenças livres)
const BASES = {
  'camiseta.jpg': { arquivo: 'File:Rare By Circle Classic Logo T-Shirt.jpg', autor: 'Badislavius', licenca: 'CC BY-SA 4.0' },
  'vinil.jpg': { arquivo: 'File:12in-Vinyl-LP-Record-Angle.jpg', autor: 'Evan-Amos', licenca: 'Domínio público' },
  'cd-caixa.jpg': { arquivo: 'File:CD Jewel Case (Front).jpg', autor: 'DiscoA340', licenca: 'CC0' },
  'cd-disco.png': { arquivo: 'File:Audio Compact Disc.png', autor: 'Liamz2r', licenca: 'Domínio público' },
  'parede.jpg': { arquivo: 'File:Painted white brick wall (Moscow) 02.JPG', autor: 'Shakko', licenca: 'CC BY-SA 3.0' },
  'jeans.jpg': { arquivo: 'File:Jeans Detail (184193271).jpeg', autor: 'Uwe Jelting', licenca: 'CC0' }
};

// Logos das bandas para a faixa rolante da home. modo "silhueta": tudo o que não é
// transparente vira branco; modo "claros": só as partes claras viram branco (logos com fundo
// escuro ou com detalhes pretos). Bandas sem logo aqui aparecem com o nome em texto.
const LOGOS = {
  'ac-dc': { arquivo: 'File:Logo ACDC.svg', modo: 'silhueta' },
  'guns-n-roses': { arquivo: "File:GUNS N' ROSES logo.png", modo: 'silhueta' },
  'iron-maiden': { arquivo: 'File:Iron Maiden logo black.svg', modo: 'silhueta' },
  'led-zeppelin': { arquivo: 'File:Led Zeppelin logo.svg', modo: 'silhueta' },
  'legiao-urbana': { arquivo: 'File:Legião Urbana logo.png', modo: 'silhueta' },
  metallica: { arquivo: 'File:Metallica wordmark.svg', modo: 'silhueta' },
  nirvana: { arquivo: 'File:Nirvana logo yellow.svg', modo: 'claros' },
  'pink-floyd': { arquivo: 'File:Pink Floyd logo since 1994.svg', modo: 'silhueta' },
  queen: { arquivo: 'File:Queen logo.svg', modo: 'silhueta' },
  ramones: { arquivo: 'File:Ramones-logo.svg', modo: 'silhueta' },
  'rolling-stones': { arquivo: "File:The Rolling Stones' logo.svg", modo: 'claros' },
  sepultura: { arquivo: 'File:Sepultura logo.png', modo: 'silhueta' }
};

const espera = ms => new Promise(r => setTimeout(r, ms));

// GET com redirecionamentos; devolve { status, tipo, corpo (Buffer), local }
function baixarUrl(url, seguir = true, saltos = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': AGENTE, Accept: '*/*' } }, resp => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        resp.resume();
        const destino = new URL(resp.headers.location, url).href;
        if (!seguir) return resolve({ status: resp.statusCode, local: destino });
        if (saltos > 5) return reject(new Error('redirecionamentos demais'));
        return resolve(baixarUrl(destino, true, saltos + 1));
      }
      const partes = [];
      resp.on('data', c => partes.push(c));
      resp.on('end', () => resolve({ status: resp.statusCode, tipo: resp.headers['content-type'] || '', corpo: Buffer.concat(partes) }));
    }).on('error', reject).setTimeout(30000, function () { this.destroy(new Error('tempo esgotado')); });
  });
}

// Os servidores da Wikimedia limitam a frequência (HTTP 429): espera e tenta de novo
async function baixarComPaciencia(url) {
  for (let tentativa = 0; ; tentativa++) {
    const r = await baixarUrl(url);
    if (r.status !== 429 || tentativa >= 5) return r;
    await espera(3000 * (tentativa + 1));
  }
}

const existe = arquivo => !REFAZER && fs.existsSync(arquivo) && fs.statSync(arquivo).size > 0;

// Foto do Unsplash redimensionada (o endereço /download redireciona para o arquivo)
async function fotoUnsplash(id, largura, quadrada = false) {
  const r = await baixarUrl(`https://unsplash.com/photos/${id}/download?force=true`, false);
  if (!r.local) throw new Error(`Unsplash respondeu ${r.status}`);
  const original = new URL(r.local);
  const extra = quadrada ? `&h=${largura}&fit=crop&crop=entropy` : '&fit=max';
  const foto = await baixarUrl(`${original.origin}${original.pathname}?w=${largura}&q=78&fm=jpg${extra}`);
  if (foto.status !== 200) throw new Error(`Unsplash respondeu ${foto.status}`);
  return foto.corpo;
}

// Arquivo do Wikimedia Commons em até 1920 px de largura
async function arquivoCommons(titulo) {
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=1920' +
    `&titles=${encodeURIComponent(titulo)}`;
  const r = await baixarComPaciencia(api);
  const pagina = Object.values(JSON.parse(r.corpo.toString()).query.pages)[0];
  const info = pagina.imageinfo && pagina.imageinfo[0];
  if (!info) throw new Error(`arquivo não encontrado no Commons: ${titulo}`);
  const img = await baixarComPaciencia(info.thumburl || info.url);
  if (img.status !== 200) throw new Error(`Commons respondeu ${img.status}`);
  return img.corpo;
}

// Arquivo da Wikipedia em inglês (inclui os do Commons): SVG original ou PNG/JPG com até 800 px
async function arquivoWikipedia(titulo) {
  const api = 'https://en.wikipedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=800' +
    `&titles=${encodeURIComponent(titulo)}`;
  const r = await baixarComPaciencia(api);
  const pagina = Object.values(JSON.parse(r.corpo.toString()).query.pages)[0];
  const info = pagina.imageinfo && pagina.imageinfo[0];
  if (!info) throw new Error(`arquivo não encontrado: ${titulo}`);
  const img = await baixarComPaciencia(/\.svg$/i.test(titulo) ? info.url : (info.thumburl || info.url));
  if (img.status !== 200) throw new Error(`Wikipedia respondeu ${img.status}`);
  return img.corpo;
}

// Logo em branco com fundo transparente, 120 px de altura
async function logoBranco(corpo, modo) {
  const { data, info } = await sharp(corpo, { density: 300, limitInputPixels: false })
    .resize({ height: 240, width: 1400, fit: 'inside' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const luz = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    const alfa = modo === 'claros' ? data[i + 3] * Math.max(0, Math.min(1, (luz - 0.12) / 0.15)) : data[i + 3];
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(alfa);
  }
  const branco = await sharp(data, { raw: info }).png().toBuffer();
  return sharp(branco).trim({ threshold: 1 }).resize({ height: 120 }).png({ compressionLevel: 9 }).toBuffer();
}

// Imagem principal (capa) de um artigo da Wikipedia: "en:Título" ou "pt:Título"
async function capaWikipedia(candidatos) {
  for (const c of candidatos) {
    const [idioma, ...resto] = c.split(':');
    const titulo = resto.join(':');
    const api = `https://${idioma}.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail` +
      `&pithumbsize=700&pilicense=any&redirects=1&titles=${encodeURIComponent(titulo)}`;
    try {
      const r = await baixarComPaciencia(api);
      const paginas = Object.values((JSON.parse(r.corpo.toString()).query || {}).pages || {});
      const miniatura = paginas[0] && paginas[0].thumbnail && paginas[0].thumbnail.source;
      if (!miniatura) continue;
      const img = await baixarComPaciencia(miniatura);
      if (img.status === 200 && img.tipo.startsWith('image/')) return { corpo: img.corpo, origem: c };
    } catch (e) { /* tenta o próximo candidato */ }
  }
  throw new Error(`capa não encontrada (${candidatos.join(' | ')})`);
}

async function etapa(titulo, itens, fn) {
  console.log(`\n${titulo}`);
  let erros = 0;
  for (const item of itens) {
    try {
      console.log(`  ✔ ${await fn(item)}`);
    } catch (e) {
      erros++;
      console.log(`  ✘ ${item.nome || item.slug || item}: ${e.message}`);
    }
  }
  return erros;
}

function escreverCreditos() {
  const linhas = [
    'Créditos das imagens da Riff Store (gerado por scripts/baixar-fotos.js)',
    '',
    'Fotos de fundo, banners e acessórios: Unsplash (https://unsplash.com/license)',
    ...Object.entries(FOTOS).map(([nome, [id]]) => `  ${nome}.jpg: https://unsplash.com/photos/${id}`),
    ...produtos.filter(p => p.real && p.real.tipo === 'foto').map(p => `  produtos/${p.slug}.jpg: https://unsplash.com/photos/${p.real.unsplash}`),
    '',
    'Fotografias usadas como base das fotos de produto: Wikimedia Commons',
    ...Object.values(BASES).map(b => `  ${b.arquivo.replace(/^File:/, '')} – ${b.autor} (${b.licenca}): https://commons.wikimedia.org/wiki/${encodeURIComponent(b.arquivo.replace(/ /g, '_'))}`),
    '',
    'Logos das bandas (public/img/bandas): Wikipedia/Wikimedia Commons; marcas registradas de seus donos',
    ...Object.entries(LOGOS).map(([slug, l]) => `  ${slug}.png: https://en.wikipedia.org/wiki/${encodeURIComponent(l.arquivo.replace(/ /g, '_'))}`),
    '',
    'Capas dos álbuns: imagens principais dos artigos da Wikipedia, usadas apenas para fins acadêmicos.',
    'Os direitos das capas pertencem às gravadoras e aos artistas.',
    ''
  ];
  fs.writeFileSync(path.join(RAIZ, 'CREDITOS.txt'), linhas.join('\n'));
}

(async () => {
  let erros = 0;

  // 1. Fundos e banners
  erros += await etapa('Fotos de fundo e banners', Object.entries(FOTOS).map(([nome, [id, largura]]) => ({ nome, id, largura })), async f => {
    const arquivo = path.join(RAIZ, `${f.nome}.jpg`);
    if (existe(arquivo)) return `${f.nome} (já existe)`;
    fs.writeFileSync(arquivo, await fotoUnsplash(f.id, f.largura));
    return `${f.nome} (${Math.round(fs.statSync(arquivo).size / 1024)} KB)`;
  });

  // 2. Fotografias de base
  erros += await etapa('Fotografias de base (Wikimedia Commons)', Object.entries(BASES).map(([nome, b]) => ({ nome, ...b })), async b => {
    const arquivo = path.join(DIR_BASES, b.nome);
    if (existe(arquivo)) return `${b.nome} (já existe)`;
    fs.writeFileSync(arquivo, await arquivoCommons(b.arquivo));
    await espera(800);
    return `${b.nome} – ${b.autor} (${b.licenca})`;
  });

  // 3 e 4. Capas e fotos dos produtos
  erros += await etapa('Fotos dos produtos', produtos.filter(p => p.real), async p => {
    const arquivo = path.join(DIR_PRODUTOS, `${p.slug}.jpg`);
    if (p.real.tipo === 'foto') {
      if (existe(arquivo)) return `${p.slug} (já existe)`;
      fs.writeFileSync(arquivo, await fotoUnsplash(p.real.unsplash, 900, true));
      return `${p.slug}: foto do Unsplash`;
    }
    const arquivoCapa = path.join(DIR_CAPAS, `${p.slug}.jpg`);
    let origem = 'capa já baixada';
    if (!existe(arquivoCapa)) {
      const capa = await capaWikipedia(p.real.capa);
      await sharp(capa.corpo).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toFile(arquivoCapa);
      origem = `capa da Wikipedia (${capa.origem})`;
      await espera(800);
    }
    fs.writeFileSync(arquivo, await montar(p, fs.readFileSync(arquivoCapa)));
    return `${p.slug}: ${p.real.tipo} com ${origem}`;
  });

  // Disco do banner da home, com a capa de A Night at the Opera no selo
  erros += await etapa('Disco do banner', ['disco-banner.webp'], async nome => {
    const capa = path.join(DIR_CAPAS, 'vinil-queen-night-opera.jpg');
    fs.writeFileSync(path.join(RAIZ, nome), await discoBanner(fs.readFileSync(capa)));
    return nome;
  });

  // 5. Logos das bandas
  erros += await etapa('Logos das bandas', Object.entries(LOGOS).map(([slug, l]) => ({ slug, ...l })), async l => {
    const arquivo = path.join(DIR_LOGOS, `${l.slug}.png`);
    if (existe(arquivo)) return `${l.slug} (já existe)`;
    fs.writeFileSync(arquivo, await logoBranco(await arquivoWikipedia(l.arquivo), l.modo));
    await espera(800);
    return `${l.slug}.png`;
  });

  escreverCreditos();
  console.log(erros
    ? `\n${erros} imagem(ns) não foram baixadas. Rode o comando de novo daqui a alguns minutos.`
    : '\nTudo pronto! Faça commit da pasta public/img/fotos.');
})();
