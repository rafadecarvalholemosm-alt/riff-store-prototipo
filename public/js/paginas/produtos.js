/* Controlador da página produtos.html.
 * Estado da vitrine: busca, filtros, ordenação e página atual ficam sincronizados com a URL.
 * AJAX atualiza a grade sem recarregar o documento HTML inteiro.
 * O identificador da requisição impede que uma resposta antiga substitua a busca mais recente.
 */
// Vitrine: busca, filtros, ordenação e paginação sem recarregar a página (AJAX com jQuery).
$(function () {
  const { api, esc, moeda, cardProduto, registrarProdutos } = RS;
  const POR_PAGINA = 12;

  let categorias = [];
  let faixa = { minimo: 0, maximo: 300 };
  let estado = lerEstadoDaUrl();
  let requisicaoAtual = 0;

  // Recupera filtros de links compartilhados e da navegação voltar/avançar do navegador.
  function lerEstadoDaUrl() {
    const q = new URLSearchParams(location.search);
    return {
      busca: q.get('busca') || '',
      categoria: q.get('categoria') || '',
      bandas: (q.get('bandas') || '').split(',').filter(Boolean),
      precoMin: q.get('precoMin') || '',
      precoMax: q.get('precoMax') || '',
      estoque: q.get('estoque') === '1',
      promocao: q.get('promocao') === '1',
      ordem: q.get('ordem') || 'relevancia',
      pagina: parseInt(q.get('pagina'), 10) || 1
    };
  }

  // Converte o estado nos parâmetros da URL / da API (só o que estiver preenchido)
  function parametros(e) {
    const p = {};
    if (e.busca) p.busca = e.busca;
    if (e.categoria) p.categoria = e.categoria;
    if (e.bandas.length) p.bandas = e.bandas.join(',');
    if (e.precoMin !== '') p.precoMin = e.precoMin;
    if (e.precoMax !== '') p.precoMax = e.precoMax;
    if (e.estoque) p.estoque = 1;
    if (e.promocao) p.promocao = 1;
    if (e.ordem !== 'relevancia') p.ordem = e.ordem;
    if (e.pagina > 1) p.pagina = e.pagina;
    return p;
  }

  function atualizarUrl() {
    const qs = new URLSearchParams(parametros(estado)).toString();
    history.pushState(null, '', qs ? `?${qs}` : location.pathname);
  }

  // ------------------------------------------------------------------ Títulos
  function atualizarTitulo(total) {
    const cat = categorias.find(c => c.slug === estado.categoria);
    let titulo = cat ? cat.nome : 'Todos os produtos';
    let sub = 'Camisetas, vinis, CDs, pôsteres e acessórios para quem vive o rock.';
    if (estado.promocao && !cat) { titulo = 'Promoções'; sub = 'Ofertas por tempo limitado: quando o cronômetro zerar, o preço volta ao normal.'; }
    if (estado.bandas.length === 1 && !cat && !estado.promocao) { titulo = estado.bandas[0]; sub = `Tudo da banda ${estado.bandas[0]} na Riff Store.`; }
    if (estado.busca) { sub = `Resultados para “${estado.busca}”.`; if (!cat) titulo = 'Busca'; }
    $('#titulo-lista').text(titulo);
    $('#trilha-atual').text(titulo === 'Todos os produtos' ? 'Todos' : titulo);
    $('#subtitulo-lista').text(sub);
    document.title = `${titulo} | Riff Store`;
    $('#contagem-resultados').html(`<strong class="text-dark">${total}</strong> ${total === 1 ? 'produto encontrado' : 'produtos encontrados'}`);
  }

  // ------------------------------------------------------------------ Filtros na tela
  function sincronizarControles() {
    $('#lista-categorias a').removeClass('ativo').removeAttr('aria-current');
    $(`#lista-categorias a[data-categoria="${estado.categoria}"]`).addClass('ativo').attr('aria-current', 'true');
    $('#lista-bandas input').each(function () { this.checked = estado.bandas.includes(this.value); });
    $('#filtro-estoque').prop('checked', estado.estoque);
    $('#filtro-promocao').prop('checked', estado.promocao);
    $('#ordenar').val(estado.ordem);
    $('#preco-min-num').val(estado.precoMin);
    $('#preco-max-num').val(estado.precoMax);
    const max = estado.precoMax !== '' ? estado.precoMax : faixa.maximo;
    $('#preco-max').val(max);
    $('#preco-max-rotulo').text(moeda(max).replace(',00', ''));
    $('#preco-min-rotulo').text(moeda(estado.precoMin || faixa.minimo).replace(',00', ''));
    $('#rs-campo-busca').val(estado.busca);
  }

  function chipsFiltros() {
    const chips = [];
    const chip = (rotulo, acao) => chips.push(`<span class="rs-chip">${esc(rotulo)}<button type="button" data-remover="${acao}" aria-label="Remover filtro ${esc(rotulo)}"><i class="bi bi-x"></i></button></span>`);
    if (estado.busca) chip(`Busca: ${estado.busca}`, 'busca');
    const cat = categorias.find(c => c.slug === estado.categoria);
    if (cat) chip(cat.nome, 'categoria');
    estado.bandas.forEach(b => chip(b, `banda:${b}`));
    if (estado.precoMin !== '') chip(`A partir de ${moeda(estado.precoMin)}`, 'precoMin');
    if (estado.precoMax !== '') chip(`Até ${moeda(estado.precoMax)}`, 'precoMax');
    if (estado.estoque) chip('Em estoque', 'estoque');
    if (estado.promocao) chip('Em promoção', 'promocao');
    $('#filtros-ativos').html(chips.join('')).toggle(chips.length > 0);
  }

  $('#filtros-ativos').on('click', '[data-remover]', function () {
    const r = String($(this).data('remover'));
    if (r.startsWith('banda:')) estado.bandas = estado.bandas.filter(b => b !== r.slice(6));
    else if (r === 'estoque' || r === 'promocao') estado[r] = false;
    else estado[r] = '';
    aplicar();
  });

  // ------------------------------------------------------------------ Carregamento
  // Exibe carregamento, solicita a página filtrada e atualiza os cards quando a resposta chega.
  function carregar() {
    // Cada busca recebe um número: uma resposta atrasada não pode substituir o resultado mais recente.
    const id = ++requisicaoAtual;
    const $grade = $('#grade-produtos').attr('aria-busy', 'true');
    $grade.html(Array.from({ length: 6 }, () => '<div class="col"><div class="rs-esqueleto" style="aspect-ratio:3/4.6"></div></div>').join(''));
    sincronizarControles();
    chipsFiltros();

    api('GET', '/api/produtos', { ...parametros(estado), limite: POR_PAGINA }).then(r => {
      if (id !== requisicaoAtual) return; // ignora respostas antigas
      registrarProdutos(r.produtos);
      atualizarTitulo(r.total);
      if (!r.produtos.length) {
        $grade.html(`
          <div class="col-12 w-100" style="flex:0 0 100%;max-width:100%">
            <div class="rs-vazio">
              <i class="bi bi-vinyl" aria-hidden="true"></i>
              <h2 class="h3 mt-3">Nenhum produto encontrado</h2>
              <p class="text-secondary">Tente remover algum filtro ou buscar por outro nome.</p>
              <button type="button" class="btn btn-rs" id="limpar-vazio">Limpar filtros</button>
            </div>
          </div>`);
      } else {
        $grade.html(r.produtos.map(p => `<div class="col">${cardProduto(p, { contagem: estado.promocao })}</div>`).join(''));
      }
      $grade.attr('aria-busy', 'false');
      paginacao(r.pagina, r.paginas);
    }).catch(err => {
      $grade.html(`<div class="col-12 w-100" style="flex:0 0 100%;max-width:100%"><div class="alert alert-danger">${esc(err.erro)}</div></div>`);
    });
  }

  // Os links trocam o estado da vitrine; o evento de clique evita navegar para outro documento.
  function paginacao(atual, total) {
    // Apenas os controles necessários são gerados; uma única página não precisa de navegação numerada.
    if (total <= 1) { $('#paginacao').empty(); return; }
    let html = `<li class="page-item ${atual === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-pagina="${atual - 1}" aria-label="Página anterior"><i class="bi bi-chevron-left"></i></a></li>`;
    for (let i = 1; i <= total; i++) {
      html += `<li class="page-item ${i === atual ? 'active' : ''}"><a class="page-link" href="#" data-pagina="${i}" ${i === atual ? 'aria-current="page"' : ''}>${i}</a></li>`;
    }
    html += `<li class="page-item ${atual === total ? 'disabled' : ''}"><a class="page-link" href="#" data-pagina="${atual + 1}" aria-label="Próxima página"><i class="bi bi-chevron-right"></i></a></li>`;
    $('#paginacao').html(html);
  }

  function aplicar(manterPagina) {
    if (!manterPagina) estado.pagina = 1;
    atualizarUrl();
    carregar();
  }

  // ------------------------------------------------------------------ Eventos
  $('#paginacao').on('click', 'a', function (e) {
    e.preventDefault();
    const p = parseInt($(this).data('pagina'), 10);
    if (!p || $(this).parent().hasClass('disabled') || $(this).parent().hasClass('active')) return;
    estado.pagina = p;
    aplicar(true);
    $('html, body').animate({ scrollTop: $('#conteudo').offset().top + 200 }, 300);
  });

  $('#lista-categorias').on('click', 'a', function (e) {
    e.preventDefault();
    estado.categoria = $(this).data('categoria');
    aplicar();
  });

  $('#lista-bandas').on('change', 'input', function () {
    estado.bandas = $('#lista-bandas input:checked').map((i, el) => el.value).get();
    aplicar();
  });

  $('#filtro-estoque').on('change', function () { estado.estoque = this.checked; aplicar(); });
  $('#filtro-promocao').on('change', function () { estado.promocao = this.checked; aplicar(); });
  $('#ordenar').on('change', function () { estado.ordem = this.value; aplicar(); });

  // Faixa de preço: o controle deslizante atualiza o rótulo na hora e filtra ao soltar
  $('#preco-max').on('input', function () {
    $('#preco-max-rotulo').text(moeda(this.value).replace(',00', ''));
    $('#preco-max-num').val(this.value);
  }).on('change', function () {
    estado.precoMax = Number(this.value) >= faixa.maximo ? '' : this.value;
    aplicar();
  });
  let atrasoPreco;
  $('#preco-min-num, #preco-max-num').on('input', function () {
    clearTimeout(atrasoPreco);
    atrasoPreco = setTimeout(() => {
      estado.precoMin = $('#preco-min-num').val();
      estado.precoMax = $('#preco-max-num').val();
      aplicar();
    }, 600);
  });

  function limpar() {
    estado = { busca: '', categoria: '', bandas: [], precoMin: '', precoMax: '', estoque: false, promocao: false, ordem: 'relevancia', pagina: 1 };
    aplicar();
  }
  $('#limpar-filtros').on('click', limpar);
  $(document).on('click', '#limpar-vazio', limpar);

  // A busca do cabeçalho também filtra sem recarregar quando já estamos na vitrine
  $(document).on('submit', '#rs-busca form', function (e) {
    e.preventDefault();
    estado.busca = $('#rs-campo-busca').val().trim();
    aplicar();
    bootstrap.Collapse.getOrCreateInstance('#rs-busca').hide();
  });

  // Botões voltar/avançar do navegador
  window.addEventListener('popstate', () => { estado = lerEstadoDaUrl(); carregar(); });

  // ------------------------------------------------------------------ Início
  Promise.all([api('GET', '/api/categorias'), api('GET', '/api/bandas'), api('GET', '/api/produtos', { limite: 1 })])
    .then(([cats, bandas, todos]) => {
      categorias = cats;
      faixa = todos.faixaPreco;
      $('#preco-max').attr({ min: 0, max: faixa.maximo });
      $('#preco-max-num, #preco-min-num').attr('max', faixa.maximo);
      $('#preco-max-num').attr('placeholder', faixa.maximo);
      $('#total-geral').text(todos.total);
      $('#lista-categorias').append(cats.map(c =>
        `<li><a href="produtos.html?categoria=${esc(c.slug)}" data-categoria="${esc(c.slug)}">${esc(c.nome)} <span>${c.total}</span></a></li>`).join(''));
      $('#lista-bandas').html(bandas.map((b, i) => `
        <div class="form-check mb-1">
          <input class="form-check-input" type="checkbox" value="${esc(b.nome)}" id="banda-${i}">
          <label class="form-check-label d-flex justify-content-between" for="banda-${i}">${esc(b.nome)} <span class="text-secondary small">${b.total}</span></label>
        </div>`).join(''));
      carregar();
    })
    .catch(err => $('#grade-produtos').html(`<div class="alert alert-danger w-100">${esc(err.erro)}</div>`));
});
