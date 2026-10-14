/*
 * Operações institucionais da loja: contato, newsletter, cupom e configurações.
 * As validações do servidor complementam as mensagens exibidas pelo navegador.
 * Consultas parametrizadas separam os valores recebidos da instrução SQL.
 */
// Rotas públicas institucionais: contato, newsletter, cupons e configurações da loja.
const express = require('express');
const db = require('../banco/conexao');
const { texto, emailValido } = require('../utils/validacao');
const { verificarCupom, ErroCupom } = require('../utils/cupons');

const router = express.Router();

const ASSUNTOS = ['duvida', 'pedido', 'troca', 'sugestao', 'outro'];

// POST /api/mensagens -> salva a mensagem do "Fale Conosco"
router.post('/mensagens', async (req, res) => {
  const nome = texto(req.body.nome, 120);
  const email = texto(req.body.email, 160).toLowerCase();
  const assunto = texto(req.body.assunto, 40);
  const mensagem = texto(req.body.mensagem, 2000);

  const erros = {};
  if (nome.length < 3) erros.nome = 'Informe seu nome.';
  if (!emailValido(email)) erros.email = 'Informe um e-mail válido.';
  if (!ASSUNTOS.includes(assunto)) erros.assunto = 'Escolha um assunto.';
  if (mensagem.length < 10) erros.mensagem = 'A mensagem deve ter pelo menos 10 caracteres.';
  if (Object.keys(erros).length) return res.status(400).json({ erro: 'Verifique os campos destacados.', campos: erros });

  await db.query(
    'INSERT INTO mensagens (nome, email, assunto, mensagem) VALUES (?, ?, ?, ?)',
    [nome, email, assunto, mensagem]
  );
  res.status(201).json({ mensagem: 'Mensagem enviada! Responderemos em até 2 dias úteis.' });
});

// POST /api/newsletter -> inscreve o e-mail (e libera o cupom ROCK10)
router.post('/newsletter', async (req, res) => {
  const email = texto(req.body.email, 160).toLowerCase();
  if (!emailValido(email)) return res.status(400).json({ erro: 'Informe um e-mail válido.', campos: { email: 'Informe um e-mail válido.' } });
  // A chave do e-mail evita duplicatas; INSERT IGNORE mantém a inscrição mesmo se ela já existir.
  await db.query('INSERT IGNORE INTO newsletter (email) VALUES (?)', [email]);
  res.status(201).json({ mensagem: 'Inscrição confirmada! Use o cupom ROCK10 e ganhe 10% de desconto.', cupom: 'ROCK10' });
});

// POST /api/cupons/validar -> confere o cupom antes de aplicá-lo no carrinho
router.post('/cupons/validar', async (req, res) => {
  const usuario = req.session.usuario;
  try {
    const cupom = await verificarCupom(db, req.body.codigo, [texto(req.body.email, 160), usuario && usuario.email], usuario ? usuario.id : null);
    res.json(cupom);
  } catch (err) {
    if (err instanceof ErroCupom) return res.status(400).json({ erro: err.message });
    throw err;
  }
});

// GET /api/configuracoes -> contato e redes sociais exibidos no site
router.get('/configuracoes', async (req, res) => {
  const [linhas] = await db.query('SELECT chave, valor FROM configuracoes');
  // Transforma pares chave/valor em um objeto que cabeçalho, rodapé e contato conseguem consultar.
  res.json(Object.fromEntries(linhas.map(l => [l.chave, l.valor])));
});

module.exports = router;
