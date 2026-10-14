// Login e cadastro na mesma tela, alternando por abas.
$(function () {
  const { api, aviso, mostrarErros, limparErros, regex, parametro } = RS;

  // Destino depois do login (só caminhos internos, para evitar redirecionamentos externos)
  function destino(usuario) {
    const voltar = parametro('voltar');
    if (voltar && /^[\w-]+\.html([?#].*)?$/.test(voltar)) return voltar;
    return usuario.perfil === 'admin' ? 'admin.html' : 'conta.html';
  }

  // Quem já está logado não precisa ver esta página
  RS.sessao().then(u => { if (u) location.replace(destino(u)); });

  if (location.hash === '#cadastro') bootstrap.Tab.getOrCreateInstance('#aba-cadastro').show();

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
