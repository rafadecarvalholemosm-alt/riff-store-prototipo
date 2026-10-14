/*
 * Rotas de autenticação recebem JSON e respondem JSON para as páginas.
 * Senhas são comparadas por bcrypt; a sessão recebe apenas dados de identificação.
 * A recuperação exibe um link simulado, sem enviar e-mail ou revelar o hash.
 */
// Cadastro, login, logout, dados da conta e recuperação de senha.
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../banco/conexao');
const { texto, emailValido, telefoneValido } = require('../utils/validacao');
const { exigirLogin } = require('../middlewares/autenticacao');

const router = express.Router();

// Dados do usuário guardados na sessão (nunca a senha)
function dadosSessao(u) {
  return { id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, perfil: u.perfil };
}

// Cria uma nova sessão (evita fixação de sessão) e guarda o usuário nela
function iniciarSessao(req, usuario) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(err => {
      if (err) return reject(err);
      req.session.usuario = dadosSessao(usuario);
      req.session.save(e => (e ? reject(e) : resolve()));
    });
  });
}

// GET /api/auth/me -> usuário logado (ou null)
router.get('/me', (req, res) => {
  res.json({ usuario: req.session.usuario || null });
});

// POST /api/auth/cadastro
router.post('/cadastro', async (req, res) => {
  const nome = texto(req.body.nome, 120);
  const email = texto(req.body.email, 160).toLowerCase();
  const telefone = texto(req.body.telefone, 20);
  const senha = String(req.body.senha || '');

  const erros = {};
  if (nome.length < 3) erros.nome = 'Informe seu nome completo.';
  if (!emailValido(email)) erros.email = 'Informe um e-mail válido.';
  if (telefone && !telefoneValido(telefone)) erros.telefone = 'Informe um telefone com DDD.';
  if (senha.length < 6) erros.senha = 'A senha deve ter pelo menos 6 caracteres.';
  if (Object.keys(erros).length) return res.status(400).json({ erro: 'Verifique os campos destacados.', campos: erros });

  const [[existe]] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (existe) return res.status(409).json({ erro: 'Este e-mail já está cadastrado.', campos: { email: 'E-mail já cadastrado.' } });

  // Hash é uma transformação de mão única; a senha original não é gravada no banco.
  const hash = await bcrypt.hash(senha, 10);
  const [r] = await db.query(
    'INSERT INTO usuarios (nome, email, senha_hash, telefone) VALUES (?, ?, ?, ?)',
    [nome, email, hash, telefone || null]
  );
  const usuario = { id: r.insertId, nome, email, telefone: telefone || null, perfil: 'cliente' };
  await iniciarSessao(req, usuario);
  res.status(201).json({ mensagem: 'Conta criada com sucesso!', usuario: dadosSessao(usuario) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const email = texto(req.body.email, 160).toLowerCase();
  const senha = String(req.body.senha || '');
  if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha.' });

  const [[usuario]] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
  // compare confere a senha informada com o hash, sem descriptografá-lo.
  const senhaOk = usuario && await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaOk) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  if (usuario.bloqueado) return res.status(403).json({ erro: 'Esta conta está bloqueada. Fale com a loja pelo formulário de contato.' });

  await iniciarSessao(req, usuario);
  res.json({ mensagem: `Bem-vindo de volta, ${usuario.nome.split(' ')[0]}!`, usuario: dadosSessao(usuario) });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('riff.sid');
    res.json({ mensagem: 'Você saiu da sua conta.' });
  });
});

// PUT /api/auth/conta -> atualiza nome, telefone e (opcionalmente) a senha
router.put('/conta', exigirLogin, async (req, res) => {
  const nome = texto(req.body.nome, 120);
  const telefone = texto(req.body.telefone, 20);
  const senhaAtual = String(req.body.senhaAtual || '');
  const novaSenha = String(req.body.novaSenha || '');

  const erros = {};
  if (nome.length < 3) erros.nome = 'Informe seu nome completo.';
  if (telefone && !telefoneValido(telefone)) erros.telefone = 'Informe um telefone com DDD.';
  if (novaSenha && novaSenha.length < 6) erros.novaSenha = 'A nova senha deve ter pelo menos 6 caracteres.';
  if (Object.keys(erros).length) return res.status(400).json({ erro: 'Verifique os campos destacados.', campos: erros });

  const id = req.session.usuario.id;
  if (novaSenha) {
    const [[u]] = await db.query('SELECT senha_hash FROM usuarios WHERE id = ?', [id]);
    if (!(await bcrypt.compare(senhaAtual, u.senha_hash))) {
      return res.status(400).json({ erro: 'A senha atual está incorreta.', campos: { senhaAtual: 'Senha atual incorreta.' } });
    }
    await db.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [await bcrypt.hash(novaSenha, 10), id]);
  }
  await db.query('UPDATE usuarios SET nome = ?, telefone = ? WHERE id = ?', [nome, telefone || null, id]);
  req.session.usuario.nome = nome;
  req.session.usuario.telefone = telefone || null;
  res.json({ mensagem: 'Dados atualizados com sucesso!', usuario: req.session.usuario });
});

// POST /api/auth/recuperar -> gera um link de redefinição válido por 1 hora.
// Como a loja é fictícia, nenhum e-mail é enviado: o link é devolvido na resposta
// para simular a mensagem que o cliente receberia.
router.post('/recuperar', async (req, res) => {
  const email = texto(req.body.email, 160).toLowerCase();
  if (!emailValido(email)) return res.status(400).json({ erro: 'Informe um e-mail válido.' });

  const resposta = { mensagem: 'Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.' };
  const [[usuario]] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (usuario) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.query(
      'UPDATE usuarios SET token_recuperacao = ?, token_expira = NOW() + INTERVAL 1 HOUR WHERE id = ?',
      [token, usuario.id]
    );
    resposta.linkSimulado = `/recuperar-senha.html?token=${token}`;
  }
  res.json(resposta);
});

// POST /api/auth/redefinir -> troca a senha usando o token recebido
router.post('/redefinir', async (req, res) => {
  const token = texto(req.body.token, 64);
  const senha = String(req.body.senha || '');
  if (senha.length < 6) return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });

  const [[usuario]] = await db.query(
    'SELECT id FROM usuarios WHERE token_recuperacao = ? AND token_expira > NOW()', [token]
  );
  if (!token || !usuario) return res.status(400).json({ erro: 'Link inválido ou expirado. Peça um novo link.' });

  await db.query(
    'UPDATE usuarios SET senha_hash = ?, token_recuperacao = NULL, token_expira = NULL WHERE id = ?',
    [await bcrypt.hash(senha, 10), usuario.id]
  );
  res.json({ mensagem: 'Senha alterada! Agora é só entrar com a nova senha.' });
});

module.exports = router;
