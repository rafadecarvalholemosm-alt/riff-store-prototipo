/*
 * Transforma catálogo e dados de exemplo no objeto window.RS_DADOS do navegador.
 * Os campos são adaptados ao mesmo modelo consumido pela API local.
 * O arquivo gerado contém dados; as regras da demonstração estão em api-local.js.
 */
/*
 * Gera public/js/dados.js: o catálogo e os dados de exemplo usados quando o
 * site roda só no navegador (sem servidor e sem banco de dados).
 * A fonte é a mesma do banco: database/catalogo.js.
 *
 * Uso: node scripts/gerar-dados-front.js
 */
const fs = require('fs');
const path = require('path');
const { categorias, produtos } = require('../database/catalogo');
const { imagensDoProduto } = require('../database/imagens');
const seed = require('../database/seed');

const dados = {
  versao: 5,
  categorias: categorias.map((c, i) => ({ id: i + 1, ...c })),
  // "dias" = há quantos dias o produto foi cadastrado; "promoDias" = dias até o fim da promoção
  produtos: produtos.map((p, i) => ({
    id: i + 1,
    categoria_id: categorias.findIndex(c => c.slug === p.categoria) + 1,
    nome: p.nome,
    slug: p.slug,
    banda: p.banda,
    descricao: p.descricao,
    detalhes: p.detalhes || null,
    faixas: p.faixas || null,
    ano: p.ano || null,
    preco: p.preco,
    preco_promocional: p.promo ? p.promo.preco : null,
    promoDias: p.promo ? p.promo.dias : null,
    estoque: p.estoque,
    tem_tamanhos: p.categoria === 'camisetas' ? 1 : 0,
    imagem: imagensDoProduto(p).imagem,
    galeria: imagensDoProduto(p).galeria.join(',') || null,
    audio_preview: p.audio ? p.audio.replace(/^\//, '') : null,
    destaque: p.destaque ? 1 : 0,
    ativo: 1,
    dias: p.novo ? 3 + (i % 10) : 60 + i * 7
  })),
  ...seed
};

const saida = `/* Gerado por scripts/gerar-dados-front.js a partir de database/catalogo.js. Não edite à mão. */
/* Dados gerados para a demonstração: IDs relacionam categorias, produtos e usuários.
 * dias e promoDias são relativos à criação dos dados no navegador; não são datas fixas.
 * Para regenerar este arquivo, edite as fontes em database/ e execute npm run dados. */
window.RS_DADOS = ${JSON.stringify(dados, null, 1)};
`;
fs.writeFileSync(path.join(__dirname, '..', 'public', 'js', 'dados.js'), saida);
console.log(`public/js/dados.js gerado (${dados.produtos.length} produtos).`);
