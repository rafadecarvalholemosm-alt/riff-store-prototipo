/*
 * A página inicial solicita categorias, destaques, ofertas e lançamentos pela API.
 * Os cards compartilham o mesmo componente HTML do catálogo.
 * O carrossel é controlado pelo Bootstrap e a contagem segue a validade das promoções.
 */
// Controlador da página inicial: categorias, faixa de bandas, destaques, ofertas e vídeos.
$(function () {
  const { api, esc, cardProduto, registrarProdutos, montarContagem } = RS;

  // Foto de cada categoria (com a foto de um produto como reserva)
  const fotosCategoria = {
    camisetas: ['camisetas-arara', 'img/fotos/produtos/camiseta-acdc-highway-to-hell.jpg', 'Do grunge ao metal'],
    vinil: ['loja-discos-2', 'img/fotos/produtos/vinil-pink-floyd-dark-side.jpg', '180 gramas'],
    cds: ['cds-caixa', 'img/fotos/produtos/cd-guns-n-roses-use-your-illusion-i.jpg', 'Remasterizados'],
    posteres: ['posteres-parede', 'img/fotos/produtos/poster-led-zeppelin-physical-graffiti.jpg', 'Para a sua parede'],
    acessorios: ['palhetas-guitarra', 'img/fotos/produtos/kit-palhetas-riff.jpg', 'Palhetas, bonés e mais']
  };

  // map transforma a lista em cards; join une os fragmentos antes de inseri-los no DOM.
  function grade($alvo, produtos, opcoes) {
    // Registrar a lista antes de montar os cards mantém os botões de compra rápida ligados aos produtos.
    registrarProdutos(produtos);
    $alvo.html(produtos.map(p => `<div class="col">${cardProduto(p, opcoes)}</div>`).join(''));
  }

  function esqueletos($alvo, n) {
    // Os blocos reservam espaço enquanto a API responde, reduzindo saltos no layout dos produtos.
    $alvo.html(Array.from({ length: n }, () => '<div class="col"><div class="rs-esqueleto" style="aspect-ratio:3/4.4"></div></div>').join(''));
  }

  // Categorias em mosaico
  api('GET', '/api/categorias').then(cats => {
    $('#rs-categorias').html(cats.map(c => {
      const [foto, reserva, frase] = fotosCategoria[c.slug] || ['', 'img/site/sem-imagem.svg', ''];
      return `
        <a class="rs-cat" href="produtos.html?categoria=${esc(c.slug)}">
          <span class="rs-cat-bg" data-bg-foto="${foto}" style="background-image:url('${reserva}')"></span>
          <div class="rs-cat-info">
            <span>${esc(frase)} · ${c.total} produtos</span>
            <h3>${esc(c.nome)}</h3>
            <span class="rs-cat-cta">Ver categoria <i class="bi bi-arrow-right" aria-hidden="true"></i></span>
          </div>
        </a>`;
    }).join(''));
    RS.aplicarFotos('#rs-categorias');
  });

  RS.configuracoes().then(c => { if (c && c.instagram) $('#link-instagram').attr('href', c.instagram); });

  // Altura do banner: a primeira tela (sem rolar) termina exatamente no fim da faixa vermelha das bandas
  let larguraAnterior = 0;
  let alturaAnterior = 0;
  let quadroHero;
  // Ajusta a altura do primeiro banner conforme a área disponível da janela.
  function ajustarHero(forcar) {
    const hero = document.querySelector('.rs-hero');
    const faixa = document.querySelector('.rs-marquee');
    if (!hero || !faixa) return;
    const viewport = window.visualViewport;
    const alturaTela = viewport?.height || window.innerHeight;
    const mudouLargura = window.innerWidth !== larguraAnterior;
    // Zoom e teclado não devem encolher o banner enquanto o visitante interage com a página.
    if (viewport && viewport.scale > 1.05) return;
    const campoAtivo = document.activeElement;
    if (campoAtivo?.matches('input, textarea, [contenteditable="true"]') && campoAtivo.getClientRects().length) return;
    // Atualiza com a barra do navegador no topo; durante a rolagem, preserva a posição do conteúdo.
    if (!forcar && !mudouLargura && (Math.abs(alturaTela - alturaAnterior) < 1 || window.scrollY > 1)) return;
    larguraAnterior = window.innerWidth;
    alturaAnterior = alturaTela;
    const topo = hero.getBoundingClientRect().top + window.scrollY;
    const alturaFaixa = faixa.getBoundingClientRect().height;
    const margemFaixa = parseFloat(window.getComputedStyle(faixa).marginTop) || 0;
    // A margem negativa sobrepõe a faixa; arredondar para cima evita expor o fundo branco abaixo dela.
    const alturaMinima = window.innerWidth < 768 ? 0 : 420;
    const altura = Math.max(alturaMinima, Math.ceil(alturaTela - topo - alturaFaixa - margemFaixa));
    hero.style.setProperty('--rs-hero-altura', `${altura}px`);
  }
  // Agrupa eventos da janela e da área visível em uma atualização por quadro.
  function agendarHero(forcar = false) {
    cancelAnimationFrame(quadroHero);
    quadroHero = requestAnimationFrame(() => ajustarHero(forcar));
  }
  ajustarHero(true);
  $(window).on('load', () => agendarHero(true)).on('resize', () => agendarHero());
  window.visualViewport?.addEventListener('resize', () => agendarHero());
  window.addEventListener('scroll', () => { if (window.scrollY <= 1) agendarHero(); }, { passive: true });
  if (document.fonts) document.fonts.ready.then(() => ajustarHero(true));

  // Faixa rolante com as bandas (conteúdo duplicado para o laço contínuo).
  // Bandas com logo incluído em img/bandas/ aparecem com o logo; as demais, com o nome.
  const LOGOS_BANDAS = ['ac-dc', 'guns-n-roses', 'iron-maiden', 'led-zeppelin', 'legiao-urbana', 'metallica',
    'nirvana', 'queen', 'ramones', 'rolling-stones', 'sepultura'];
  const slugBanda = nome => nome.normalize('NFD').replace(/[\u0300-\u036f']/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  api('GET', '/api/bandas').then(bandas => {
    // A seleção desta faixa é independente dos filtros de bandas do catálogo.
    const bandasDaFaixa = bandas.filter(b => slugBanda(b.nome) !== 'pink-floyd');
    const itens = bandasDaFaixa.map(b => {
      const slug = slugBanda(b.nome);
      const marca = LOGOS_BANDAS.includes(slug)
        ? `<img class="rs-marquee-logo rs-logo-${slug}" src="img/bandas/${slug}.png" alt="${esc(b.nome)}">`
        : esc(b.nome);
      return `<a href="produtos.html?bandas=${encodeURIComponent(b.nome)}" title="${esc(b.nome)}">${marca}<img src="img/site/mao-chifrada.svg" alt=""></a>`;
    }).join('');
    $('#rs-marquee').html(itens + itens.replace(/<a /g, '<a tabindex="-1" aria-hidden="true" '));
    ajustarHero(true);
    $('#rs-marquee img').one('load', () => ajustarHero(true));
  });

  // Destaques
  esqueletos($('#rs-destaques'), 4);
  api('GET', '/api/produtos/destaques').then(lista => grade($('#rs-destaques'), lista.slice(0, 8)));

  // Lançamentos
  esqueletos($('#rs-novos'), 4);
  api('GET', '/api/produtos', { novos: 1, ordem: 'novos', limite: 4 }).then(r => grade($('#rs-novos'), r.produtos));

  // Ofertas com contagem regressiva
  esqueletos($('#rs-ofertas'), 4);
  api('GET', '/api/produtos/ofertas').then(ofertas => {
    if (!ofertas.length) {
      $('#ofertas').hide();
      return;
    }
    grade($('#rs-ofertas'), ofertas.slice(0, 4), { contagem: true });
    // a contagem grande acompanha a oferta que termina primeiro
    montarContagem($('#rs-contagem-ofertas'), ofertas[0].promocaoFim);
    montarContagem($('#rs-hero-contagem'), ofertas[0].promocaoFim);

    const maior = ofertas.reduce((m, p) => {
      const desc = Math.round((1 - p.precoFinal / p.precoOriginal) * 100);
      return desc > m.desc ? { desc, p } : m;
    }, { desc: 0, p: null });
    if (maior.p) {
      $('#rs-hero-desconto').text(`${maior.desc}%`);
      const img = maior.p.galeria.find(g => g.includes('/capas/') || g.includes('-detalhe')) || maior.p.imagem;
      $('#rs-hero-oferta-img').attr({ src: img, alt: `Imagem do produto em oferta: ${maior.p.nome}` });
    }
  }).catch(() => $('#ofertas').hide());

  // Vídeos: só carrega o player do YouTube quando o visitante clica
  $(document).on('click', '.rs-video[data-video]', function () {
    const id = $(this).data('video');
    const titulo = $(this).attr('aria-label');
    $(this).replaceWith(`<div class="rs-video"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0" title="${esc(titulo)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`);
  });
});
