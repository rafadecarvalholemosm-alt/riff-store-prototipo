/*
 * Centraliza os caminhos relativos das fotos para os dois modos de execução.
 * O slug associa cada produto à sua foto; a categoria escolhe a imagem de ambiente.
 * filter(Boolean) remove posições vazias da galeria.
 */
/*
 * Caminhos das imagens de cada produto do catálogo (geradas por scripts/baixar-fotos.js):
 * - foto do produto em img/fotos/produtos/<slug>.jpg
 * - galeria: capa do álbum (img/fotos/capas/) e uma foto de ambiente da categoria
 */
const AMBIENTE = {
  camisetas: 'img/fotos/camisetas-arara.jpg',
  vinil: 'img/fotos/toca-discos-agulha.jpg',
  cds: 'img/fotos/cds-caixa.jpg',
  posteres: 'img/fotos/posteres-parede.jpg'
};

function imagensDoProduto(p) {
  const imagem = `img/fotos/produtos/${p.slug}.jpg`;
  if (!p.real || p.real.tipo === 'foto') return { imagem, galeria: [] };
  return { imagem, galeria: [`img/fotos/capas/${p.slug}.jpg`, AMBIENTE[p.categoria]].filter(Boolean) };
}

module.exports = { imagensDoProduto };
