/*
 * O painel utiliza rotas próprias, protegidas por perfil de administrador.
 * As operações consultam, cadastram, atualizam ou desativam registros do MySQL.
 * Produtos vendidos mantêm seu histórico quando deixam de aparecer na vitrine.
 */
// Rotas do painel administrativo. Todas exigem um usuário com perfil "admin".
const express = require('express');
const db = require('../db');
const { texto, gerarSlug, formatarProduto } = require('../util');
const { exigirAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(exigirAdmin);

const STATUS = ['recebido', 'em_separacao', 'enviado', 'entregue'];

// ------------------------------------------------------------------ Resumo
router.get('/resumo', async (req, res) => {
  const [[produtos]] = await db.query(
    `SELECT COUNT(*) AS total, SUM(estoque = 0) AS esgotados, SUM(estoque BETWEEN 1 AND 5) AS estoqueBaixo
       FROM produtos WHERE ativo = 1`
  );
  const [[pedidos]] = await db.query(
    `SELECT SUM(DATE(criado_em) = CURDATE()) AS hoje,
            SUM(status = 'recebido') AS aguardando,
            COALESCE(SUM(CASE WHEN criado_em >= NOW() - INTERVAL 30 DAY THEN total END), 0) AS faturamento30
       FROM pedidos`
  );
  const [[usuarios]] = await db.query(`SELECT COUNT(*) AS total FROM usuarios WHERE perfil = 'cliente'`);
  const [[mensagens]] = await db.query('SELECT COUNT(*) AS naoLidas FROM mensagens WHERE lida = 0');
  const [recentes] = await db.query(
    'SELECT id, nome_cliente, total, status, criado_em FROM pedidos ORDER BY criado_em DESC LIMIT 6'
  );
  // vendas por dia nos últimos 7 dias
  const [vendas] = await db.query(
    `SELECT DATE_FORMAT(criado_em, '%Y-%m-%d') AS dia, COUNT(*) AS pedidos, SUM(total) AS total
       FROM pedidos WHERE criado_em >= CURDATE() - INTERVAL 6 DAY
      GROUP BY dia ORDER BY dia`
  );

  res.json({
    produtos: { total: produtos.total, esgotados: Number(produtos.esgotados) || 0, estoqueBaixo: Number(produtos.estoqueBaixo) || 0 },
    pedidos: { hoje: Number(pedidos.hoje) || 0, aguardando: Number(pedidos.aguardando) || 0, faturamento30: Number(pedidos.faturamento30) },
    usuarios: usuarios.total,
    mensagensNaoLidas: mensagens.naoLidas,
    recentes,
    vendas
  });
});

// ------------------------------------------------------------------ Produtos
router.get('/produtos', async (req, res) => {
  const [linhas] = await db.query(
    `SELECT p.*, c.nome AS categoria_nome, c.slug AS categoria_slug
       FROM produtos p JOIN categorias c ON c.id = p.categoria_id
      ORDER BY p.ativo DESC, p.id DESC`
  );
  res.json(linhas.map(l => ({
    ...formatarProduto(l),
    categoriaId: l.categoria_id,
    precoPromocional: l.preco_promocional !== null ? Number(l.preco_promocional) : null,
    promocaoFimBruto: l.promocao_fim,
    ativo: !!l.ativo
  })));
});

// Lê e valida os campos do formulário de produto
// O formulário é validado antes de produzir os valores enviados ao INSERT ou UPDATE.
async function lerProduto(body) {
  const p = {
    nome: texto(body.nome, 140),
    banda: texto(body.banda, 80),
    categoria_id: parseInt(body.categoriaId, 10),
    descricao: texto(body.descricao, 3000),
    detalhes: texto(body.detalhes, 2000) || null,
    faixas: texto(body.faixas, 3000) || null,
    ano: body.ano ? parseInt(body.ano, 10) : null,
    preco: parseFloat(body.preco),
    preco_promocional: body.precoPromocional !== '' && body.precoPromocional !== null && body.precoPromocional !== undefined
      ? parseFloat(body.precoPromocional) : null,
    promocao_fim: body.promocaoFim ? new Date(body.promocaoFim) : null,
    estoque: parseInt(body.estoque, 10),
    tem_tamanhos: body.temTamanhos ? 1 : 0,
    imagem: texto(body.imagem, 255),
    galeria: texto(body.galeria, 1000) || null,
    audio_preview: texto(body.audio, 255) || null,
    destaque: body.destaque ? 1 : 0,
    ativo: body.ativo === false ? 0 : 1
  };
  const erros = {};
  if (p.nome.length < 3) erros.nome = 'Informe o nome do produto.';
  if (!p.banda) erros.banda = 'Informe a banda (ou "Riff Store").';
  const [[cat]] = await db.query('SELECT id FROM categorias WHERE id = ?', [p.categoria_id || 0]);
  if (!cat) erros.categoriaId = 'Escolha a categoria.';
  if (p.descricao.length < 10) erros.descricao = 'Escreva uma descrição.';
  if (!(p.preco > 0)) erros.preco = 'Informe um preço maior que zero.';
  if (p.preco_promocional !== null) {
    if (!(p.preco_promocional > 0 && p.preco_promocional < p.preco)) erros.precoPromocional = 'O preço promocional deve ser menor que o preço normal.';
    if (!p.promocao_fim || Number.isNaN(p.promocao_fim.getTime())) erros.promocaoFim = 'Informe até quando vale a promoção.';
  } else {
    p.promocao_fim = null;
  }
  if (!(p.estoque >= 0)) erros.estoque = 'Informe o estoque (0 ou mais).';
  if (p.ano !== null && !(p.ano >= 1900 && p.ano <= 2100)) erros.ano = 'Ano inválido.';
  if (!p.imagem) erros.imagem = 'Informe o caminho da imagem.';
  return { p, erros };
}

router.post('/produtos', async (req, res) => {
  const { p, erros } = await lerProduto(req.body);
  if (Object.keys(erros).length) return res.status(400).json({ erro: 'Verifique os campos destacados.', campos: erros });

  let slug = gerarSlug(p.nome);
  const [[existe]] = await db.query('SELECT id FROM produtos WHERE slug = ?', [slug]);
  if (existe) slug = `${slug}-${Date.now().toString(36)}`;

  const [r] = await db.query('INSERT INTO produtos SET ?', [{ ...p, slug }]);
  res.status(201).json({ mensagem: 'Produto cadastrado!', id: r.insertId });
});

router.put('/produtos/:id', async (req, res) => {
  const { p, erros } = await lerProduto(req.body);
  if (Object.keys(erros).length) return res.status(400).json({ erro: 'Verifique os campos destacados.', campos: erros });
  const [r] = await db.query('UPDATE produtos SET ? WHERE id = ?', [p, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ erro: 'Produto não encontrado.' });
  res.json({ mensagem: 'Produto atualizado!' });
});

// Ajuste rápido de estoque / destaque / ativo direto na tabela
router.patch('/produtos/:id', async (req, res) => {
  const campos = {};
  if (req.body.estoque !== undefined) {
    const e = parseInt(req.body.estoque, 10);
    if (!(e >= 0)) return res.status(400).json({ erro: 'Estoque inválido.' });
    campos.estoque = e;
  }
  if (req.body.destaque !== undefined) campos.destaque = req.body.destaque ? 1 : 0;
  if (req.body.ativo !== undefined) campos.ativo = req.body.ativo ? 1 : 0;
  if (req.body.encerrarPromocao) { campos.preco_promocional = null; campos.promocao_fim = null; }
  if (!Object.keys(campos).length) return res.status(400).json({ erro: 'Nada para atualizar.' });
  const [r] = await db.query('UPDATE produtos SET ? WHERE id = ?', [campos, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ erro: 'Produto não encontrado.' });
  res.json({ mensagem: 'Produto atualizado!' });
});

// Exclui o produto; se ele já foi vendido, apenas o desativa para manter o histórico dos pedidos
router.delete('/produtos/:id', async (req, res) => {
  const [[vendido]] = await db.query('SELECT 1 AS ok FROM itens_pedido WHERE produto_id = ? LIMIT 1', [req.params.id]);
  if (vendido) {
    await db.query('UPDATE produtos SET ativo = 0 WHERE id = ?', [req.params.id]);
    return res.json({ mensagem: 'O produto já tem vendas, então foi desativado (sai da loja, mas fica no histórico).' });
  }
  const [r] = await db.query('DELETE FROM produtos WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ erro: 'Produto não encontrado.' });
  res.json({ mensagem: 'Produto excluído.' });
});

// ------------------------------------------------------------------ Pedidos
router.get('/pedidos', async (req, res) => {
  const condicoes = [];
  const params = [];
  if (STATUS.includes(req.query.status)) { condicoes.push('status = ?'); params.push(req.query.status); }
  const [pedidos] = await db.query(
    `SELECT * FROM pedidos ${condicoes.length ? 'WHERE ' + condicoes.join(' AND ') : ''} ORDER BY criado_em DESC`, params
  );
  if (pedidos.length) {
    const [itens] = await db.query('SELECT * FROM itens_pedido WHERE pedido_id IN (?)', [pedidos.map(p => p.id)]);
    for (const p of pedidos) p.itens = itens.filter(i => i.pedido_id === p.id);
  }
  res.json(pedidos);
});

router.patch('/pedidos/:id', async (req, res) => {
  if (!STATUS.includes(req.body.status)) return res.status(400).json({ erro: 'Status inválido.' });
  const [r] = await db.query('UPDATE pedidos SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ erro: 'Pedido não encontrado.' });
  res.json({ mensagem: 'Status do pedido atualizado!' });
});

// ------------------------------------------------------------------ Usuários
router.get('/usuarios', async (req, res) => {
  const [linhas] = await db.query(
    `SELECT u.id, u.nome, u.email, u.telefone, u.perfil, u.bloqueado, u.criado_em,
            COUNT(p.id) AS pedidos, COALESCE(SUM(p.total), 0) AS totalGasto
       FROM usuarios u LEFT JOIN pedidos p ON p.usuario_id = u.id
      GROUP BY u.id ORDER BY u.criado_em DESC`
  );
  res.json(linhas);
});

router.patch('/usuarios/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.session.usuario.id) return res.status(400).json({ erro: 'Você não pode bloquear a própria conta.' });
  const [r] = await db.query(
    `UPDATE usuarios SET bloqueado = ? WHERE id = ? AND perfil = 'cliente'`, [req.body.bloqueado ? 1 : 0, id]
  );
  if (!r.affectedRows) return res.status(404).json({ erro: 'Cliente não encontrado.' });
  res.json({ mensagem: req.body.bloqueado ? 'Conta bloqueada.' : 'Conta desbloqueada.' });
});

// ------------------------------------------------------------------ Avaliações
router.get('/avaliacoes', async (req, res) => {
  const [linhas] = await db.query(
    `SELECT a.id, a.nota, a.comentario, a.visivel, a.criado_em, u.nome AS cliente, p.nome AS produto, p.slug
       FROM avaliacoes a JOIN usuarios u ON u.id = a.usuario_id JOIN produtos p ON p.id = a.produto_id
      ORDER BY a.criado_em DESC`
  );
  res.json(linhas);
});

router.patch('/avaliacoes/:id', async (req, res) => {
  const [r] = await db.query('UPDATE avaliacoes SET visivel = ? WHERE id = ?', [req.body.visivel ? 1 : 0, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ erro: 'Avaliação não encontrada.' });
  res.json({ mensagem: req.body.visivel ? 'Avaliação visível na loja.' : 'Avaliação ocultada.' });
});

// ------------------------------------------------------------------ Mensagens
router.get('/mensagens', async (req, res) => {
  const [linhas] = await db.query('SELECT * FROM mensagens ORDER BY lida ASC, criado_em DESC');
  res.json(linhas);
});

router.patch('/mensagens/:id', async (req, res) => {
  const [r] = await db.query('UPDATE mensagens SET lida = ? WHERE id = ?', [req.body.lida ? 1 : 0, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ erro: 'Mensagem não encontrada.' });
  res.json({ mensagem: 'Mensagem atualizada.' });
});

router.delete('/mensagens/:id', async (req, res) => {
  const [r] = await db.query('DELETE FROM mensagens WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ erro: 'Mensagem não encontrada.' });
  res.json({ mensagem: 'Mensagem excluída.' });
});

// ------------------------------------------------------------------ Configurações
const CHAVES_CONFIG = ['email', 'telefone', 'whatsapp', 'endereco', 'horario', 'instagram', 'facebook', 'youtube'];

router.put('/configuracoes', async (req, res) => {
  for (const chave of CHAVES_CONFIG) {
    if (req.body[chave] === undefined) continue;
    await db.query(
      'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
      [chave, texto(req.body[chave], 255)]
    );
  }
  res.json({ mensagem: 'Configurações salvas!' });
});

module.exports = router;
