/* Controlador da página conta.html.
 * Área do usuário autenticado: pedidos, linha do tempo e formulário de dados pessoais.
 * A sessão preenche os campos, enquanto a API entrega o histórico do usuário.
 * Valores recebidos são formatados e textos são escapados ao compor o HTML.
 */
// Minha conta: histórico de pedidos com status e edição dos dados do cliente.
$(function () {
  const { api, esc, moeda, dataHora, exigirLogin, aviso, mostrarErros, limparErros, regex } = RS;
  const ETAPAS = [['recebido', 'Recebido'], ['em_separacao', 'Em separação'], ['enviado', 'Enviado'], ['entregue', 'Entregue']];
  const NOME_STATUS = Object.fromEntries(ETAPAS);
  const PAGAMENTOS = { pix: 'Pix', cartao: 'Cartão de crédito', boleto: 'Boleto' };

  if (location.hash === '#dados') bootstrap.Tab.getOrCreateInstance('#aba-dados').show();

  exigirLogin().then(u => {
    $('#saudacao').text(`Olá, ${u.nome.split(' ')[0]}!`);
    $('#conta-nome').val(u.nome);
    $('#conta-email').val(u.email);
    $('#conta-telefone').val(u.telefone || '');
    $('#link-admin').prop('hidden', u.perfil !== 'admin');
    carregarPedidos();
  });

  // A posição do status define quais etapas visuais do pedido aparecem concluídas.
  function linhaDoTempo(status) {
    // Os códigos recebidos da API são traduzidos em nomes legíveis, mantendo a ordem de acompanhamento.
    const atual = ETAPAS.findIndex(([s]) => s === status);
    return `<div class="rs-linha-tempo" aria-label="Situação: ${NOME_STATUS[status]}">${ETAPAS.map(([, nome], i) => `<div class="${i <= atual ? 'ok' : ''}">${nome}</div>`).join('')}</div>`;
  }

  // A API filtra o histórico pelo usuário da sessão, sem aceitar o ID de outra conta.
  function carregarPedidos() {
    api('GET', '/api/pedidos').then(pedidos => {
      const total = pedidos.reduce((s, p) => s + p.total, 0);
      $('#resumo-conta').text(pedidos.length
        ? `${pedidos.length} ${pedidos.length === 1 ? 'pedido realizado' : 'pedidos realizados'} · ${moeda(total)} em compras`
        : 'Você ainda não fez nenhum pedido.');
      if (!pedidos.length) {
        $('#lista-pedidos').html(`
          <div class="rs-vazio rs-painel">
            <i class="bi bi-box-seam" aria-hidden="true"></i>
            <h3 class="mt-3">Nenhum pedido ainda</h3>
            <p class="text-secondary">Quando você fizer um pedido, ele aparece aqui com o status atualizado.</p>
            <a href="produtos.html" class="btn btn-rs">Ir às compras</a>
          </div>`);
        return;
      }
      $('#lista-pedidos').html(pedidos.map(p => `
        <article class="rs-pedido">
          <div class="rs-pedido-topo">
            <div><small>Pedido</small><strong>#${String(p.id).padStart(4, '0')}</strong></div>
            <div><small>Data</small><strong>${dataHora(p.criado_em)}</strong></div>
            <div><small>Total</small><strong>${moeda(p.total)}</strong></div>
            <div><small>Pagamento</small><strong>${PAGAMENTOS[p.forma_pagamento]}</strong></div>
            <span class="rs-status rs-status-${p.status} ms-md-auto">${NOME_STATUS[p.status]}</span>
          </div>
          <div class="p-3 p-md-4">
            ${linhaDoTempo(p.status)}
            <ul class="list-unstyled mb-0 mt-3">
              ${p.itens.map(i => `
                <li class="d-flex align-items-center gap-3 py-2">
                  <a class="rs-item-thumb" style="width:56px;height:56px" href="produto.html?slug=${encodeURIComponent(i.slug)}"><img src="${esc(i.imagem)}" alt=""></a>
                  <div class="flex-grow-1 small">
                    <a class="rs-item-nome" href="produto.html?slug=${encodeURIComponent(i.slug)}">${esc(i.nome_produto)}</a>
                    <div class="text-secondary">${i.quantidade} x ${moeda(i.preco_unitario)}${i.tamanho ? ` · Tamanho ${esc(i.tamanho)}` : ''}</div>
                  </div>
                  ${p.status === 'entregue' ? `<a href="produto.html?slug=${encodeURIComponent(i.slug)}#avaliacoes" class="btn btn-sm btn-rs-sec"><i class="bi bi-star me-1"></i>Avaliar</a>` : ''}
                </li>`).join('')}
            </ul>
            <div class="small text-secondary border-top pt-3 mt-2">Entrega em ${esc(p.cidade)}/${esc(p.uf)} · Frete ${p.frete ? moeda(p.frete) : 'grátis'}${Number(p.desconto) > 0 ? ` · Cupom ${esc(p.cupom)}: -${moeda(p.desconto)}` : ''}</div>
          </div>
        </article>`).join(''));
    }).catch(err => $('#lista-pedidos').html(`<div class="alert alert-danger">${esc(err.erro)}</div>`));
  }

  $('#form-dados').on('submit', function (e) {
    // PUT atualiza os dados da conta autenticada; o usuário não escolhe o ID de outra conta neste formulário.
    e.preventDefault();
    const $f = $(this);
    limparErros($f);
    const dados = {
      nome: $('#conta-nome').val().trim(),
      telefone: $('#conta-telefone').val().trim(),
      senhaAtual: $('#senha-atual').val(),
      novaSenha: $('#nova-senha').val()
    };
    const erros = {};
    if (dados.nome.length < 3) erros.nome = 'Informe seu nome completo.';
    if (dados.telefone && !regex.telefone.test(dados.telefone)) erros.telefone = 'Informe um telefone com DDD.';
    if (dados.novaSenha && dados.novaSenha.length < 6) erros.novaSenha = 'A nova senha deve ter pelo menos 6 caracteres.';
    if (dados.novaSenha && !dados.senhaAtual) erros.senhaAtual = 'Informe a senha atual para trocá-la.';
    if (Object.keys(erros).length) return mostrarErros($f, erros);

    api('PUT', '/api/auth/conta', dados)
      .then(r => {
        aviso(r.mensagem, 'sucesso');
        $('#senha-atual, #nova-senha').val('');
        $('#saudacao').text(`Olá, ${r.usuario.nome.split(' ')[0]}!`);
      })
      .catch(err => (Object.keys(err.campos).length ? mostrarErros($f, err.campos) : aviso(err.erro, 'erro')));
  });
});
