/* Controlador da página admin.html.
 * Painel com seções selecionadas pelo fragmento # da URL.
 * Cada carregador busca dados da API e monta tabelas, cards ou formulários.
 * A interface confere o perfil, e as rotas do servidor também exigem administrador.
 */
// Painel administrativo: resumo, produtos, pedidos, usuários, avaliações, mensagens e configurações.
$(function () {
  const { api, esc, moeda, data, dataHora, aviso, mostrarErros, limparErros, exigirLogin, estrelas } = RS;
  const STATUS = [['recebido', 'Recebido'], ['em_separacao', 'Em separação'], ['enviado', 'Enviado'], ['entregue', 'Entregue']];
  const NOME_STATUS = Object.fromEntries(STATUS);
  const ASSUNTOS = { duvida: 'Dúvida sobre produto', pedido: 'Meu pedido', troca: 'Troca ou devolução', sugestao: 'Sugestão', outro: 'Outro assunto' };
  const PAGAMENTOS = { pix: 'Pix', cartao: 'Cartão de crédito', boleto: 'Boleto' };
  const num = id => `#${String(id).padStart(4, '0')}`;

  let produtos = [];
  let categorias = [];
  let pedidos = [];

  // As rotas do painel só respondem a administradores; a página também confere o perfil
  exigirLogin('admin').then(() => {
    $('#admin').prop('hidden', false);
    $('#data-hoje').text(new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date()));
    api('GET', '/api/categorias').then(c => {
      categorias = c;
      $('#p-categoria').html(c.map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join(''));
      $('#filtro-cat-admin').append(c.map(x => `<option value="${esc(x.slug)}">${esc(x.nome)}</option>`).join(''));
    });
    abrirSecao();
  });

  // ------------------------------------------------------------------ Navegação por seções (#hash)
  const carregadores = {
    dashboard: carregarResumo, produtos: carregarProdutos, pedidos: carregarPedidos, usuarios: carregarUsuarios,
    avaliacoes: carregarAvaliacoes, mensagens: carregarMensagens, configuracoes: carregarConfig
  };
  function abrirSecao() {
    // O # da URL seleciona o painel e permite voltar a ele por um link direto, sem criar outro HTML.
    const secao = location.hash.slice(1) in carregadores ? location.hash.slice(1) : 'dashboard';
    $('[data-painel]').prop('hidden', true);
    $(`[data-painel="${secao}"]`).prop('hidden', false);
    $('[data-secao]').removeClass('active').removeAttr('aria-current');
    $(`[data-secao="${secao}"]`).addClass('active').attr('aria-current', 'page');
    document.title = `${$(`[data-secao="${secao}"]`).text().trim()} | Painel Riff Store`;
    carregadores[secao]();
  }
  window.addEventListener('hashchange', abrirSecao);

  const erroTabela = (cols) => err => `<tr><td colspan="${cols}" class="text-danger">${esc(err.erro)}</td></tr>`;
  const statusBadge = s => `<span class="rs-status rs-status-${s}">${NOME_STATUS[s]}</span>`;

  function atualizarBadges(r) {
    $('#badge-pedidos').text(r.pedidos.aguardando).prop('hidden', !r.pedidos.aguardando);
    $('#badge-mensagens').text(r.mensagensNaoLidas).prop('hidden', !r.mensagensNaoLidas);
  }

  // ------------------------------------------------------------------ Dashboard
  function carregarResumo() {
    api('GET', '/api/admin/resumo').then(r => {
      atualizarBadges(r);
      const cards = [
        ['bi-box-seam', r.produtos.total, 'Produtos cadastrados', `${r.produtos.esgotados} esgotados · ${r.produtos.estoqueBaixo} com estoque baixo`],
        ['bi-receipt', r.pedidos.hoje, 'Pedidos hoje', `${r.pedidos.aguardando} aguardando separação`, true],
        ['bi-people', r.usuarios, 'Clientes', 'contas cadastradas'],
        ['bi-cash-coin', moeda(r.pedidos.faturamento30), 'Vendas em 30 dias', `${r.mensagensNaoLidas} mensagens não lidas`]
      ];
      $('#indicadores').html(cards.map(([ic, v, rot, sub, verm]) => `
        <div class="col-sm-6 col-xl-3">
          <div class="rs-indicador"><span class="icone ${verm ? 'vermelho' : ''}"><i class="bi ${ic}"></i></span>
            <div><div class="valor">${v}</div><div class="rot fw-semibold text-dark">${rot}</div><div class="rot">${sub}</div></div></div>
        </div>`).join(''));

      $('#tabela-recentes').html(r.recentes.map(p => `
        <tr><td><strong>${num(p.id)}</strong></td><td>${esc(p.nome_cliente)}</td><td>${data(p.criado_em)}</td><td>${moeda(p.total)}</td><td>${statusBadge(p.status)}</td></tr>`).join('')
        || '<tr><td colspan="5" class="text-secondary">Nenhum pedido ainda.</td></tr>');

      // gráfico de barras simples com os últimos 7 dias
      const dias = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const v = r.vendas.find(x => x.dia === chave);
        dias.push({ rot: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), total: v ? Number(v.total) : 0 });
      }
      const max = Math.max(...dias.map(d => d.total), 1);
      $('#grafico-vendas').html(dias.map(d => `
        <div class="barra" title="${moeda(d.total)}">
          <strong>${d.total ? moeda(d.total).replace(/,\d+$/, '') : ''}</strong>
          <div style="height:${Math.max(2, (d.total / max) * 100)}%"></div><span>${d.rot}</span>
        </div>`).join(''));
    }).catch(err => aviso(err.erro, 'erro'));
  }

  // ------------------------------------------------------------------ Produtos
  function carregarProdutos() {
    $('#tabela-produtos').html('<tr><td colspan="6"><div class="rs-esqueleto" style="height:80px"></div></td></tr>');
    return api('GET', '/api/admin/produtos').then(lista => {
      produtos = lista;
      $('#lista-bandas-admin').html([...new Set(lista.map(p => p.banda))].map(b => `<option value="${esc(b)}">`).join(''));
      $('#lista-imagens').html(lista.map(p => `<option value="${esc(p.imagem)}">`).join(''));
      desenharProdutos();
    }).catch(err => $('#tabela-produtos').html(erroTabela(6)(err)));
  }

  // Os filtros da tabela administrativa operam sobre a lista carregada para o painel.
  function desenharProdutos() {
    const busca = $('#busca-produtos').val().toLowerCase().trim();
    const cat = $('#filtro-cat-admin').val();
    const sit = $('#filtro-situacao').val();
    const lista = produtos.filter(p =>
      (!busca || p.nome.toLowerCase().includes(busca) || p.banda.toLowerCase().includes(busca)) &&
      (!cat || p.categoria.slug === cat) &&
      (!sit || (sit === 'esgotado' && p.estoque === 0) || (sit === 'baixo' && p.estoque > 0 && p.estoque <= 5) ||
        (sit === 'promocao' && p.precoOriginal) || (sit === 'inativo' && !p.ativo)));
    const nomes = { novo: 'Novo', promocao: 'Promoção', esgotado: 'Esgotado' };
    $('#tabela-produtos').html(lista.map(p => `
      <tr class="${p.ativo ? '' : 'inativo'}">
        <td><div class="d-flex align-items-center gap-2"><img src="${esc(p.imagem)}" alt="">
          <div><strong class="d-block lh-sm">${esc(p.nome)}</strong><span class="small text-secondary">${esc(p.banda)}${p.ativo ? '' : ' · <em>inativo</em>'}</span></div></div></td>
        <td class="small">${esc(p.categoria.nome)}</td>
        <td class="text-nowrap">${moeda(p.precoFinal)}${p.precoOriginal ? `<br><small class="text-secondary text-decoration-line-through">${moeda(p.precoOriginal)}</small>` : ''}</td>
        <td><label class="visually-hidden" for="est-${p.id}">Estoque de ${esc(p.nome)}</label>
          <input type="number" min="0" class="form-control form-control-sm rs-estoque-input ${p.estoque === 0 ? 'border-danger' : p.estoque <= 5 ? 'border-warning' : ''}" id="est-${p.id}" value="${p.estoque}" data-estoque="${p.id}"></td>
        <td>${p.selos.map(s => `<span class="rs-selo rs-selo-${s} d-inline-block mb-1">${nomes[s]}</span>`).join(' ') || '<span class="text-secondary small">–</span>'}</td>
        <td class="text-end text-nowrap">
          <a class="btn btn-sm btn-light" href="produto.html?slug=${encodeURIComponent(p.slug)}" target="_blank" title="Ver na loja" aria-label="Ver ${esc(p.nome)} na loja"><i class="bi bi-eye"></i></a>
          <button class="btn btn-sm btn-light" data-editar="${p.id}" title="Editar" aria-label="Editar ${esc(p.nome)}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-light text-danger" data-excluir="${p.id}" title="Excluir" aria-label="Excluir ${esc(p.nome)}"><i class="bi bi-trash3"></i></button>
        </td>
      </tr>`).join('') || '<tr><td colspan="6" class="text-secondary">Nenhum produto encontrado.</td></tr>');
  }
  $('#busca-produtos').on('input', desenharProdutos);
  $('#filtro-cat-admin, #filtro-situacao').on('change', desenharProdutos);

  // Ajuste rápido de estoque direto na tabela
  $('#tabela-produtos').on('change', '[data-estoque]', function () {
    const id = $(this).data('estoque');
    const estoque = parseInt(this.value, 10);
    if (!(estoque >= 0)) { aviso('Estoque inválido.', 'erro'); return; }
    api('PATCH', `/api/admin/produtos/${id}`, { estoque })
      .then(() => { aviso('Estoque atualizado.', 'sucesso'); carregarProdutos(); })
      .catch(err => aviso(err.erro, 'erro'));
  });

  $('#tabela-produtos').on('click', '[data-excluir]', function () {
    const p = produtos.find(x => x.id === $(this).data('excluir'));
    if (!confirm(`Excluir "${p.nome}"?\nSe o produto já tiver vendas, ele será apenas desativado.`)) return;
    api('DELETE', `/api/admin/produtos/${p.id}`).then(r => { aviso(r.mensagem, 'sucesso'); carregarProdutos(); }).catch(err => aviso(err.erro, 'erro'));
  });

  // Modal de produto
  const modalProduto = new bootstrap.Modal('#modal-produto');
  let editando = null;

  function paraDatetimeLocal(d) {
    if (!d) return '';
    const x = new Date(d);
    x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
    return x.toISOString().slice(0, 16);
  }

  function abrirProduto(p) {
    // O mesmo modal serve para cadastrar e editar; reset evita reaproveitar os campos do produto anterior.
    editando = p ? p.id : null;
    const $f = $('#form-produto');
    $f[0].reset();
    limparErros($f);
    $('#titulo-modal-produto').text(p ? 'Editar produto' : 'Novo produto');
    if (p) {
      $('#p-nome').val(p.nome); $('#p-banda').val(p.banda); $('#p-categoria').val(p.categoriaId);
      $('#p-preco').val(p.preco); $('#p-estoque').val(p.estoque); $('#p-descricao').val(p.descricao);
      $('#p-detalhes').val(p.detalhes || ''); $('#p-faixas').val(p.faixas.join('\n')); $('#p-ano').val(p.ano || '');
      $('#p-preco-promo').val(p.precoPromocional || '');
      $('#p-promo-fim').val(p.precoPromocional ? paraDatetimeLocal(p.promocaoFimBruto) : '');
      $('#p-imagem').val(p.imagem); $('#p-galeria').val(p.galeria.slice(1).join(','));
      $('#p-tamanhos').prop('checked', p.temTamanhos); $('#p-destaque').prop('checked', p.destaque); $('#p-ativo').prop('checked', p.ativo);
    } else {
      $('#p-imagem').val('img/site/sem-imagem.svg');
      $('#p-ativo').prop('checked', true);
    }
    $('#p-previa').attr('src', $('#p-imagem').val());
    modalProduto.show();
  }
  $('#novo-produto').on('click', () => abrirProduto(null));
  $('#tabela-produtos').on('click', '[data-editar]', function () { abrirProduto(produtos.find(x => x.id === $(this).data('editar'))); });
  $('#p-imagem').on('change input', function () { $('#p-previa').attr('src', this.value || 'img/site/sem-imagem.svg'); });
  $('#p-previa').on('error', function () { if (!this.src.endsWith('sem-imagem.svg')) this.src = 'img/site/sem-imagem.svg'; });
  $('#p-categoria').on('change', function () {
    const cat = categorias.find(c => String(c.id) === this.value);
    if (cat && !editando) $('#p-tamanhos').prop('checked', cat.slug === 'camisetas');
  });

  $('#form-produto').on('submit', function (e) {
    e.preventDefault();
    const $f = $(this);
    limparErros($f);
    const d = {
      nome: $('#p-nome').val().trim(), banda: $('#p-banda').val().trim(), categoriaId: $('#p-categoria').val(),
      preco: $('#p-preco').val(), estoque: $('#p-estoque').val(), descricao: $('#p-descricao').val().trim(),
      detalhes: $('#p-detalhes').val().trim(), faixas: $('#p-faixas').val().trim(), ano: $('#p-ano').val(),
      precoPromocional: $('#p-preco-promo').val(),
      promocaoFim: $('#p-promo-fim').val() ? new Date($('#p-promo-fim').val()).toISOString() : '',
      imagem: $('#p-imagem').val().trim(), galeria: $('#p-galeria').val().trim(),
      temTamanhos: $('#p-tamanhos').is(':checked'), destaque: $('#p-destaque').is(':checked'), ativo: $('#p-ativo').is(':checked')
    };
    // validação no navegador (o servidor valida de novo)
    const erros = {};
    if (d.nome.length < 3) erros.nome = 'Informe o nome do produto.';
    if (!d.banda) erros.banda = 'Informe a banda.';
    if (!(Number(d.preco) > 0)) erros.preco = 'Preço inválido.';
    if (d.estoque === '' || Number(d.estoque) < 0) erros.estoque = 'Estoque inválido.';
    if (d.descricao.length < 10) erros.descricao = 'Escreva uma descrição.';
    if (!d.imagem) erros.imagem = 'Informe a imagem.';
    if (d.precoPromocional && Number(d.precoPromocional) >= Number(d.preco)) erros.precoPromocional = 'Deve ser menor que o preço normal.';
    if (d.precoPromocional && !d.promocaoFim) erros.promocaoFim = 'Informe até quando vale.';
    if (Object.keys(erros).length) return mostrarErros($f, erros);

    const req = editando ? api('PUT', `/api/admin/produtos/${editando}`, d) : api('POST', '/api/admin/produtos', d);
    req.then(r => { aviso(r.mensagem, 'sucesso'); modalProduto.hide(); carregarProdutos(); })
      .catch(err => (Object.keys(err.campos).length ? mostrarErros($f, err.campos) : aviso(err.erro, 'erro')));
  });

  // ------------------------------------------------------------------ Pedidos
  function carregarPedidos() {
    $('#tabela-pedidos').html('<tr><td colspan="7"><div class="rs-esqueleto" style="height:80px"></div></td></tr>');
    const status = $('#filtro-status').val();
    api('GET', '/api/admin/pedidos', status ? { status } : undefined).then(lista => {
      pedidos = lista;
      $('#tabela-pedidos').html(lista.map(p => `
        <tr>
          <td><strong>${num(p.id)}</strong></td>
          <td>${esc(p.nome_cliente)}<br><small class="text-secondary">${esc(p.email)}</small></td>
          <td class="small">${dataHora(p.criado_em)}</td>
          <td class="small">${p.itens.reduce((s, i) => s + i.quantidade, 0)} item(ns)</td>
          <td class="text-nowrap fw-semibold">${moeda(p.total)}</td>
          <td><label class="visually-hidden" for="st-${p.id}">Status do pedido ${num(p.id)}</label>
            <select class="form-select form-select-sm" id="st-${p.id}" data-status="${p.id}" style="min-width:150px">
              ${STATUS.map(([v, n]) => `<option value="${v}" ${v === p.status ? 'selected' : ''}>${n}</option>`).join('')}
            </select></td>
          <td class="text-end"><button class="btn btn-sm btn-light" data-ver-pedido="${p.id}" aria-label="Ver detalhes do pedido ${num(p.id)}"><i class="bi bi-eye"></i></button></td>
        </tr>`).join('') || '<tr><td colspan="7" class="text-secondary">Nenhum pedido encontrado.</td></tr>');
    }).catch(err => $('#tabela-pedidos').html(erroTabela(7)(err)));
    api('GET', '/api/admin/resumo').then(atualizarBadges).catch(() => {});
  }
  $('#filtro-status').on('change', carregarPedidos);

  $('#tabela-pedidos').on('change', '[data-status]', function () {
    api('PATCH', `/api/admin/pedidos/${$(this).data('status')}`, { status: this.value })
      .then(r => { aviso(r.mensagem, 'sucesso'); api('GET', '/api/admin/resumo').then(atualizarBadges); })
      .catch(err => aviso(err.erro, 'erro'));
  });

  const modalPedido = new bootstrap.Modal('#modal-pedido');
  $('#tabela-pedidos').on('click', '[data-ver-pedido]', function () {
    const p = pedidos.find(x => x.id === $(this).data('verPedido'));
    $('#titulo-modal-pedido').text(`Pedido ${num(p.id)}`);
    $('#corpo-modal-pedido').html(`
      <div class="row g-3 mb-3 small">
        <div class="col-md-6"><div class="bg-rs-cinza rounded-4 p-3 h-100"><strong class="d-block mb-1">Cliente</strong>${esc(p.nome_cliente)}<br>${esc(p.email)}<br>${esc(p.telefone)}</div></div>
        <div class="col-md-6"><div class="bg-rs-cinza rounded-4 p-3 h-100"><strong class="d-block mb-1">Entrega</strong>${esc(p.endereco)}, ${esc(p.numero)}${p.complemento ? ' – ' + esc(p.complemento) : ''}<br>${esc(p.bairro)} – ${esc(p.cidade)}/${esc(p.uf)}<br>CEP ${esc(p.cep)}</div></div>
      </div>
      <table class="table rs-tabela">
        <thead><tr><th scope="col">Produto</th><th scope="col">Tam.</th><th scope="col">Qtd.</th><th scope="col" class="text-end">Preço</th><th scope="col" class="text-end">Total</th></tr></thead>
        <tbody>${p.itens.map(i => `<tr><td>${esc(i.nome_produto)}</td><td>${esc(i.tamanho || '–')}</td><td>${i.quantidade}</td><td class="text-end">${moeda(i.preco_unitario)}</td><td class="text-end">${moeda(i.preco_unitario * i.quantidade)}</td></tr>`).join('')}</tbody>
        <tfoot>
          <tr><td colspan="4" class="text-end">Subtotal</td><td class="text-end">${moeda(p.subtotal)}</td></tr>
          ${Number(p.desconto) > 0 ? `<tr><td colspan="4" class="text-end">Desconto (cupom ${esc(p.cupom)})</td><td class="text-end text-success">- ${moeda(p.desconto)}</td></tr>` : ''}
          <tr><td colspan="4" class="text-end">Frete</td><td class="text-end">${p.frete ? moeda(p.frete) : 'Grátis'}</td></tr>
          <tr><th colspan="4" class="text-end">Total</th><th class="text-end">${moeda(p.total)}</th></tr>
        </tfoot>
      </table>
      <p class="small text-secondary mb-0">Pagamento: ${PAGAMENTOS[p.forma_pagamento]} · Realizado em ${dataHora(p.criado_em)} · Status: ${NOME_STATUS[p.status]}</p>`);
    modalPedido.show();
  });

  // ------------------------------------------------------------------ Usuários
  function carregarUsuarios() {
    api('GET', '/api/admin/usuarios').then(lista => {
      $('#tabela-usuarios').html(lista.map(u => `
        <tr>
          <td><div class="d-flex align-items-center gap-2"><span class="rs-avatar ${u.perfil === 'admin' ? 'bg-dark' : ''}">${esc(u.nome[0])}</span><div><strong>${esc(u.nome)}</strong>${u.perfil === 'admin' ? ' <span class="badge text-bg-dark">admin</span>' : ''}</div></div></td>
          <td class="small">${esc(u.email)}</td>
          <td class="small">${data(u.criado_em)}</td>
          <td>${u.pedidos}</td>
          <td class="text-nowrap">${moeda(u.totalGasto)}</td>
          <td>${u.bloqueado ? '<span class="badge text-bg-danger">Bloqueado</span>' : '<span class="badge text-bg-success">Ativo</span>'}</td>
          <td class="text-end">${u.perfil === 'admin' ? '' : `<button class="btn btn-sm ${u.bloqueado ? 'btn-outline-success' : 'btn-outline-danger'}" data-bloquear="${u.id}" data-valor="${u.bloqueado ? 0 : 1}">${u.bloqueado ? '<i class="bi bi-unlock me-1"></i>Desbloquear' : '<i class="bi bi-lock me-1"></i>Bloquear'}</button>`}</td>
        </tr>`).join(''));
    }).catch(err => $('#tabela-usuarios').html(erroTabela(7)(err)));
  }
  $('#tabela-usuarios').on('click', '[data-bloquear]', function () {
    const bloquear = $(this).data('valor') === 1;
    if (bloquear && !confirm('Bloquear esta conta? O cliente não conseguirá entrar nem fazer pedidos.')) return;
    api('PATCH', `/api/admin/usuarios/${$(this).data('bloquear')}`, { bloqueado: bloquear })
      .then(r => { aviso(r.mensagem, 'sucesso'); carregarUsuarios(); })
      .catch(err => aviso(err.erro, 'erro'));
  });

  // ------------------------------------------------------------------ Avaliações
  function carregarAvaliacoes() {
    api('GET', '/api/admin/avaliacoes').then(lista => {
      $('#tabela-avaliacoes').html(lista.map(a => `
        <tr class="${a.visivel ? '' : 'inativo'}">
          <td><a href="produto.html?slug=${encodeURIComponent(a.slug)}" target="_blank">${esc(a.produto)}</a></td>
          <td class="small">${esc(a.cliente)}</td>
          <td class="text-nowrap">${estrelas(a.nota)}</td>
          <td class="small" style="max-width:360px">${esc(a.comentario)}</td>
          <td class="small">${data(a.criado_em)}</td>
          <td class="text-end"><div class="form-check form-switch d-inline-block"><input class="form-check-input" type="checkbox" role="switch" data-visivel="${a.id}" ${a.visivel ? 'checked' : ''} aria-label="Avaliação visível na loja"></div></td>
        </tr>`).join('') || '<tr><td colspan="6" class="text-secondary">Nenhuma avaliação ainda.</td></tr>');
    }).catch(err => $('#tabela-avaliacoes').html(erroTabela(6)(err)));
  }
  $('#tabela-avaliacoes').on('change', '[data-visivel]', function () {
    api('PATCH', `/api/admin/avaliacoes/${$(this).data('visivel')}`, { visivel: this.checked })
      .then(r => { aviso(r.mensagem, 'sucesso'); carregarAvaliacoes(); })
      .catch(err => aviso(err.erro, 'erro'));
  });

  // ------------------------------------------------------------------ Mensagens
  function carregarMensagens() {
    api('GET', '/api/admin/mensagens').then(lista => {
      $('#badge-mensagens').text(lista.filter(m => !m.lida).length).prop('hidden', !lista.some(m => !m.lida));
      $('#lista-mensagens').html(lista.map(m => `
        <article class="rs-cartao rs-mensagem ${m.lida ? '' : 'nao-lida'}">
          <div class="d-flex justify-content-between flex-wrap gap-2 mb-2">
            <div><strong>${esc(m.nome)}</strong> <a href="mailto:${esc(m.email)}" class="small">${esc(m.email)}</a><br>
              <span class="badge text-bg-light border">${ASSUNTOS[m.assunto] || esc(m.assunto)}</span> ${m.lida ? '' : '<span class="badge text-bg-danger">Nova</span>'}</div>
            <small class="text-secondary">${dataHora(m.criado_em)}</small>
          </div>
          <p class="mb-3" style="white-space:pre-line">${esc(m.mensagem)}</p>
          <div class="d-flex gap-2">
            <a class="btn btn-sm btn-rs-sec" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: contato Riff Store')}"><i class="bi bi-reply me-1"></i>Responder</a>
            <button class="btn btn-sm btn-light" data-lida="${m.id}" data-valor="${m.lida ? 0 : 1}"><i class="bi ${m.lida ? 'bi-envelope' : 'bi-envelope-open'} me-1"></i>Marcar como ${m.lida ? 'não lida' : 'lida'}</button>
            <button class="btn btn-sm btn-light text-danger ms-auto" data-excluir-msg="${m.id}" aria-label="Excluir mensagem"><i class="bi bi-trash3"></i></button>
          </div>
        </article>`).join('') || '<div class="rs-vazio rs-cartao"><i class="bi bi-inbox"></i><p class="text-secondary mt-2 mb-0">Nenhuma mensagem.</p></div>');
    }).catch(err => aviso(err.erro, 'erro'));
  }
  $('#lista-mensagens')
    .on('click', '[data-lida]', function () {
      api('PATCH', `/api/admin/mensagens/${$(this).data('lida')}`, { lida: $(this).data('valor') === 1 }).then(carregarMensagens);
    })
    .on('click', '[data-excluir-msg]', function () {
      if (!confirm('Excluir esta mensagem?')) return;
      api('DELETE', `/api/admin/mensagens/${$(this).data('excluirMsg')}`).then(r => { aviso(r.mensagem, 'sucesso'); carregarMensagens(); });
    });

  // ------------------------------------------------------------------ Configurações
  function carregarConfig() {
    api('GET', '/api/configuracoes').then(c => {
      Object.entries(c).forEach(([k, v]) => $(`#form-config [name="${k}"]`).val(v));
    });
  }
  // Restaurar só existe no modo sem servidor (dados no navegador)
  RS.modoServidor().then(servidor => { if (servidor) $('#cartao-restaurar').remove(); });
  $('#restaurar-dados').on('click', () => {
    if (!confirm('Restaurar todos os dados de demonstração? Pedidos, clientes e produtos criados serão apagados.')) return;
    RS.carrinho.limpar();
    api('POST', '/api/admin/restaurar').then(r => { aviso(r.mensagem, 'sucesso'); setTimeout(() => location.reload(), 800); }).catch(err => aviso(err.erro, 'erro'));
  });

  $('#form-config').on('submit', function (e) {
    e.preventDefault();
    const dados = {};
    $(this).serializeArray().forEach(({ name, value }) => { dados[name] = value.trim(); });
    api('PUT', '/api/admin/configuracoes', dados).then(r => aviso(r.mensagem, 'sucesso')).catch(err => aviso(err.erro, 'erro'));
  });
});
