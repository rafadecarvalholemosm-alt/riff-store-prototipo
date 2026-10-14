// Carrinho: lista os itens do localStorage, altera quantidades e recalcula os totais na hora.
$(function () {
  const { carrinho, moeda, esc, calcularFrete, FRETE, parcelas, aviso, api, cupom } = RS;

  function desenhar() {
    const itens = carrinho.itens();
    const qtd = carrinho.quantidade();
    $('#carrinho-vazio').prop('hidden', itens.length > 0);
    $('#carrinho-cheio').prop('hidden', itens.length === 0);
    $('#qtd-titulo').text(itens.length ? `(${qtd} ${qtd === 1 ? 'item' : 'itens'})` : '');
    if (!itens.length) return;

    $('#itens-carrinho').html(itens.map(i => `
      <tr data-chave="${esc(i.chave)}">
        <td class="col-produto">
          <div class="d-flex align-items-center gap-3">
            <a class="rs-item-thumb" href="produto.html?slug=${encodeURIComponent(i.slug)}"><img src="${esc(i.imagem)}" alt="${esc(i.nome)}"></a>
            <div>
              <span class="rs-card-banda">${esc(i.banda)}</span>
              <a class="rs-item-nome d-block" href="produto.html?slug=${encodeURIComponent(i.slug)}">${esc(i.nome)}</a>
              ${i.tamanho ? `<span class="small text-secondary">Tamanho: <strong>${esc(i.tamanho)}</strong></span>` : ''}
              <span class="d-md-none small text-secondary d-block">${moeda(i.preco)} cada</span>
            </div>
          </div>
        </td>
        <td class="col-preco">${moeda(i.preco)}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="rs-qtd sm">
              <button type="button" data-acao="menos" aria-label="Diminuir quantidade de ${esc(i.nome)}" ${i.quantidade <= 1 ? 'disabled' : ''}><i class="bi bi-dash"></i></button>
              <input type="number" value="${i.quantidade}" min="1" max="${Math.min(i.estoque, 20)}" aria-label="Quantidade de ${esc(i.nome)}">
              <button type="button" data-acao="mais" aria-label="Aumentar quantidade de ${esc(i.nome)}" ${i.quantidade >= Math.min(i.estoque, 20) ? 'disabled' : ''}><i class="bi bi-plus"></i></button>
            </div>
            <button type="button" class="rs-remover" data-acao="remover" aria-label="Remover ${esc(i.nome)} do carrinho" title="Remover item"><i class="bi bi-trash3"></i></button>
          </div>
        </td>
        <td class="col-total text-end fw-bold">${moeda(i.preco * i.quantidade)}</td>
      </tr>`).join(''));
    totais();
  }

  function totais() {
    const subtotal = carrinho.subtotal();
    const frete = calcularFrete(subtotal);
    const desconto = cupom.desconto(subtotal);
    const total = subtotal - desconto + frete;
    const aplicado = cupom.atual();
    $('#qtd-itens').text(carrinho.quantidade());
    $('#subtotal').text(moeda(subtotal));
    $('#linha-desconto').prop('hidden', !aplicado);
    if (aplicado) { $('#desconto-cupom').text(aplicado.codigo); $('#desconto').text(`- ${moeda(desconto)}`); }
    $('#form-cupom, #cupom-msg').prop('hidden', !!aplicado);
    $('#cupom-aplicado').prop('hidden', !aplicado);
    $('#cupom-aplicado-codigo').text(aplicado ? `${aplicado.codigo} (-${aplicado.percentual}%)` : '');
    $('#frete').html(frete === 0 ? '<span class="text-success">Grátis</span>' : moeda(frete));
    $('#total').text(moeda(total));
    $('#parcelas').text(parcelas(total));
    const falta = FRETE.gratisAPartir - subtotal;
    const pct = Math.min(100, (subtotal / FRETE.gratisAPartir) * 100);
    $('#frete-progresso').attr('aria-valuenow', Math.round(pct)).find('div').css('width', `${pct}%`);
    $('#frete-msg').html(falta > 0
      ? `Faltam <strong>${moeda(falta)}</strong> para você ganhar <strong>frete grátis</strong>!`
      : '<i class="bi bi-check-circle-fill text-success"></i> Você ganhou <strong>frete grátis</strong>!');
  }

  $('#itens-carrinho')
    .on('click', '[data-acao]', function () {
      const $tr = $(this).closest('tr');
      const chave = $tr.data('chave');
      const item = carrinho.itens().find(i => i.chave === chave);
      if (!item) return;
      const acao = $(this).data('acao');
      if (acao === 'remover') {
        $tr.fadeOut(250, () => { carrinho.remover(chave); aviso('Item removido do carrinho.', 'info'); });
        return;
      }
      carrinho.alterar(chave, item.quantidade + (acao === 'mais' ? 1 : -1));
    })
    .on('change', 'input', function () {
      carrinho.alterar($(this).closest('tr').data('chave'), parseInt(this.value, 10) || 1);
    });

  // Cupom de desconto
  function erroCupom(msg) {
    $('#cupom-codigo').toggleClass('is-invalid', !!msg);
    $('#cupom-erro').text(msg || '').prop('hidden', !msg);
  }
  $('#form-cupom').on('submit', function (e) {
    e.preventDefault();
    const codigo = $('#cupom-codigo').val().trim().toUpperCase();
    if (!codigo) { erroCupom('Digite o código do cupom.'); return; }
    const $btn = $(this).find('button').prop('disabled', true);
    cupom.validar(codigo)
      .then(c => {
        cupom.salvar(c);
        erroCupom('');
        $('#cupom-codigo').val('');
        aviso(`Cupom ${c.codigo} aplicado: ${c.percentual}% de desconto nos produtos!`, 'sucesso');
        totais();
      })
      .catch(err => erroCupom(err.erro))
      .finally(() => $btn.prop('disabled', false));
  });
  $('#cupom-codigo').on('input', () => erroCupom(''));
  $('#cupom-remover').on('click', () => { cupom.remover(); totais(); });

  // Confere de novo o cupom guardado (ex.: já usado por esta conta em outra compra)
  function revalidarCupom() {
    const c = cupom.atual();
    if (!c) return;
    cupom.validar(c.codigo).catch(err => {
      if (err.status !== 400) return;
      cupom.remover();
      aviso(err.erro, 'erro', { duracao: 7000 });
      totais();
    });
  }

  $('#esvaziar').on('click', () => {
    if (confirm('Remover todos os itens do carrinho?')) carrinho.limpar();
  });

  $(document).on('carrinho:alterado', desenhar);

  // Atualiza preços e estoque com os dados atuais do servidor (a promoção pode ter acabado)
  function sincronizar() {
    const itens = carrinho.itens();
    if (!itens.length) return;
    api('GET', '/api/produtos', { ids: [...new Set(itens.map(i => i.id))].join(','), limite: 48 }).then(r => {
      const porId = new Map(r.produtos.map(p => [p.id, p]));
      let mudou = false;
      const atualizados = itens.filter(i => {
        const p = porId.get(i.id);
        if (!p) { mudou = true; aviso(`"${i.nome}" saiu do catálogo e foi removido do carrinho.`, 'erro'); return false; }
        if (p.estoque <= 0) { mudou = true; aviso(`"${i.nome}" esgotou e foi removido do carrinho.`, 'erro'); return false; }
        if (p.precoFinal !== i.preco || p.estoque !== i.estoque) { mudou = true; i.preco = p.precoFinal; i.estoque = p.estoque; i.quantidade = Math.min(i.quantidade, p.estoque); }
        return true;
      });
      if (mudou) carrinho.salvar(atualizados);
    }).catch(() => {});
  }

  desenhar();
  sincronizar();
  revalidarCupom();
});
