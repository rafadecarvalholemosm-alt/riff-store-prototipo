/* Controlador da página produto.html.
 * O slug da URL seleciona os detalhes do produto na API.
 * A página coordena galeria, zoom, tamanhos, quantidade, faixas e avaliações.
 * O estoque disponível considera também o que o usuário já colocou no carrinho.
 */
// Detalhes do produto: galeria, tamanhos, quantidade, carrinho, faixas e avaliações.
$(function () {
  const { api, esc, moeda, data, parametro, estrelas, parcelas, carrinho, montarContagem, cardProduto, registrarProdutos, aviso } = RS;
  const slug = parametro('slug');
  let produto = null;

  if (!slug) return mostrarErro();

  function mostrarErro() {
    $('#produto-carregando').remove();
    $('#produto-erro').prop('hidden', false);
  }

  function carregar() {
    // A resposta reúne produto, avaliações e relacionados para atualizar os três blocos desta página.
    return api('GET', `/api/produtos/${encodeURIComponent(slug)}`).then(r => {
      produto = r.produto;
      montarProduto(r.produto);
      montarAvaliacoes(r);
      montarRelacionados(r.relacionados);
    }).catch(mostrarErro);
  }

  // ------------------------------------------------------------------ Produto
  // Usa o resultado da API para preencher textos, preços, imagens e controles de compra.
  function montarProduto(p) {
    document.title = `${p.nome} | Riff Store`;
    $('meta[name="description"]').attr('content', p.descricao.slice(0, 155));
    $('#trilha').append(`
      <li class="breadcrumb-item"><a href="produtos.html?categoria=${esc(p.categoria.slug)}">${esc(p.categoria.nome)}</a></li>
      <li class="breadcrumb-item active" aria-current="page">${esc(p.nome)}</li>`);

    $('#produto-banda').text(p.banda).attr('href', p.banda === 'Riff Store' ? 'produtos.html' : `produtos.html?bandas=${encodeURIComponent(p.banda)}`);
    $('#produto-nome').text(p.nome);
    $('#produto-selos').html($(RS.selos(p)).html());
    $('#produto-nota').html(p.totalAvaliacoes
      ? `${estrelas(p.mediaNotas)} <span class="small text-decoration-underline">${p.totalAvaliacoes} ${p.totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'}</span>`
      : '<span class="small text-secondary"><i class="bi bi-star me-1"></i>Ainda sem avaliações</span>');

    $('#produto-preco').text(moeda(p.precoFinal));
    $('#produto-parcelas').text(parcelas(p.precoFinal));
    if (p.precoOriginal) {
      $('#produto-preco-antigo').text(moeda(p.precoOriginal));
      $('#produto-desconto').text(`-${Math.round((1 - p.precoFinal / p.precoOriginal) * 100)}%`).prop('hidden', false);
      $('#produto-oferta').prop('hidden', false);
      // quando a oferta expira, recarrega para mostrar o preço normal
      montarContagem($('#produto-contagem'), p.promocaoFim, () => {
        aviso('Esta oferta acabou de expirar.', 'info');
        setTimeout(() => location.reload(), 1500);
      });
    }

    // Galeria: clicar numa miniatura troca a imagem principal
    const nomesVista = p.temTamanhos ? ['camiseta', 'arte da estampa', 'na arara'] : ['produto', 'capa do álbum', 'ambiente'];
    $('#imagem-principal').attr({ src: p.galeria[0], alt: `${p.nome} – ${nomesVista[0]}` });
    $('#miniaturas').html(p.galeria.map((src, i) => `
      <button type="button" class="${i === 0 ? 'ativo' : ''}" data-src="${esc(src)}" data-vista="${esc(nomesVista[i] || 'imagem ' + (i + 1))}" aria-label="Ver ${esc(nomesVista[i] || 'imagem ' + (i + 1))}">
        <img src="${esc(src)}" alt="">
      </button>`).join(''));

    $('#bloco-tamanhos').prop('hidden', !p.temTamanhos);
    $('#produto-descricao').text(p.descricao);
    $('#produto-detalhes').html((p.detalhes || '').split('\n').filter(Boolean).map(d => `<li class="mb-1">${esc(d)}</li>`).join('') || '<li>Sem informações adicionais.</li>');

    if (p.faixas.length) {
      // O texto de cada faixa é escapado antes de entrar no HTML; produtos sem faixas mantêm a aba oculta.
      $('#item-aba-faixas').prop('hidden', false);
      $('#produto-faixas').html(p.faixas.map(f => `<li>${esc(f)}</li>`).join(''));
    }
    atualizarEstoque();

    $('#produto-carregando').remove();
    $('#produto').prop('hidden', false);
    if (location.hash === '#comprar') $('#comprar')[0].scrollIntoView({ behavior: 'smooth' });
  }

  // Estoque disponível considerando o que já está no carrinho
  function disponivel() {
    const noCarrinho = carrinho.itens().filter(i => i.id === produto.id).reduce((s, i) => s + i.quantidade, 0);
    return Math.max(0, produto.estoque - noCarrinho);
  }

  function atualizarEstoque() {
    const livre = disponivel();
    const $btn = $('#btn-adicionar');
    const $info = $('#produto-estoque');
    if (produto.estoque <= 0) {
      $btn.prop('disabled', true).html('<i class="bi bi-x-circle me-2"></i>Esgotado');
      $info.html('<span class="text-secondary">Produto esgotado no momento. Deixe uma mensagem no <a href="contato.html">contato</a> para ser avisado quando voltar.</span>');
    } else if (livre <= 0) {
      $btn.prop('disabled', true).html('<i class="bi bi-check2 me-2"></i>Todo o estoque já está no carrinho');
      $info.html('<a href="carrinho.html">Ir para o carrinho →</a>');
    } else {
      $btn.prop('disabled', false).html('<i class="bi bi-bag-plus me-2"></i>Adicionar ao carrinho');
      $info.html(produto.estoque <= 5
        ? `<span class="rs-estoque-baixo"><i class="bi bi-fire"></i> Corre! Restam só ${produto.estoque} unidades.</span>`
        : `<span class="text-success"><i class="bi bi-check-circle"></i> Em estoque: ${produto.estoque} unidades disponíveis.</span>`);
    }
    $('#quantidade').attr('max', Math.max(1, Math.min(livre, 10)));
    ajustarQtd(0);
  }

  function ajustarQtd(delta) {
    const $q = $('#quantidade');
    const max = Number($q.attr('max')) || 1;
    let v = (parseInt($q.val(), 10) || 1) + delta;
    v = Math.max(1, Math.min(v, max));
    $q.val(v);
    $('[data-qtd="-1"]').prop('disabled', v <= 1);
    $('[data-qtd="1"]').prop('disabled', v >= max);
  }

  // ------------------------------------------------------------------ Eventos
  $('#miniaturas').on('click', 'button', function () {
    $('#miniaturas button').removeClass('ativo');
    $(this).addClass('ativo');
    const $img = $('#imagem-principal');
    $img.css('opacity', 0);
    setTimeout(() => $img.attr({ src: $(this).data('src'), alt: `${produto.nome} – ${$(this).data('vista')}` }).css('opacity', 1), 150);
  });

  // Zoom: acompanha a posição do mouse
  $('#galeria-principal')
    .on('click', function () { $(this).toggleClass('zoom'); if (!$(this).hasClass('zoom')) $('#imagem-principal').css('transform-origin', 'center'); })
    .on('mousemove', function (e) {
      if (!$(this).hasClass('zoom')) return;
      const o = $(this).offset();
      const x = ((e.pageX - o.left) / $(this).width()) * 100;
      const y = ((e.pageY - o.top) / $(this).height()) * 100;
      $('#imagem-principal').css('transform-origin', `${x}% ${y}%`);
    })
    .on('mouseleave', function () { $(this).removeClass('zoom'); });

  $('[data-qtd]').on('click', function () { ajustarQtd(Number($(this).data('qtd'))); });
  $('#quantidade').on('change', () => ajustarQtd(0));
  $('#tamanhos input').on('change', () => { $('#tamanhos').removeClass('invalido'); $('#erro-tamanho').hide(); });

  $('#form-compra').on('submit', function (e) {
    e.preventDefault();
    if (!produto) return;
    const tamanho = $('#tamanhos input:checked').val() || null;
    if (produto.temTamanhos && !tamanho) {
      $('#tamanhos').addClass('invalido');
      $('#erro-tamanho').show();
      $('#tamanhos input').first().trigger('focus');
      return;
    }
    if (carrinho.adicionar(produto, parseInt($('#quantidade').val(), 10) || 1, tamanho)) {
      $('#quantidade').val(1);
    }
  });
  $(document).on('carrinho:alterado', () => produto && atualizarEstoque());

  // ------------------------------------------------------------------ Avaliações
  // Calcula a distribuição das notas e monta comentários e formulário quando permitido.
  function montarAvaliacoes(r) {
    const lista = r.avaliacoes;
    $('#qtd-avaliacoes').text(lista.length);
    const media = lista.length ? lista.reduce((s, a) => s + a.nota, 0) / lista.length : null;
    $('#nota-media').text(media ? media.toFixed(1).replace('.', ',') : '–');
    $('#nota-estrelas').html(media ? estrelas(media) : estrelas(0));
    $('#nota-total').text(lista.length ? `${lista.length} ${lista.length === 1 ? 'avaliação' : 'avaliações'}` : 'Nenhuma avaliação ainda');
    $('#nota-barras').html([5, 4, 3, 2, 1].map(n => {
      const qtd = lista.filter(a => a.nota === n).length;
      const pct = lista.length ? (qtd / lista.length) * 100 : 0;
      return `<div class="d-flex align-items-center gap-2 mb-1"><span style="width:14px">${n}</span><i class="bi bi-star-fill text-warning small"></i>
        <div class="rs-barra-nota flex-grow-1"><div style="width:${pct}%"></div></div><span class="text-secondary" style="width:18px">${qtd}</span></div>`;
    }).join(''));

    $('#lista-avaliacoes').html(lista.length ? lista.map(a => `
      <article class="rs-avaliacao">
        <div class="d-flex justify-content-between align-items-start gap-3 mb-2">
          <div class="d-flex align-items-center gap-2">
            <span class="rs-avatar">${esc(a.autor[0])}</span>
            <div><strong class="d-block">${esc(a.autor)}</strong><span class="small text-success"><i class="bi bi-patch-check-fill"></i> Compra verificada</span></div>
          </div>
          <small class="text-secondary">${data(a.data)}</small>
        </div>
        ${estrelas(a.nota)}
        <p class="mt-2 mb-0">${esc(a.comentario)}</p>
      </article>`).join('')
      : '<div class="rs-vazio py-4"><i class="bi bi-chat-square-quote" aria-hidden="true"></i><p class="text-secondary mt-2">Este produto ainda não foi avaliado.</p></div>');

    RS.sessao().then(u => {
      if (r.podeAvaliar) {
        $('#area-avaliar').html(`
          <form class="rs-painel" id="form-avaliacao" novalidate>
            <h2 class="h3">Avalie este produto</h2>
            <fieldset class="mb-3">
              <legend class="form-label">Sua nota</legend>
              <div class="rs-escolher-nota">
                ${[5, 4, 3, 2, 1].map(n => `<input type="radio" name="nota" id="nota-${n}" value="${n}"><label for="nota-${n}" title="${n} estrela(s)"><i class="bi bi-star-fill"></i><span class="visually-hidden">${n} estrela(s)</span></label>`).join('')}
              </div>
              <div class="invalid-feedback">Escolha uma nota.</div>
            </fieldset>
            <div class="mb-3">
              <label for="comentario" class="form-label">Comentário</label>
              <textarea class="form-control" id="comentario" name="comentario" rows="4" maxlength="1000" placeholder="O que você achou do produto?" required></textarea>
              <div class="invalid-feedback"></div>
            </div>
            <button class="btn btn-rs w-100" type="submit">Enviar avaliação</button>
          </form>`);
      } else if (!u) {
        $('#area-avaliar').html('<p class="small text-secondary text-center"><a href="login.html?voltar=' + encodeURIComponent(RS.paginaAtual() + location.search) + '">Entre na sua conta</a> para avaliar produtos que você comprou.</p>');
      } else {
        $('#area-avaliar').html('<p class="small text-secondary text-center">Apenas clientes que compraram este produto podem avaliá-lo (uma avaliação por cliente).</p>');
      }
    });
  }

  $(document).on('submit', '#form-avaliacao', function (e) {
    e.preventDefault();
    const $f = $(this);
    const nota = $f.find('input[name="nota"]:checked').val();
    const comentario = $f.find('#comentario').val().trim();
    const erros = {};
    if (!nota) erros.nota = 'Escolha uma nota de 1 a 5.';
    if (comentario.length < 10) erros.comentario = 'Escreva pelo menos 10 caracteres.';
    if (Object.keys(erros).length) {
      RS.mostrarErros($f, erros);
      if (erros.nota) $f.find('fieldset .invalid-feedback').text(erros.nota).show();
      return;
    }
    const $btn = $f.find('button[type="submit"]').prop('disabled', true);
    api('POST', `/api/produtos/${produto.id}/avaliacoes`, { nota, comentario })
      .then(r => { aviso(r.mensagem, 'sucesso'); return api('GET', `/api/produtos/${encodeURIComponent(slug)}`); })
      .then(montarAvaliacoes)
      .catch(err => { aviso(err.erro, 'erro'); $btn.prop('disabled', false); });
  });

  // ------------------------------------------------------------------ Relacionados
  function montarRelacionados(lista) {
    if (!lista.length) return;
    registrarProdutos(lista);
    $('#relacionados').html(lista.map(p => `<div class="col">${cardProduto(p)}</div>`).join(''));
    $('#secao-relacionados').prop('hidden', false);
  }

  carregar();
});
