/* Controlador da página contato.html.
 * Página de contato: configurações da loja, perguntas frequentes e envio de mensagem.
 * O evento submit permite validar e enviar o formulário sem recarregar a página.
 * A API recebe os dados e devolve mensagens de sucesso ou erros por campo.
 */
// Contato: canais vindos das configurações da loja, formulário validado e FAQ.
$(function () {
  const { api, esc, aviso, mostrarErros, limparErros, regex } = RS;

  RS.configuracoes().then(c => {
    if (!c) return;
    const soNumeros = t => String(t || '').replace(/\D/g, '');
    $('#canal-email').text(c.email).attr('href', `mailto:${c.email}`);
    $('#canal-telefone').text(c.telefone).attr('href', `tel:+55${soNumeros(c.telefone)}`);
    $('#canal-whatsapp').text(c.whatsapp).attr({ href: `https://wa.me/55${soNumeros(c.whatsapp)}`, target: '_blank', rel: 'noopener' });
    $('#canal-endereco').text(c.endereco);
    $('#canal-horario').text(c.horario);
    const redes = [['instagram', 'bi-instagram', 'Instagram'], ['facebook', 'bi-facebook', 'Facebook'], ['youtube', 'bi-youtube', 'YouTube']];
    $('#redes-contato').html(redes.filter(([k]) => c[k]).map(([k, i, n]) =>
      `<a href="${esc(c[k])}" target="_blank" rel="noopener" aria-label="${n} da Riff Store"><i class="bi ${i}"></i></a>`).join(''));
  });

  // Abre a pergunta indicada no endereço (ex.: contato.html#faq-tamanhos)
  if (/^#faq-/.test(location.hash)) {
    // Links como "Tabela de medidas" chegam com esse fragmento; abrir o item expõe a resposta antes de rolar.
    const $item = $(location.hash);
    if ($item.length) {
      bootstrap.Collapse.getOrCreateInstance($item.find('.accordion-collapse')[0]).show();
      setTimeout(() => $item[0].scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }

  // Preenche nome e e-mail de quem está logado
  RS.sessao().then(u => {
    if (!u) return;
    $('#ct-nome').val(u.nome);
    $('#ct-email').val(u.email);
  });

  $('#ct-mensagem').on('input', function () { $('#ct-contador').text(`${this.value.length} / 2000`); });

  // preventDefault mantém a página aberta; os erros são associados aos campos do formulário.
  $('#form-contato').on('submit', function (e) {
    e.preventDefault();
    const $f = $(this);
    limparErros($f);
    const dados = {
      nome: $('#ct-nome').val().trim(),
      email: $('#ct-email').val().trim(),
      assunto: $('#ct-assunto').val(),
      mensagem: $('#ct-mensagem').val().trim()
    };
    const erros = {};
    if (dados.nome.length < 3) erros.nome = 'Informe seu nome.';
    if (!regex.email.test(dados.email)) erros.email = 'Informe um e-mail válido.';
    if (!dados.assunto) erros.assunto = 'Escolha um assunto.';
    if (dados.mensagem.length < 10) erros.mensagem = 'A mensagem deve ter pelo menos 10 caracteres.';
    if (Object.keys(erros).length) return mostrarErros($f, erros);

    const $btn = $f.find('[type="submit"]').prop('disabled', true);
    // O botão fica desabilitado até a Promise terminar, evitando envios repetidos durante a mesma solicitação.
    api('POST', '/api/mensagens', dados)
      .then(r => {
        aviso(r.mensagem, 'sucesso', { duracao: 6000 });
        $('#ct-assunto, #ct-mensagem').val('');
        $('#ct-contador').text('0 / 2000');
      })
      .catch(err => (Object.keys(err.campos).length ? mostrarErros($f, err.campos) : aviso(err.erro, 'erro')))
      .finally(() => $btn.prop('disabled', false));
  });
});
