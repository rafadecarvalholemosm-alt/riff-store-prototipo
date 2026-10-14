/*
 * Formulário de compra dividido em identificação, endereço, pagamento e revisão.
 * As validações orientam o usuário antes de enviar o pedido à API.
 * O pagamento é simulado, e o rascunho não guarda campos do cartão.
 */
// Finalização do pedido em etapas: identificação, endereço, pagamento e revisão.
$(function () {
  const { carrinho, moeda, esc, calcularFrete, api, aviso, mostrarErros, limparErros, regex, exigirLogin, cupom } = RS;
  const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
    'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  const NOMES_PAGAMENTO = { pix: 'Pix', cartao: 'Cartão de crédito', boleto: 'Boleto bancário' };
  const RASCUNHO = 'riff_checkout';

  let etapa = 1;
  const pedido = {};

  $('#uf').append(UFS.map(uf => `<option value="${uf}">${uf}</option>`).join(''));

  // Só clientes logados finalizam pedidos
  exigirLogin().then(usuario => {
    if (!carrinho.itens().length) {
      $('#checkout-vazio').prop('hidden', false);
      $('#etapas').hide();
      return;
    }
    // recupera o que já foi digitado nesta sessão do navegador
    let salvo = {};
    try { salvo = JSON.parse(sessionStorage.getItem(RASCUNHO)) || {}; } catch (e) { /* ignora */ }
    const inicial = { nome: usuario.nome, email: usuario.email, telefone: usuario.telefone || '', ...salvo };
    Object.entries(inicial).forEach(([campo, valor]) => {
      const $c = $(`.rs-etapa [name="${campo}"]`);
      if ($c.is(':radio')) $c.filter(`[value="${valor}"]`).prop('checked', true);
      else if (!/^cartao/.test(campo)) $c.val(valor);
    });
    $('#checkout').prop('hidden', false);
    resumo();
    alternarCartao();
  });

  // ------------------------------------------------------------------ Resumo lateral
  function resumo() {
    const itens = carrinho.itens();
    const subtotal = carrinho.subtotal();
    const frete = calcularFrete(subtotal);
    $('#resumo-itens').html(itens.map(i => `
      <li class="d-flex gap-3 align-items-center mb-3">
        <div class="rs-item-thumb position-relative" style="width:58px;height:58px"><img src="${esc(i.imagem)}" alt=""></div>
        <div class="flex-grow-1 small"><div class="fw-semibold lh-sm">${esc(i.nome)}</div><span class="text-secondary">${i.quantidade}x ${moeda(i.preco)}${i.tamanho ? ` · ${esc(i.tamanho)}` : ''}</span></div>
        <strong class="small">${moeda(i.preco * i.quantidade)}</strong>
      </li>`).join(''));
    const desconto = cupom.desconto(subtotal);
    const aplicado = cupom.atual();
    $('#subtotal').text(moeda(subtotal));
    $('#linha-desconto').prop('hidden', !aplicado);
    if (aplicado) { $('#desconto-cupom').text(aplicado.codigo); $('#desconto').text(`- ${moeda(desconto)}`); }
    $('#frete').html(frete ? moeda(frete) : '<span class="text-success">Grátis</span>');
    const total = subtotal - desconto + frete;
    $('#total').text(moeda(total));
    $('#parcelas').html([1, 2, 3, 4, 5, 6].map(n => `<option value="${n}">${n}x de ${moeda(total / n)} sem juros</option>`).join(''));
    return { subtotal, frete, desconto, total };
  }

  // ------------------------------------------------------------------ Navegação entre etapas
  // Mostra uma etapa por vez e atualiza o foco e aria-current para orientar a navegação.
  function irPara(n) {
    etapa = n;
    $('.rs-etapa').prop('hidden', true);
    $(`.rs-etapa[data-etapa="${n}"]`).prop('hidden', false);
    $('#etapas li').each(function (i) {
      $(this).toggleClass('feita', i + 1 < n).toggleClass('atual', i + 1 === n);
      if (i + 1 === n) $(this).attr('aria-current', 'step'); else $(this).removeAttr('aria-current');
    });
    if (n === 4) revisao();
    $('html, body').animate({ scrollTop: $('#etapas').offset().top - 110 }, 250);
    $(`.rs-etapa[data-etapa="${n}"]`).find('input, select, button').filter(':visible').first().trigger('focus');
  }

  $('[data-voltar]').on('click', () => irPara(etapa - 1));
  $('[data-ir]').on('click', function () { irPara(Number($(this).data('ir'))); });

  function lerCampos($form) {
    const dados = {};
    $form.serializeArray().forEach(({ name, value }) => { dados[name] = value.trim(); });
    return dados;
  }

  // sessionStorage guarda o progresso durante a sessão; campos do cartão ficam excluídos.
  function salvarRascunho() {
    const { cartaoNumero, cartaoNome, cartaoValidade, cartaoCvv, ...seguro } = pedido; // nunca guarda dados do cartão
    sessionStorage.setItem(RASCUNHO, JSON.stringify(seguro));
  }

  // ------------------------------------------------------------------ Validação de cada etapa
  const validacoes = {
    1(d) {
      const e = {};
      if (d.nome.length < 3 || !d.nome.includes(' ')) e.nome = 'Informe nome e sobrenome.';
      if (!regex.email.test(d.email)) e.email = 'Informe um e-mail válido.';
      if (!regex.telefone.test(d.telefone)) e.telefone = 'Informe um telefone com DDD, ex.: (34) 99999-9999.';
      return e;
    },
    2(d) {
      const e = {};
      if (!regex.cep.test(d.cep)) e.cep = 'CEP inválido.';
      if (d.endereco.length < 3) e.endereco = 'Informe o endereço.';
      if (!d.numero) e.numero = 'Informe o número.';
      if (d.bairro.length < 2) e.bairro = 'Informe o bairro.';
      if (d.cidade.length < 2) e.cidade = 'Informe a cidade.';
      if (!UFS.includes(d.uf)) e.uf = 'Selecione o estado.';
      return e;
    },
    3(d) {
      const e = {};
      if (d.pagamento !== 'cartao') return e;
      const numero = d.cartaoNumero.replace(/\D/g, '');
      if (!/^\d{13,19}$/.test(numero) || !luhn(numero)) e.cartaoNumero = 'Número de cartão inválido.';
      if (d.cartaoNome.length < 3) e.cartaoNome = 'Informe o nome como está no cartão.';
      const [mm, aa] = d.cartaoValidade.split('/').map(Number);
      const hoje = new Date();
      const venc = new Date(2000 + aa, mm, 0, 23, 59);
      if (!/^\d{2}\/\d{2}$/.test(d.cartaoValidade) || mm < 1 || mm > 12 || venc < hoje) e.cartaoValidade = 'Validade inválida ou vencida.';
      if (!/^\d{3,4}$/.test(d.cartaoCvv)) e.cartaoCvv = 'CVV inválido.';
      return e;
    }
  };

  // Algoritmo de Luhn: confere o dígito verificador do cartão
  // Luhn verifica um dígito de controle; é uma validação demonstrativa, sem efetuar cobrança.
  function luhn(num) {
    let soma = 0;
    for (let i = 0; i < num.length; i++) {
      let d = Number(num[num.length - 1 - i]);
      if (i % 2) { d *= 2; if (d > 9) d -= 9; }
      soma += d;
    }
    return soma % 10 === 0;
  }

  $('form.rs-etapa').on('submit', function (e) {
    e.preventDefault();
    const $f = $(this);
    const n = Number($f.data('etapa'));
    const dados = lerCampos($f);
    limparErros($f);
    const erros = validacoes[n](dados);
    if (Object.keys(erros).length) { mostrarErros($f, erros); return; }
    Object.assign(pedido, dados);
    salvarRascunho();
    irPara(n + 1);
  });

  // ------------------------------------------------------------------ CEP (ViaCEP) e cartão
  $('#cep').on('input', function () {
    const cep = this.value.replace(/\D/g, '');
    if (cep.length !== 8) { $('#cep-status').text(''); return; }
    $('#cep-status').html('<span class="spinner-border spinner-border-sm me-1"></span> Buscando endereço...');
    $.getJSON(`https://viacep.com.br/ws/${cep}/json/`)
      .done(r => {
        if (r.erro) { $('#cep-status').text('CEP não encontrado. Preencha o endereço manualmente.'); return; }
        $('#endereco').val(r.logradouro || $('#endereco').val());
        $('#bairro').val(r.bairro || $('#bairro').val());
        $('#cidade').val(r.localidade);
        $('#uf').val(r.uf);
        $('#cep-status').html('<i class="bi bi-check-circle text-success"></i> Endereço encontrado.');
        $(r.logradouro ? '#numero' : '#endereco').trigger('focus');
      })
      .fail(() => $('#cep-status').text('Não foi possível consultar o CEP. Preencha manualmente.'));
  });

  function alternarCartao() {
    const cartao = $('input[name="pagamento"]:checked').val() === 'cartao';
    $('#dados-cartao').prop('hidden', !cartao).find('input').prop('required', cartao);
  }
  $('input[name="pagamento"]').on('change', alternarCartao);
  // Formata o número e mostra a bandeira do cartão
  $('#cartao-numero').on('input', function () {
    const d = this.value.replace(/\D/g, '').slice(0, 19);
    this.value = d.replace(/(\d{4})(?=\d)/g, '$1 ');
    const bandeira = /^4/.test(d) ? ['visa', 'Visa'] : /^(5[1-5]|2[2-7])/.test(d) ? ['mastercard', 'Mastercard'] : /^3[47]/.test(d) ? ['amex', 'American Express'] : null;
    $('#bandeira-cartao').prop('hidden', !bandeira).attr(bandeira ? { src: `img/pagamentos/${bandeira[0]}.svg`, alt: bandeira[1] } : {});
  });
  $('#cartao-validade').on('input', function () {
    const d = this.value.replace(/\D/g, '').slice(0, 4);
    this.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  });
  $('#cartao-nome').on('input', function () { this.value = this.value.toUpperCase(); });

  // ------------------------------------------------------------------ Revisão e confirmação
  // A revisão apresenta os dados escolhidos antes de confirmar o pedido simulado.
  function revisao() {
    const itens = carrinho.itens();
    $('#revisao-itens').html(itens.map(i => `
      <li class="d-flex align-items-center gap-3 py-2 border-bottom">
        <div class="rs-item-thumb" style="width:52px;height:52px"><img src="${esc(i.imagem)}" alt=""></div>
        <span class="flex-grow-1">${esc(i.nome)}${i.tamanho ? ` <span class="badge text-bg-dark">${esc(i.tamanho)}</span>` : ''}<br><small class="text-secondary">${i.quantidade} x ${moeda(i.preco)}</small></span>
        <strong>${moeda(i.preco * i.quantidade)}</strong>
      </li>`).join(''));
    $('#revisao-endereco').html(`${esc(pedido.nome)}<br>${esc(pedido.endereco)}, ${esc(pedido.numero)}${pedido.complemento ? ' – ' + esc(pedido.complemento) : ''}<br>
      ${esc(pedido.bairro)} – ${esc(pedido.cidade)}/${esc(pedido.uf)}<br>CEP ${esc(pedido.cep)}`);
    const { total } = resumo();
    let pag = NOMES_PAGAMENTO[pedido.pagamento];
    if (pedido.pagamento === 'cartao') pag += `<br>Final ${esc(pedido.cartaoNumero.replace(/\D/g, '').slice(-4))} · ${pedido.parcelas}x de ${moeda(total / pedido.parcelas)}`;
    $('#revisao-pagamento').html(pag);
  }

  $('#confirmar').on('click', function () {
    const $btn = $(this).prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Registrando pedido...');
    const corpo = {
      nome: pedido.nome, email: pedido.email, telefone: pedido.telefone,
      cep: pedido.cep, endereco: pedido.endereco, numero: pedido.numero, complemento: pedido.complemento,
      bairro: pedido.bairro, cidade: pedido.cidade, uf: pedido.uf, pagamento: pedido.pagamento,
      cupom: cupom.atual() ? cupom.atual().codigo : null,
      itens: carrinho.itens().map(i => ({ id: i.id, quantidade: i.quantidade, tamanho: i.tamanho }))
    };
    api('POST', '/api/pedidos', corpo)
      .then(r => {
        carrinho.limpar();
        cupom.remover();
        sessionStorage.removeItem(RASCUNHO);
        $('#checkout, #etapas').hide();
        $('#sucesso-numero').text(`#${String(r.pedido.id).padStart(4, '0')}`);
        $('#sucesso-pagamento').text({
          pix: `Pagamento de ${moeda(r.pedido.total)} via Pix confirmado. Seu pedido já está sendo separado.`,
          cartao: `Pagamento de ${moeda(r.pedido.total)} aprovado no cartão de crédito.`,
          boleto: `O boleto de ${moeda(r.pedido.total)} foi enviado para o seu e-mail e vence em 3 dias úteis.`
        }[pedido.pagamento]);
        $('#sucesso').prop('hidden', false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(err => {
        aviso(err.erro, 'erro', { duracao: 7000 });
        // cupom recusado pelo servidor: tira o desconto e mostra o novo total para o cliente confirmar
        if (err.campos && err.campos.cupom) { cupom.remover(); revisao(); }
        $btn.prop('disabled', false).html('<i class="bi bi-lock-fill me-2"></i>Confirmar pedido');
        if (err.status === 401) location.href = `login.html?voltar=${encodeURIComponent('checkout.html')}`;
      });
  });
});
