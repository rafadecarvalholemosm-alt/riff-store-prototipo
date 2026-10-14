/* Controlador de login e cadastro na página login.html.
 * Login e cadastro usam abas, validação de campos e requisições à API.
 * O redirecionamento depende do perfil e aceita somente destinos internos.
 * A indicação de força da senha é uma orientação visual para o cadastro.
 */
// Login e cadastro na mesma tela, alternando por abas.
$(function () {
  const { api, aviso, mostrarErros, limparErros, regex, parametro } = RS;

  // Reserva a área abaixo do cabeçalho, como no banner inicial, sem fixar a altura do formulário.
  // As abas e as mensagens de validação ainda podem aumentar o conteúdo em telas menores.
  let quadroLayout;
  function ajustarLayout() {
    const principal = document.querySelector('.rs-auth');
    const viewport = window.visualViewport;
    if (!principal || (viewport && viewport.scale > 1.05)) return;
    const campo = document.activeElement;
    // O teclado virtual altera a área visível; preservamos o layout durante a digitação.
    if (campo?.matches('input, textarea') && campo.getClientRects().length) return;
    const topo = principal.getBoundingClientRect().top + window.scrollY;
    const altura = Math.max(0, Math.ceil((viewport?.height || window.innerHeight) - topo));
    principal.style.setProperty('--rs-auth-altura', `${altura}px`);
  }
  function agendarLayout() {
    cancelAnimationFrame(quadroLayout);
    quadroLayout = requestAnimationFrame(ajustarLayout);
  }
  ajustarLayout();
  $(window).on('load resize', agendarLayout);
  window.visualViewport?.addEventListener('resize', agendarLayout);
  if (document.fonts) document.fonts.ready.then(agendarLayout);

  // Destino depois do login (só caminhos internos, para evitar redirecionamentos externos)
  function destino(usuario) {
    const voltar = parametro('voltar');
    if (voltar && /^[\w-]+\.html([?#].*)?$/.test(voltar)) return voltar;
    return usuario.perfil === 'admin' ? 'admin.html' : 'conta.html';
  }

  // Quem já está logado não precisa ver esta página
  RS.sessao().then(u => { if (u) location.replace(destino(u)); });

  // Links para login.html#cadastro abrem diretamente o formulário de criação da conta.
  if (location.hash === '#cadastro') bootstrap.Tab.getOrCreateInstance('#aba-cadastro').show();

  // Desabilitar o botão durante o envio evita solicitações repetidas pelo mesmo clique.
  function carregando($btn, sim, texto) {
    $btn.prop('disabled', sim).html(sim ? '<span class="spinner-border spinner-border-sm me-2"></span>Aguarde...' : texto);
  }

  // ------------------------------------------------------------------ Login
  $('#form-login').on('submit', function (e) {
    e.preventDefault();
    const $f = $(this);
    limparErros($f);
    $('#erro-login').prop('hidden', true);
    const dados = { email: $('#login-email').val().trim(), senha: $('#login-senha').val() };
    // A validação local fornece retorno imediato; a API confere as credenciais antes de criar a sessão.
    const erros = {};
    if (!regex.email.test(dados.email)) erros.email = 'Informe um e-mail válido.';
    if (!dados.senha) erros.senha = 'Informe a senha.';
    if (Object.keys(erros).length) return mostrarErros($f, erros);

    const $btn = $f.find('[type="submit"]');
    carregando($btn, true);
    api('POST', '/api/auth/login', dados)
      .then(r => { aviso(r.mensagem, 'sucesso'); setTimeout(() => location.href = destino(r.usuario), 500); })
      .catch(err => {
        $('#erro-login').text(err.erro).prop('hidden', false);
        carregando($btn, false, 'Entrar');
      });
  });

  // ------------------------------------------------------------------ Cadastro
  $('#cad-senha').on('input', function () {
    // A barra dá orientação visual; o requisito efetivo continua sendo a quantidade mínima de caracteres.
    const s = this.value;
    let pontos = 0;
    if (s.length >= 6) pontos++;
    if (s.length >= 10) pontos++;
    if (/[A-Z]/.test(s) && /[a-z]/.test(s)) pontos++;
    if (/\d/.test(s)) pontos++;
    if (/[^A-Za-z0-9]/.test(s)) pontos++;
    const niveis = [['0%', '#ccc', 'Use pelo menos 6 caracteres.'], ['25%', '#dc3545', 'Senha fraca'], ['50%', '#fd7e14', 'Senha razoável'],
      ['75%', '#ffc107', 'Senha boa'], ['100%', '#198754', 'Senha forte'], ['100%', '#198754', 'Senha muito forte']];
    const [larg, cor, texto] = niveis[s ? Math.max(1, pontos) : 0];
    $('#forca-barra').css({ width: larg, background: cor });
    $('#forca-texto').text(texto);
  });

  $('#form-cadastro').on('submit', function (e) {
    e.preventDefault();
    const $f = $(this);
    limparErros($f);
    $('#erro-cadastro').prop('hidden', true);
    const dados = {
      nome: $('#cad-nome').val().trim(),
      email: $('#cad-email').val().trim(),
      telefone: $('#cad-telefone').val().trim(),
      senha: $('#cad-senha').val()
    };
    const erros = {};
    if (dados.nome.length < 3 || !dados.nome.includes(' ')) erros.nome = 'Informe nome e sobrenome.';
    if (!regex.email.test(dados.email)) erros.email = 'Informe um e-mail válido.';
    if (dados.telefone && !regex.telefone.test(dados.telefone)) erros.telefone = 'Informe um telefone com DDD.';
    if (dados.senha.length < 6) erros.senha = 'A senha deve ter pelo menos 6 caracteres.';
    if ($('#cad-senha2').val() !== dados.senha) erros.senha2 = 'As senhas não conferem.';
    if (Object.keys(erros).length) return mostrarErros($f, erros);

    const $btn = $f.find('[type="submit"]');
    carregando($btn, true);
    api('POST', '/api/auth/cadastro', dados)
      .then(r => { aviso(r.mensagem, 'sucesso'); setTimeout(() => location.href = destino(r.usuario), 600); })
      .catch(err => {
        if (Object.keys(err.campos).length) mostrarErros($f, err.campos);
        else $('#erro-cadastro').text(err.erro).prop('hidden', false);
        carregando($btn, false, 'Cadastrar');
      });
  });
});
