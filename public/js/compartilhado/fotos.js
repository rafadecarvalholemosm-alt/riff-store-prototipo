/*
 * Lista de fontes de fotografias usada no carregamento das imagens do site.
 * As páginas indicam uma chave em data-foto ou data-bg-foto, em vez de duplicar URLs.
 * app.js tenta carregar a cópia local antes da fonte externa.
 */
/*
 * Fotos usadas no site (banco de imagens Unsplash, licença de uso livre).
 * Cada foto é procurada primeiro em img/fotos/<nome>.jpg; se não existir, é carregada
 * direto do Unsplash.
 *
 * nome: [id da foto no Unsplash, largura em pixels]
 */
(function (raiz) {
  const FOTOS = {
    // As chaves correspondem aos atributos data-bg-foto e data-foto encontrados nos HTML.
    // Banners e fundos
    'show-luzes-vermelhas': ['Sbv0YYYdbYo', 1920],
    'show-palco-vermelho': ['hunYJNQZAio', 1920],
    'show-holofote': ['JwbkjqjGXuc', 1920],
    'show-festa': ['wahZ_EpEOmw', 1600],
    'guitarrista-palco-2': ['Re6qYuerJh0', 1600],
    'guitarrista-pb': ['Io89_xzWFp0', 1600],
    'publico-maos': ['CuSHBGBdXc0', 1920],
    'publico-maos-pb': ['5Pln0OGhrvc', 1600],
    'publico-show': ['-5rA4DRrEXU', 1600],
    'publico-show-2': ['Qnlp3FCO2vc', 1600],
    // Vinil e discos
    'toca-discos': ['aa61_XwMbow', 1600],
    'toca-discos-agulha': ['R4Rdi0EfBws', 1600],
    'vinil-portatil': ['HRyjETL87Gg', 1200],
    'loja-discos-2': ['r1L_yH94BV0', 1200],
    'discos-prateleira': ['n-iS58QUWTA', 1200],
    'cds-caixa': ['qrhHswAj1bI', 1200],
    // Moda e acessórios
    'camisetas-arara': ['tvG4WvjgsEY', 1200],
    'camiseta-nirvana': ['zm2AOFvnrFE', 1000],
    'camiseta-metallica': ['-K8OcTxTHd4', 1000],
    'fa-metallica-show': ['rSNKJOd-csQ', 1000],
    'palhetas-guitarra': ['GMb9DOBxl4s', 1200],
    'palheta-close': ['KUw3J-aMKco', 1000],
    'posteres-parede': ['8vhDazScX1k', 1200],
    'posteres-parede-2': ['oraqZwfiQgE', 1200]
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FOTOS;
  else raiz.RS_FOTOS = FOTOS;
})(this);
