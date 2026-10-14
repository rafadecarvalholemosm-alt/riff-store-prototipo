/*
 * Riff Store: script comum a todas as páginas.
 * - Monta o cabeçalho e o rodapé
 * - Guarda o carrinho no localStorage
 * - Fornece funções de apoio (API, formatação, cards de produto, contagem regressiva, avisos)
 */
(function ($) {
  'use strict';

  const CHAVE_CARRINHO = 'riff_carrinho';

  // ------------------------------------------------------------------ Utilitários
  const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatoData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatoDataHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  function moeda(v) { return formatoMoeda.format(Number(v) || 0); }
  function data(d) { return formatoData.format(new Date(d)); }
  function dataHora(d) { return formatoDataHora.format(new Date(d)); }

  // Escapa texto antes de inseri-lo como HTML (evita injeção de código)
  function esc(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function parametro(nome) { return new URLSearchParams(location.search).get(nome); }

  const CONFIG = window.RS_CONFIG || { usarServidor: 'auto' };

  // Descobre se o site está rodando com o servidor Node/Express (dados no MySQL)
  // ou sem ele (Live Server, GitHub Pages...), quando os dados ficam no navegador.
  const modoServidor = (() => {
    if (CONFIG.usarServidor === true) return Promise.resolve(true);
    if (CONFIG.usarServidor === false || location.protocol === 'file:') return Promise.resolve(false);
    return new Promise(resolve => {
      $.ajax({ url: '/api/configuracoes', dataType: 'json', timeout: 4000 })
        .done(r => resolve(!!r && typeof r === 'object'))
        .fail(() => resolve(false));
    });
  })();

  // Requisição à API. Sem servidor, as rotas são atendidas pela API local
  // (js/api-local.js); com servidor, por AJAX (jQuery) para o Express.
  // Devolve uma Promise com o JSON da resposta.
  function api(metodo, url, dados) {
    return modoServidor.then(servidor => {
      if (!servidor && window.RS_API_LOCAL) return window.RS_API_LOCAL(metodo, url, dados);
      return requisicaoServidor(metodo, url, dados);
    });
  }

  function requisicaoServidor(metodo, url, dados) {
    return new Promise((resolve, reject) => {
      $.ajax({
        url,
        method: metodo,
        data: dados && metodo !== 'GET' ? JSON.stringify(dados) : dados,
        contentType: 'application/json; charset=utf-8',
        dataType: 'json'
      })
        .done(resolve)
        .fail(xhr => {
          const resp = xhr.responseJSON || {};
          reject({ status: xhr.status, erro: resp.erro || 'Não foi possível conectar ao servidor.', campos: resp.campos || {} });
        });
    });
  }

  // Nome do arquivo da página atual (ex.: "produto.html")
  function paginaAtual() { return location.pathname.split('/').pop() || 'index.html'; }

  // ------------------------------------------------------------------ Imagens de produto
  // As fotos ficam em img/fotos/ (geradas por "npm run fotos"). Se alguma não
  // carregar (ex.: imagem cadastrada errada no painel), mostra a imagem neutra.
  function reservaDaImagem(src) {
    return /img\/fotos\//.test(src) ? 'img/site/sem-imagem.svg' : null;
  }
  document.addEventListener('error', e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.reserva) return;
    const reserva = reservaDaImagem(img.getAttribute('src') || '');
    if (reserva) { img.dataset.reserva = '1'; img.src = reserva; }
  }, true);

  // ------------------------------------------------------------------ Fotos
  // Procura a foto em img/fotos/<nome>.jpg; se não existir, carrega do Unsplash.
  const cacheFotos = new Map();
  function urlsDaFoto(nome) {
    const f = (window.RS_FOTOS || {})[nome];
    const urls = [`img/fotos/${nome}.jpg`];
    if (f) urls.push(`https://unsplash.com/photos/${f[0]}/download?force=true&w=${f[1]}`);
    return urls;
  }
  function carregarFoto(nome) {
    if (!cacheFotos.has(nome)) {
      cacheFotos.set(nome, new Promise((resolve, reject) => {
        const urls = urlsDaFoto(nome);
        const tentar = i => {
          if (i >= urls.length) return reject(new Error(`foto indisponível: ${nome}`));
          const img = new Image();
          // endereço absoluto: em variáveis CSS um caminho relativo seria lido a partir da pasta css/
          img.onload = () => resolve(new URL(urls[i], location.href).href);
          img.onerror = () => tentar(i + 1);
          img.src = urls[i];
        };
        tentar(0);
      }));
    }
    return cacheFotos.get(nome);
  }
  // <img data-foto="nome"> e elementos com fundo data-bg-foto="nome"
  function aplicarFotos(contexto) {
    $(contexto || document).find('img[data-foto]').each(function () {
      const $img = $(this);
      const nome = $img.attr('data-foto');
      $img.removeAttr('data-foto').addClass('rs-foto');
      carregarFoto(nome).then(url => $img.attr('src', url).addClass('carregada'))
        .catch(() => { if ($img.data('fallback')) $img.attr('src', $img.data('fallback')).addClass('carregada'); });
    });
    $(contexto || document).find('[data-bg-foto]').each(function () {
      const el = this;
      const nome = el.getAttribute('data-bg-foto');
      el.removeAttribute('data-bg-foto');
      carregarFoto(nome).then(url => { el.style.setProperty('--foto', `url("${url}")`); el.classList.add('com-foto'); }).catch(() => {});
    });
  }

  // ------------------------------------------------------------------ Avisos (toasts)
  function aviso(mensagem, tipo = 'info', opcoes = {}) {
    let $caixa = $('#rs-toasts');
    if (!$caixa.length) $caixa = $('<div id="rs-toasts" class="rs-toasts" role="status" aria-live="polite"></div>').appendTo('body');
    const icone = { sucesso: 'bi-check-circle-fill', erro: 'bi-exclamation-octagon-fill', info: 'bi-info-circle-fill' }[tipo] || 'bi-info-circle-fill';
    const $t = $(`
      <div class="rs-toast ${tipo}">
        ${opcoes.imagem ? `<img src="${esc(opcoes.imagem)}" alt="">` : `<i class="bi ${icone}" aria-hidden="true"></i>`}
        <div class="small"><div class="fw-semibold">${esc(mensagem)}</div>${opcoes.html || ''}</div>
        <button type="button" class="fechar" aria-label="Fechar aviso"><i class="bi bi-x-lg"></i></button>
      </div>`);
    $caixa.append($t);
    const fechar = () => { $t.addClass('saindo'); setTimeout(() => $t.remove(), 300); };
    $t.find('.fechar').on('click', fechar);
    setTimeout(fechar, opcoes.duracao || 4200);
  }

  // ------------------------------------------------------------------ Carrinho (localStorage)
  const carrinho = {
    itens() {
      try { return JSON.parse(localStorage.getItem(CHAVE_CARRINHO)) || []; } catch (e) { return []; }
    },
    salvar(itens) {
      localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(itens));
      atualizarBadge(true);
      $(document).trigger('carrinho:alterado');
    },
    chave(id, tamanho) { return `${id}|${tamanho || ''}`; },
    adicionar(produto, quantidade = 1, tamanho = null) {
      const itens = this.itens();
      const chave = this.chave(produto.id, tamanho);
      const existente = itens.find(i => i.chave === chave);
      const noCarrinho = itens.filter(i => i.id === produto.id).reduce((s, i) => s + i.quantidade, 0);
      if (noCarrinho + quantidade > produto.estoque) {
        aviso(`Só temos ${produto.estoque} unidade(s) de "${produto.nome}" em estoque.`, 'erro');
        return false;
      }
      if (existente) {
        existente.quantidade += quantidade;
        existente.preco = produto.precoFinal;
      } else {
        itens.push({
          chave, id: produto.id, slug: produto.slug, nome: produto.nome, banda: produto.banda,
          imagem: produto.imagem, preco: produto.precoFinal, estoque: produto.estoque, tamanho, quantidade
        });
      }
      this.salvar(itens);
      aviso('Produto adicionado ao carrinho', 'sucesso', {
        imagem: produto.imagem,
        html: `<div class="text-white-50">${esc(produto.nome)}${tamanho ? ` · ${esc(tamanho)}` : ''}</div><a href="carrinho.html">Ver carrinho →</a>`
      });
      return true;
    },
    alterar(chave, quantidade) {
      const itens = this.itens();
      const item = itens.find(i => i.chave === chave);
      if (!item) return;
      item.quantidade = Math.max(1, Math.min(quantidade, item.estoque, 20));
      this.salvar(itens);
    },
    remover(chave) { this.salvar(this.itens().filter(i => i.chave !== chave)); },
    limpar() { this.salvar([]); },
    quantidade() { return this.itens().reduce((s, i) => s + i.quantidade, 0); },
    subtotal() { return Math.round(this.itens().reduce((s, i) => s + i.preco * i.quantidade, 0) * 100) / 100; }
  };

  const FRETE = { valor: 19.90, gratisAPartir: 299 };
  function calcularFrete(subtotal) { return subtotal >= FRETE.gratisAPartir || subtotal === 0 ? 0 : FRETE.valor; }

  // ------------------------------------------------------------------ Cupom de desconto
  // O cupom aplicado no carrinho fica no navegador ({ codigo, percentual }); o servidor confere de novo ao fechar o pedido.
  const CHAVE_CUPOM = 'riff_cupom';
  const cupom = {
    atual() {
      try { return JSON.parse(localStorage.getItem(CHAVE_CUPOM)); } catch (e) { return null; }
    },
    salvar(c) { try { localStorage.setItem(CHAVE_CUPOM, JSON.stringify(c)); } catch (e) { /* ignora */ } },
    remover() { try { localStorage.removeItem(CHAVE_CUPOM); } catch (e) { /* ignora */ } },
    // e-mail inscrito na newsletter neste navegador (ajuda a liberar o cupom antes do login)
    emailNewsletter() { try { return localStorage.getItem('riff_newsletter') || ''; } catch (e) { return ''; } },
    validar(codigo) { return api('POST', '/api/cupons/validar', { codigo, email: this.emailNewsletter() }); },
    desconto(subtotal) {
      const c = this.atual();
      return c ? Math.round(subtotal * c.percentual) / 100 : 0;
    }
  };

  function atualizarBadge(animar) {
    const qtd = carrinho.quantidade();
    const $b = $('.rs-badge-carrinho');
    $b.text(qtd).toggle(qtd > 0);
    $('#btn-carrinho').attr('aria-label', `Carrinho (${qtd} ${qtd === 1 ? 'item' : 'itens'})`);
    if (animar) { $b.removeClass('pulo'); void $b[0]?.offsetWidth; $b.addClass('pulo'); }
  }

  // ------------------------------------------------------------------ Componentes
  function estrelas(nota, total) {
    if (nota === null || nota === undefined) return '';
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<i class="bi ${nota >= i ? 'bi-star-fill' : nota >= i - 0.5 ? 'bi-star-half' : 'bi-star'}" aria-hidden="true"></i>`;
    }
    return `<span class="rs-estrelas" title="Nota ${Number(nota).toFixed(1)} de 5">${html}<span class="visually-hidden">Nota ${Number(nota).toFixed(1)} de 5</span>${total !== undefined ? `<small>(${total})</small>` : ''}</span>`;
  }

  function selos(p) {
    const nomes = { novo: 'Novo', promocao: 'Promoção', esgotado: 'Esgotado' };
    return `<div class="rs-selos">${p.selos.map(s => `<span class="rs-selo rs-selo-${s}">${nomes[s]}</span>`).join('')}</div>`;
  }

  function parcelas(valor) {
    const n = Math.min(Math.floor(valor / 30), 6);
    return n >= 2 ? `ou ${n}x de ${moeda(valor / n)}` : 'à vista no Pix';
  }

  // Card de produto usado na vitrine, destaques e ofertas
  function cardProduto(p, opcoes = {}) {
    const esgotado = p.estoque <= 0;
    const link = `produto.html?slug=${encodeURIComponent(p.slug)}`;
    return `
      <article class="rs-card ${esgotado ? 'esgotado' : ''}">
        <div class="rs-card-img">
          ${selos(p)}
          <img src="${esc(p.imagem)}" alt="${esc(p.nome)}" loading="lazy" width="400" height="400">
          ${esgotado ? '' : `<button type="button" class="rs-card-rapido" data-adicionar="${p.id}" aria-label="Adicionar ${esc(p.nome)} ao carrinho" title="${p.temTamanhos ? 'Escolher tamanho' : 'Adicionar ao carrinho'}"><i class="bi ${p.temTamanhos ? 'bi-arrows-angle-expand' : 'bi-bag-plus'}"></i></button>`}
        </div>
        <div class="rs-card-corpo">
          <span class="rs-card-banda">${esc(p.banda)}</span>
          <h3 class="rs-card-nome"><a href="${link}">${esc(p.nome)}</a></h3>
          ${p.mediaNotas ? `<div class="mb-2">${estrelas(p.mediaNotas, p.totalAvaliacoes)}</div>` : ''}
          ${opcoes.contagem && p.promocaoFim ? `<div class="mb-2"><span class="rs-contagem-mini" data-contagem-mini="${esc(p.promocaoFim)}"><i class="bi bi-alarm"></i> <span>--</span></span></div>` : ''}
          <div class="rs-card-preco">
            <span class="rs-preco">${moeda(p.precoFinal)}</span>
            ${p.precoOriginal ? `<span class="rs-preco-antigo">${moeda(p.precoOriginal)}</span>` : ''}
          </div>
          <div class="rs-parcela">${esgotado ? 'Indisponível no momento' : parcelas(p.precoFinal)}</div>
          <a href="${link}" class="btn ${esgotado ? 'btn-rs-sec' : 'btn-rs'} btn-sm w-100">${esgotado ? 'Avise-me' : 'Ver detalhes'}</a>
        </div>
      </article>`;
  }

  // Guarda os produtos exibidos para a compra rápida pelos cards
  const produtosNaTela = new Map();
  function registrarProdutos(lista) { lista.forEach(p => produtosNaTela.set(String(p.id), p)); }

  $(document).on('click', '[data-adicionar]', function (e) {
    e.preventDefault();
    const p = produtosNaTela.get(String($(this).data('adicionar')));
    if (!p) return;
    if (p.temTamanhos) {
      location.href = `produto.html?slug=${encodeURIComponent(p.slug)}#comprar`;
      return;
    }
    carrinho.adicionar(p, 1);
  });

  // ------------------------------------------------------------------ Contagem regressiva
  function partesTempo(fim) {
    const ms = Math.max(0, new Date(fim).getTime() - Date.now());
    return {
      ms,
      dias: Math.floor(ms / 86400000),
      horas: Math.floor(ms / 3600000) % 24,
      minutos: Math.floor(ms / 60000) % 60,
      segundos: Math.floor(ms / 1000) % 60
    };
  }
  const dois = n => String(n).padStart(2, '0');

  // Contagem grande: <div data-contagem="ISO"></div>
  function montarContagem($el, fim, aoTerminar) {
    $el.addClass('rs-contagem').attr({ role: 'timer', 'aria-live': 'off' }).html(
      ['dias', 'horas', 'min', 'seg'].map(r => `<div class="bloco"><span class="num">00</span><span class="rot">${r}</span></div>`).join('')
    );
    const $nums = $el.find('.num');
    const tick = () => {
      const t = partesTempo(fim);
      [t.dias, t.horas, t.minutos, t.segundos].forEach((v, i) => $nums.eq(i).text(dois(v)));
      $el.attr('aria-label', `Termina em ${t.dias} dias, ${t.horas} horas e ${t.minutos} minutos`);
      if (t.ms <= 0) { clearInterval(id); if (aoTerminar) aoTerminar(); }
    };
    const id = setInterval(tick, 1000);
    tick();
  }

  // Contagens pequenas dos cards (um único intervalo para todas)
  setInterval(atualizarContagensMini, 1000);
  function atualizarContagensMini() {
    $('[data-contagem-mini]').each(function () {
      const t = partesTempo($(this).data('contagemMini'));
      const $card = $(this).closest('.rs-card');
      if (t.ms <= 0) {
        // a oferta sai do ar ao expirar
        $card.closest('[class*="col"]').fadeOut(400);
        $(this).remove();
        return;
      }
      $(this).find('span').text(`${t.dias ? t.dias + 'd ' : ''}${dois(t.horas)}:${dois(t.minutos)}:${dois(t.segundos)}`);
    });
  }

  // ------------------------------------------------------------------ Validação de formulários
  function mostrarErros($form, campos) {
    $form.find('.is-invalid').removeClass('is-invalid');
    Object.entries(campos || {}).forEach(([nome, msg]) => {
      const $campo = $form.find(`[name="${nome}"]`);
      $campo.addClass('is-invalid');
      let $fb = $campo.closest('.rs-campo, .mb-3, [class*="col"]').find('.invalid-feedback').first();
      if (!$fb.length) $fb = $('<div class="invalid-feedback"></div>').insertAfter($campo.closest('.rs-senha').length ? $campo.closest('.rs-senha') : $campo);
      $fb.text(msg).show();
    });
    $form.find('.is-invalid').first().trigger('focus');
  }
  function limparErros($form) {
    $form.find('.is-invalid').removeClass('is-invalid');
    $form.find('.invalid-feedback').text('');
  }
  const regex = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    telefone: /^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/,
    cep: /^\d{5}-?\d{3}$/
  };

  // Máscaras simples de telefone e CEP
  $(document).on('input', 'input[data-mascara="telefone"]', function () {
    const d = this.value.replace(/\D/g, '').slice(0, 11);
    this.value = d.length > 10
      ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
      : d.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (m, a, b, c) => (b ? `(${a}) ${b}${c ? '-' + c : ''}` : a));
  });
  $(document).on('input', 'input[data-mascara="cep"]', function () {
    const d = this.value.replace(/\D/g, '').slice(0, 8);
    this.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  });
  // Mostrar / ocultar senha
  $(document).on('click', '.rs-senha button', function () {
    const $in = $(this).siblings('input');
    const mostrar = $in.attr('type') === 'password';
    $in.attr('type', mostrar ? 'text' : 'password');
    $(this).attr('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha').find('i').toggleClass('bi-eye bi-eye-slash');
  });

  // ------------------------------------------------------------------ Sessão
  let usuarioAtual = null;
  const sessaoPronta = api('GET', '/api/auth/me')
    .then(r => { usuarioAtual = r.usuario; return usuarioAtual; })
    .catch(() => null);

  function sair() {
    api('POST', '/api/auth/logout').finally(() => { location.href = 'index.html'; });
  }

  // ------------------------------------------------------------------ Cabeçalho e rodapé
  const LOGO = `
    <a class="rs-logo navbar-brand me-lg-4" href="index.html" aria-label="Riff Store – página inicial">
      <img src="img/site/mao-chifrada.svg" alt="" width="35" height="46">
      <span><span class="rs-logo-nome">Riff Store</span><span class="rs-logo-sub">Merch &amp; Vinis de Rock</span></span>
    </a>`;

  function montarCabecalho() {
    const pagina = $('body').data('pagina');
    const ativo = nome => (pagina === nome ? ' active" aria-current="page' : '');
    const promo = parametro('promocao') === '1';

    const avisos = [
      '<i class="bi bi-truck"></i> <strong>Frete grátis</strong> em compras acima de R$ 299',
      '<i class="bi bi-credit-card"></i> Parcele em <strong>até 6x sem juros</strong> no cartão',
      '<i class="bi bi-arrow-repeat"></i> <strong>Primeira troca grátis</strong> em até 30 dias',
      '<i class="bi bi-lightning-charge"></i> Pagou no Pix? <strong>Aprovação na hora</strong>'
    ];
    const $aviso = $(`<div class="rs-aviso" aria-live="polite"><div class="container"><span class="rs-aviso-texto">${avisos[0]}</span></div></div>`).insertBefore('#topo');
    let indiceAviso = 0;
    setInterval(() => {
      indiceAviso = (indiceAviso + 1) % avisos.length;
      const $t = $aviso.find('.rs-aviso-texto');
      $t.addClass('trocando');
      setTimeout(() => $t.html(avisos[indiceAviso]).removeClass('trocando'), 350);
    }, 4500);

    $('#topo').addClass('rs-header').html(`
      <nav class="navbar navbar-expand-lg navbar-dark rs-navbar" aria-label="Navegação principal">
        <div class="container">
          ${LOGO}
          <div class="rs-acoes order-lg-3 ms-auto">
            <button class="btn-icone" type="button" data-bs-toggle="collapse" data-bs-target="#rs-busca" aria-expanded="false" aria-controls="rs-busca" aria-label="Abrir busca"><i class="bi bi-search"></i></button>
            <div class="dropdown" id="rs-menu-conta">
              <a class="btn-icone" href="login.html" aria-label="Entrar ou criar conta"><i class="bi bi-person"></i></a>
            </div>
            <a class="btn-icone" id="btn-carrinho" href="carrinho.html" aria-label="Carrinho"><i class="bi bi-bag"></i><span class="rs-badge-carrinho" style="display:none">0</span></a>
            <button class="navbar-toggler ms-1" type="button" data-bs-toggle="collapse" data-bs-target="#rs-menu" aria-controls="rs-menu" aria-expanded="false" aria-label="Abrir menu"><i class="bi bi-list"></i></button>
          </div>
          <div class="collapse navbar-collapse order-lg-2" id="rs-menu">
            <ul class="navbar-nav">
              <li class="nav-item"><a class="nav-link${ativo('home')}" href="index.html">Home</a></li>
              <li class="nav-item"><a class="nav-link${pagina === 'produtos' && !promo ? ' active" aria-current="page' : ''}" href="produtos.html">Produtos</a></li>
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="produtos.html" role="button" data-bs-toggle="dropdown" aria-expanded="false">Bandas <i class="bi bi-chevron-down small ms-1"></i></a>
                <div class="dropdown-menu rs-dropdown-bandas">
                  <h6 class="dropdown-header">Navegue por banda</h6>
                  <div class="rs-bandas-grid" id="rs-lista-bandas"><span class="dropdown-item-text small text-secondary">Carregando...</span></div>
                </div>
              </li>
              <li class="nav-item"><a class="nav-link${promo ? ' active" aria-current="page' : ''}" href="produtos.html?promocao=1">Promoções</a></li>
              <li class="nav-item"><a class="nav-link${ativo('sobre')}" href="sobre.html">Sobre</a></li>
              <li class="nav-item"><a class="nav-link${ativo('contato')}" href="contato.html">Contato</a></li>
            </ul>
          </div>
        </div>
      </nav>
      <div class="collapse rs-busca" id="rs-busca">
        <div class="container py-3">
          <form action="produtos.html" method="get" role="search">
            <label for="rs-campo-busca" class="visually-hidden">Buscar produtos ou bandas</label>
            <i class="bi bi-search" aria-hidden="true"></i>
            <input type="search" class="form-control form-control-lg" id="rs-campo-busca" name="busca" placeholder="Busque por produto ou banda..." autocomplete="off" value="${esc(parametro('busca') || '')}">
          </form>
          <div class="rs-sugestoes mt-2"><span class="small text-secondary me-1">Populares:</span>
            <a href="produtos.html?busca=Nirvana">Nirvana</a><a href="produtos.html?categoria=vinil">Vinis</a>
            <a href="produtos.html?busca=AC%2FDC">AC/DC</a><a href="produtos.html?busca=Queen">Queen</a><a href="produtos.html?promocao=1">Ofertas</a>
          </div>
        </div>
      </div>`);

    $('#rs-busca').on('shown.bs.collapse', () => $('#rs-campo-busca').trigger('focus'));

    // Lista de bandas no menu (abre a vitrine filtrada)
    api('GET', '/api/bandas').then(bandas => {
      $('#rs-lista-bandas').html(bandas.map(b =>
        `<a class="dropdown-item" href="produtos.html?bandas=${encodeURIComponent(b.nome)}">${esc(b.nome)}</a>`).join(''));
    }).catch(() => $('#rs-lista-bandas').html('<span class="dropdown-item-text small">Indisponível</span>'));

    sessaoPronta.then(montarMenuConta);
    atualizarBadge(false);
  }

  function montarMenuConta(u) {
    if (!u) return;
    const iniciais = u.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
    $('#rs-menu-conta').html(`
      <button class="btn-icone" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Menu da conta de ${esc(u.nome)}">
        <span class="rs-avatar">${esc(iniciais)}</span>
      </button>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><h6 class="dropdown-header">Olá, ${esc(u.nome.split(' ')[0])}</h6></li>
        ${u.perfil === 'admin' ? '<li><a class="dropdown-item" href="admin.html"><i class="bi bi-speedometer2 me-2"></i>Painel administrativo</a></li>' : ''}
        <li><a class="dropdown-item" href="conta.html"><i class="bi bi-box-seam me-2"></i>Meus pedidos</a></li>
        <li><a class="dropdown-item" href="conta.html#dados"><i class="bi bi-person-gear me-2"></i>Meus dados</a></li>
        <li><hr class="dropdown-divider"></li>
        <li><button class="dropdown-item" type="button" data-sair><i class="bi bi-box-arrow-right me-2"></i>Sair</button></li>
      </ul>`);
  }
  $(document).on('click', '[data-sair]', sair);

  function montarRodape() {
    const ano = new Date().getFullYear();
    $('#rodape').addClass('rs-footer').html(`
      <section class="rs-newsletter" data-bg-foto="publico-maos-pb" aria-labelledby="titulo-news">
        <div class="container">
          <div class="row align-items-center g-4">
            <div class="col-lg-6">
              <span class="rs-kicker claro">Newsletter</span>
              <h2 id="titulo-news" class="rs-display mt-2 mb-2">Ganhe 10% de desconto</h2>
              <p class="mb-0 text-white-50">Cadastre seu e-mail e receba o cupom <strong class="text-white">ROCK10</strong>, além de lançamentos, pré-vendas de vinil e ofertas antes de todo mundo.</p>
            </div>
            <div class="col-lg-6">
              <form class="rs-form-news" id="form-news" novalidate>
                <label for="news-email" class="visually-hidden">Seu e-mail</label>
                <input type="email" id="news-email" class="form-control form-control-lg" placeholder="Digite seu melhor e-mail" autocomplete="email" required>
                <button class="btn btn-rs btn-lg" type="submit">Quero o cupom</button>
              </form>
              <small class="text-white-50 d-block mt-2">Sem spam. Você pode cancelar quando quiser.</small>
            </div>
          </div>
        </div>
      </section>
      <div class="container rs-footer-principal">
        <div class="row g-4 g-lg-5">
          <div class="col-lg-3">
            ${LOGO.replace('navbar-brand me-lg-4', 'mb-3')}
            <p class="mt-3 mb-4 small rs-footer-sobre">Camisetas de bandas, discos de vinil, CDs, pôsteres e acessórios para quem vive o rock. Música. Estilo. Atitude.</p>
            <span class="rs-rotulo-base">Siga a Riff Store</span>
            <div class="rs-redes" id="rs-redes-rodape"></div>
          </div>
          <div class="col-6 col-md-3 col-lg-2">
            <h2>Loja</h2>
            <ul>
              <li><a href="produtos.html?categoria=camisetas">Camisetas</a></li>
              <li><a href="produtos.html?categoria=vinil">Discos de vinil</a></li>
              <li><a href="produtos.html?categoria=cds">CDs</a></li>
              <li><a href="produtos.html?categoria=posteres">Pôsteres</a></li>
              <li><a href="produtos.html?categoria=acessorios">Acessórios</a></li>
              <li><a href="produtos.html?promocao=1" class="rs-link-oferta">Promoções</a></li>
            </ul>
          </div>
          <div class="col-6 col-md-3 col-lg-2">
            <h2>Ajuda</h2>
            <ul>
              <li><a href="conta.html">Minha conta</a></li>
              <li><a href="conta.html">Meus pedidos</a></li>
              <li><a href="contato.html#faq-trocas">Trocas e devoluções</a></li>
              <li><a href="contato.html#faq-entregas">Prazos de entrega</a></li>
              <li><a href="contato.html#faq-tamanhos">Tabela de medidas</a></li>
              <li><a href="contato.html#faq">Perguntas frequentes</a></li>
            </ul>
          </div>
          <div class="col-6 col-md-3 col-lg-2">
            <h2>Institucional</h2>
            <ul>
              <li><a href="sobre.html">Sobre nós</a></li>
              <li><a href="contato.html">Fale conosco</a></li>
              <li><a href="#" data-politica="privacidade">Política de privacidade</a></li>
              <li><a href="#" data-politica="termos">Termos de uso</a></li>
            </ul>
          </div>
          <div class="col-md-6 col-lg-3">
            <h2>Atendimento</h2>
            <ul class="rs-footer-contato" id="rs-contato-rodape"></ul>
          </div>
        </div>
      </div>
      <div class="rs-footer-selos">
        <div class="container">
          <div class="row g-4">
            <div class="col-lg-7">
              <span class="rs-rotulo-base">Formas de pagamento</span>
              <ul class="rs-bandeiras" aria-label="Formas de pagamento aceitas">
                <li title="Visa"><img src="img/pagamentos/visa.svg" alt="Visa"></li>
                <li title="Mastercard"><img src="img/pagamentos/mastercard.svg" alt="Mastercard"></li>
                <li title="Elo"><img src="img/pagamentos/elo.svg" alt="Elo"></li>
                <li class="quadrado" title="American Express"><img src="img/pagamentos/amex.svg" alt="American Express"></li>
                <li title="Hipercard"><img src="img/pagamentos/hipercard.svg" alt="Hipercard"></li>
                <li title="Diners Club"><img src="img/pagamentos/diners.svg" alt="Diners Club"></li>
                <li title="Pix"><img src="img/pagamentos/pix.svg" alt="Pix"></li>
                <li title="Boleto bancário"><img src="img/pagamentos/boleto.svg" alt="Boleto bancário"></li>
              </ul>
              <p class="rs-footer-nota">Em até <strong>6x sem juros</strong> no cartão · Pix com aprovação imediata</p>
            </div>
            <div class="col-sm-4 col-lg-2">
              <span class="rs-rotulo-base">Entrega</span>
              <ul class="rs-bandeiras" aria-label="Transportadora">
                <li class="largo" title="Correios"><img src="img/envio/correios.svg" alt="Correios"></li>
              </ul>
              <p class="rs-footer-nota">Para todo o Brasil, com rastreio</p>
            </div>
            <div class="col-sm-8 col-lg-3">
              <span class="rs-rotulo-base">Compra segura</span>
              <ul class="rs-selos-seguranca">
                <li><i class="bi bi-shield-lock-fill" aria-hidden="true"></i><span><strong>Site protegido</strong><small>Conexão criptografada (SSL)</small></span></li>
                <li><i class="bi bi-credit-card-2-front-fill" aria-hidden="true"></i><span><strong>Pagamento seguro</strong><small>Dados do cartão não ficam salvos</small></span></li>
                <li><i class="bi bi-arrow-repeat" aria-hidden="true"></i><span><strong>Troca garantida</strong><small>Primeira troca grátis em 30 dias</small></span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div class="rs-footer-base">
        <div class="container">
          <div class="rs-footer-legal">
            <p class="mb-1">© ${ano} Riff Store · Merch &amp; Vinis de Rock. Todos os direitos reservados.</p>
            <p class="mb-0">Loja fictícia, criada como trabalho da disciplina Programação para Web I (FACOM/UFU, Monte Carmelo – MG). Nenhuma venda ou cobrança é realizada. Marcas e capas pertencem aos seus donos.</p>
          </div>
          <a href="#topo" class="rs-voltar-topo" id="rs-voltar-topo"><i class="bi bi-arrow-up" aria-hidden="true"></i> Voltar ao topo</a>
        </div>
      </div>`);

    configuracoes.then(c => {
      if (!c) return;
      const redes = [['instagram', 'bi-instagram', 'Instagram'], ['facebook', 'bi-facebook', 'Facebook'], ['youtube', 'bi-youtube', 'YouTube'], ['whatsapp', 'bi-whatsapp', 'WhatsApp']];
      $('#rs-redes-rodape').html(redes.filter(([k]) => c[k]).map(([k, i, n]) => {
        const url = k === 'whatsapp' ? `https://wa.me/55${c[k].replace(/\D/g, '')}` : c[k];
        return `<a href="${esc(url)}" target="_blank" rel="noopener" aria-label="${n} da Riff Store"><i class="bi ${i}"></i></a>`;
      }).join(''));
      $('#rs-contato-rodape').html(`
        ${c.telefone ? `<li><a href="tel:+55${esc(c.telefone.replace(/\D/g, ''))}"><i class="bi bi-telephone me-2"></i>${esc(c.telefone)}</a></li>` : ''}
        ${c.whatsapp ? `<li><a href="https://wa.me/55${esc(c.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener"><i class="bi bi-whatsapp me-2"></i>${esc(c.whatsapp)}</a></li>` : ''}
        ${c.email ? `<li><a href="mailto:${esc(c.email)}"><i class="bi bi-envelope me-2"></i>${esc(c.email)}</a></li>` : ''}
        ${c.horario ? `<li><i class="bi bi-clock me-2"></i>${esc(c.horario)}</li>` : ''}`);
    });
  }

  // Newsletter: inscreve o e-mail e libera o cupom ROCK10
  $(document).on('submit', '#form-news', function (e) {
    e.preventDefault();
    const $in = $('#news-email');
    const $btn = $(this).find('button[type="submit"]');
    const email = $in.val().trim();
    if (!regex.email.test(email)) { $in.addClass('is-invalid').trigger('focus'); aviso('Informe um e-mail válido.', 'erro'); return; }
    $in.removeClass('is-invalid');
    $btn.prop('disabled', true);
    api('POST', '/api/newsletter', { email })
      .then(r => {
        $in.val('');
        try { localStorage.setItem('riff_newsletter', email.toLowerCase()); } catch (err) { /* ignora */ }
        aviso(`${r.mensagem} Digite o cupom no carrinho.`, 'sucesso', { duracao: 8000 });
      })
      .catch(err => aviso(err.erro, 'erro'))
      .finally(() => $btn.prop('disabled', false));
  });

  // Política de privacidade e termos de uso (janela modal)
  const POLITICAS = {
    privacidade: ['Política de privacidade', `
      <p>A Riff Store usa seus dados apenas para processar pedidos, entregar produtos e, se você autorizar, enviar novidades por e-mail.</p>
      <p>Não vendemos nem compartilhamos seus dados com terceiros, exceto quando necessário para a entrega (transportadora) e o pagamento.</p>
      <p>Senhas são guardadas de forma criptografada. Você pode pedir a exclusão da sua conta a qualquer momento pelo <a href="contato.html">Fale conosco</a>.</p>`],
    termos: ['Termos de uso', `
      <p>Os preços e o estoque podem mudar sem aviso. Ofertas com contagem regressiva valem até o fim do cronômetro ou enquanto durar o estoque.</p>
      <p>Você tem 7 dias após o recebimento para desistir da compra e 30 dias para a primeira troca grátis, com o produto sem uso e na embalagem original.</p>
      <p>Imagens meramente ilustrativas. Em caso de dúvidas, fale com a gente.</p>`]
  };
  $(document).on('click', '[data-politica]', function (e) {
    e.preventDefault();
    const [titulo, html] = POLITICAS[$(this).data('politica')];
    let $m = $('#modal-politica');
    if (!$m.length) {
      $m = $(`<div class="modal fade" id="modal-politica" tabindex="-1" aria-labelledby="titulo-politica" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
          <div class="modal-header"><h2 class="modal-title h3" id="titulo-politica"></h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div>
          <div class="modal-body"></div></div></div></div>`).appendTo('body');
    }
    $m.find('.modal-title').text(titulo);
    $m.find('.modal-body').html(html);
    bootstrap.Modal.getOrCreateInstance($m[0]).show();
  });

  const configuracoes = api('GET', '/api/configuracoes').catch(() => null);

  // Exige login: redireciona para o login e volta para a página atual depois
  function exigirLogin(perfil) {
    return sessaoPronta.then(u => {
      if (!u) {
        location.href = `login.html?voltar=${encodeURIComponent(paginaAtual() + location.search)}`;
        return new Promise(() => {});
      }
      if (perfil === 'admin' && u.perfil !== 'admin') {
        location.href = 'index.html';
        return new Promise(() => {});
      }
      return u;
    });
  }

  // ------------------------------------------------------------------ Inicialização
  $(function () {
    if ($('#topo').length) montarCabecalho();
    if ($('#rodape').length) montarRodape();
    aplicarFotos();
    // sincroniza o carrinho entre abas abertas
    window.addEventListener('storage', e => { if (e.key === CHAVE_CARRINHO) { atualizarBadge(true); $(document).trigger('carrinho:alterado'); } });
  });

  // API pública usada pelos scripts de cada página
  window.RS = {
    api, moeda, data, dataHora, esc, parametro, aviso, carrinho, calcularFrete, FRETE, cupom,
    estrelas, selos, parcelas, cardProduto, registrarProdutos, montarContagem, atualizarContagensMini,
    mostrarErros, limparErros, regex, sessao: () => sessaoPronta, exigirLogin, configuracoes: () => configuracoes,
    aplicarFotos, carregarFoto, paginaAtual, config: CONFIG, modoServidor: () => modoServidor
  };
})(jQuery);
