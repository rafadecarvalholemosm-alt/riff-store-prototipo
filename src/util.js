/*
 * Regras compartilhadas evitam repetir validações e formatações nas rotas.
 * O preço promocional depende da data de validade, e os selos são calculados.
 * A resposta de produto é adaptada ao formato utilizado pelo front-end.
 */
// Funções auxiliares compartilhadas pelas rotas da API.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Remove espaços das pontas e limita o tamanho de um texto vindo do cliente.
function texto(valor, max = 255) {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim().slice(0, max);
}

// Expressão regular confere o formato do endereço; não verifica se a caixa postal existe.
function emailValido(email) {
  return EMAIL_RE.test(email);
}

// Remove a máscara visual antes de validar a quantidade de dígitos com DDD.
function telefoneValido(tel) {
  const digitos = String(tel || '').replace(/\D/g, '');
  return digitos.length >= 10 && digitos.length <= 11;
}

// Gera o slug (identificador de URL) a partir de um nome.
function gerarSlug(nome) {
  return String(nome)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
}

// Indica se a promoção do produto está valendo agora.
function promocaoAtiva(p) {
  return p.preco_promocional !== null && p.preco_promocional !== undefined &&
    p.promocao_fim && new Date(p.promocao_fim) > new Date();
}

// Converte uma linha da tabela produtos no formato enviado ao navegador,
// já com o preço final e os selos calculados.
function formatarProduto(p) {
  const emPromocao = promocaoAtiva(p);
  const trintaDias = 30 * 24 * 60 * 60 * 1000;
  const selos = [];
  if (p.estoque <= 0) selos.push('esgotado');
  if (emPromocao) selos.push('promocao');
  if (Date.now() - new Date(p.criado_em).getTime() < trintaDias) selos.push('novo');

  return {
    id: p.id,
    nome: p.nome,
    slug: p.slug,
    banda: p.banda,
    categoria: p.categoria_slug ? { nome: p.categoria_nome, slug: p.categoria_slug } : undefined,
    descricao: p.descricao,
    detalhes: p.detalhes,
    faixas: p.faixas ? p.faixas.split('\n').filter(Boolean) : [],
    ano: p.ano,
    preco: Number(p.preco),
    precoFinal: emPromocao ? Number(p.preco_promocional) : Number(p.preco),
    precoOriginal: emPromocao ? Number(p.preco) : null,
    promocaoFim: emPromocao ? p.promocao_fim : null,
    estoque: p.estoque,
    temTamanhos: !!p.tem_tamanhos,
    imagem: p.imagem,
    galeria: [p.imagem, ...(p.galeria ? p.galeria.split(',').filter(Boolean) : [])],
    audio: p.audio_preview,
    destaque: !!p.destaque,
    selos,
    mediaNotas: p.media_notas !== undefined && p.media_notas !== null ? Number(p.media_notas) : null,
    totalAvaliacoes: p.total_avaliacoes !== undefined ? Number(p.total_avaliacoes) : undefined
  };
}

module.exports = { texto, emailValido, telefoneValido, gerarSlug, promocaoAtiva, formatarProduto };
