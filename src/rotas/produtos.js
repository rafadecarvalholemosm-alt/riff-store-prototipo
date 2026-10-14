/*
 * A vitrine combina filtros em SQL e devolve somente a página solicitada.
 * JOIN relaciona o produto à categoria; subconsultas resumem as avaliações visíveis.
 * O navegador recebe produtos formatados, com preço atual, galeria e selos.
 */
// Rotas públicas do catálogo: vitrine, busca, filtros, detalhes e avaliações.
const express = require('express');
const db = require('../banco/conexao');
const { texto, formatarProduto } = require('../utils/validacao');
const { exigirLogin } = require('../middlewares/autenticacao');

const router = express.Router();

// Campos lidos em todas as consultas de produtos (com a categoria e a média das avaliações)
const SELECT_PRODUTO = `
  SELECT p.*, c.nome AS categoria_nome, c.slug AS categoria_slug,
         (SELECT AVG(a.nota) FROM avaliacoes a WHERE a.produto_id = p.id AND a.visivel = 1) AS media_notas,
         (SELECT COUNT(*)    FROM avaliacoes a WHERE a.produto_id = p.id AND a.visivel = 1) AS total_avaliacoes
  FROM produtos p
  JOIN categorias c ON c.id = p.categoria_id`;

// Preço que vale agora (promocional, se a promoção estiver ativa)
const PRECO_ATUAL = `(CASE WHEN p.preco_promocional IS NOT NULL AND p.promocao_fim > NOW()
                          THEN p.preco_promocional ELSE p.preco END)`;

// ORDER BY utiliza esta lista de opções permitidas: o nome recebido na URL nunca entra diretamente no SQL.
const ORDENACOES = {
  relevancia: `p.destaque DESC, (p.estoque > 0) DESC, total_avaliacoes DESC, p.id`,
  menor: `${PRECO_ATUAL} ASC, p.id`,
  maior: `${PRECO_ATUAL} DESC, p.id`,
  novos: `p.criado_em DESC, p.id`,
  nome: `p.nome ASC`
};

// GET /api/categorias
router.get('/categorias', async (req, res) => {
  const [linhas] = await db.query(
    `SELECT c.id, c.nome, c.slug, c.icone, COUNT(p.id) AS total
       FROM categorias c
       LEFT JOIN produtos p ON p.categoria_id = c.id AND p.ativo = 1
      GROUP BY c.id ORDER BY c.ordem`
  );
  res.json(linhas);
});

// GET /api/bandas -> lista de bandas com a quantidade de produtos
router.get('/bandas', async (req, res) => {
  const [linhas] = await db.query(
    `SELECT banda AS nome, COUNT(*) AS total FROM produtos
      WHERE ativo = 1 AND banda <> 'Riff Store'
      GROUP BY banda ORDER BY banda`
  );
  res.json(linhas);
});

// GET /api/produtos?ids=&busca=&categoria=&bandas=a,b&precoMin=&precoMax=&estoque=1&promocao=1&ordem=&pagina=&limite=
router.get('/produtos', async (req, res) => {
  // Condições e valores são montados separadamente para combinar filtros com parâmetros seguros.
  const condicoes = ['p.ativo = 1'];
  const params = [];

  const busca = texto(req.query.busca, 80);
  if (busca) {
    condicoes.push('(p.nome LIKE ? OR p.banda LIKE ? OR c.nome LIKE ?)');
    params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
  }
  const categoria = texto(req.query.categoria, 60);
  if (categoria) {
    condicoes.push('c.slug = ?');
    params.push(categoria);
  }
  const bandas = texto(req.query.bandas, 500).split(',').map(b => b.trim()).filter(Boolean).slice(0, 20);
  if (bandas.length) {
    condicoes.push(`p.banda IN (${bandas.map(() => '?').join(',')})`);
    params.push(...bandas);
  }
  const precoMin = parseFloat(req.query.precoMin);
  if (!Number.isNaN(precoMin)) {
    condicoes.push(`${PRECO_ATUAL} >= ?`);
    params.push(precoMin);
  }
  const precoMax = parseFloat(req.query.precoMax);
  if (!Number.isNaN(precoMax)) {
    condicoes.push(`${PRECO_ATUAL} <= ?`);
    params.push(precoMax);
  }
  // ids=1,2,3 -> usado pelo carrinho para conferir preço e estoque atuais
  const ids = texto(req.query.ids, 500).split(',').map(n => parseInt(n, 10)).filter(n => n > 0).slice(0, 50);
  if (ids.length) {
    condicoes.push(`p.id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  }
  if (req.query.estoque === '1') condicoes.push('p.estoque > 0');
  if (req.query.promocao === '1') condicoes.push('p.preco_promocional IS NOT NULL AND p.promocao_fim > NOW()');
  if (req.query.novos === '1') condicoes.push('p.criado_em >= NOW() - INTERVAL 30 DAY');

  const where = `WHERE ${condicoes.join(' AND ')}`;
  const ordem = ORDENACOES[req.query.ordem] || ORDENACOES.relevancia;
  // LIMIT define quantos itens retornam, e OFFSET pula os itens das páginas anteriores.
  const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 12, 1), 48);
  const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM produtos p JOIN categorias c ON c.id = p.categoria_id ${where}`, params
  );
  const [linhas] = await db.query(
    `${SELECT_PRODUTO} ${where} ORDER BY ${ordem} LIMIT ? OFFSET ?`,
    [...params, limite, (pagina - 1) * limite]
  );
  const [[faixa]] = await db.query(
    `SELECT FLOOR(MIN(${PRECO_ATUAL})) AS minimo, CEIL(MAX(${PRECO_ATUAL})) AS maximo FROM produtos p WHERE p.ativo = 1`
  );

  res.json({
    produtos: linhas.map(formatarProduto),
    total,
    pagina,
    paginas: Math.max(Math.ceil(total / limite), 1),
    faixaPreco: { minimo: Number(faixa.minimo) || 0, maximo: Number(faixa.maximo) || 0 }
  });
});

// GET /api/produtos/destaques
router.get('/produtos/destaques', async (req, res) => {
  const [linhas] = await db.query(
    `${SELECT_PRODUTO} WHERE p.ativo = 1 AND p.destaque = 1 ORDER BY (p.estoque > 0) DESC, p.id LIMIT 8`
  );
  res.json(linhas.map(formatarProduto));
});

// GET /api/produtos/ofertas -> promoções ativas, da que termina primeiro para a última
router.get('/produtos/ofertas', async (req, res) => {
  const [linhas] = await db.query(
    `${SELECT_PRODUTO}
      WHERE p.ativo = 1 AND p.preco_promocional IS NOT NULL AND p.promocao_fim > NOW()
      ORDER BY p.promocao_fim ASC LIMIT 8`
  );
  res.json(linhas.map(formatarProduto));
});

// GET /api/produtos/:slug -> detalhes, avaliações visíveis e produtos relacionados
router.get('/produtos/:slug', async (req, res) => {
  const [[linha]] = await db.query(`${SELECT_PRODUTO} WHERE p.slug = ? AND p.ativo = 1`, [req.params.slug]);
  if (!linha) return res.status(404).json({ erro: 'Produto não encontrado.' });

  const [avaliacoes] = await db.query(
    `SELECT a.id, a.nota, a.comentario, a.criado_em, u.nome
       FROM avaliacoes a JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.produto_id = ? AND a.visivel = 1
      ORDER BY a.criado_em DESC`, [linha.id]
  );
  const [relacionados] = await db.query(
    `${SELECT_PRODUTO}
      WHERE p.ativo = 1 AND p.id <> ? AND (p.banda = ? OR p.categoria_id = ?)
      ORDER BY (p.banda = ?) DESC, (p.estoque > 0) DESC, RAND() LIMIT 4`,
    [linha.id, linha.banda, linha.categoria_id, linha.banda]
  );

  // Informa se o usuário logado pode avaliar (comprou e ainda não avaliou)
  let podeAvaliar = false;
  const usuario = req.session.usuario;
  if (usuario) {
    const [[compra]] = await db.query(
      `SELECT 1 AS ok FROM itens_pedido i JOIN pedidos pe ON pe.id = i.pedido_id
        WHERE pe.usuario_id = ? AND i.produto_id = ? LIMIT 1`, [usuario.id, linha.id]
    );
    const [[jaAvaliou]] = await db.query(
      'SELECT 1 AS ok FROM avaliacoes WHERE usuario_id = ? AND produto_id = ?', [usuario.id, linha.id]
    );
    podeAvaliar = !!compra && !jaAvaliou;
  }

  res.json({
    produto: formatarProduto(linha),
    avaliacoes: avaliacoes.map(a => ({
      id: a.id, nota: a.nota, comentario: a.comentario, data: a.criado_em,
      // mostra só o primeiro nome e a inicial do sobrenome
      autor: a.nome.split(' ').length > 1
        ? `${a.nome.split(' ')[0]} ${a.nome.split(' ').slice(-1)[0][0]}.`
        : a.nome
    })),
    relacionados: relacionados.map(formatarProduto),
    podeAvaliar
  });
});

// POST /api/produtos/:id/avaliacoes -> só para clientes que compraram o produto
// O middleware verifica a sessão; a consulta abaixo verifica também se essa conta comprou o produto.
router.post('/produtos/:id/avaliacoes', exigirLogin, async (req, res) => {
  const produtoId = parseInt(req.params.id, 10);
  const nota = parseInt(req.body.nota, 10);
  const comentario = texto(req.body.comentario, 1000);

  if (!(nota >= 1 && nota <= 5)) return res.status(400).json({ erro: 'Escolha uma nota de 1 a 5 estrelas.' });
  if (comentario.length < 10) return res.status(400).json({ erro: 'Escreva um comentário com pelo menos 10 caracteres.' });

  const [[compra]] = await db.query(
    `SELECT 1 AS ok FROM itens_pedido i JOIN pedidos pe ON pe.id = i.pedido_id
      WHERE pe.usuario_id = ? AND i.produto_id = ? LIMIT 1`, [req.session.usuario.id, produtoId]
  );
  if (!compra) return res.status(403).json({ erro: 'Apenas clientes que compraram este produto podem avaliá-lo.' });

  try {
    await db.query(
      'INSERT INTO avaliacoes (produto_id, usuario_id, nota, comentario) VALUES (?, ?, ?, ?)',
      [produtoId, req.session.usuario.id, nota, comentario]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Você já avaliou este produto.' });
    throw err;
  }
  res.status(201).json({ mensagem: 'Obrigado pela avaliação!' });
});

module.exports = router;
