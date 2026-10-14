/*
 * Um pedido precisa manter itens, valores e estoque consistentes.
 * A transação agrupa as gravações; FOR UPDATE impede alterações concorrentes no estoque.
 * Os preços e descontos são recalculados no servidor, usando os dados do banco.
 */
// Finalização de pedidos e histórico do cliente.
const express = require('express');
const db = require('../banco/conexao');
const { texto, emailValido, telefoneValido, promocaoAtiva } = require('../utils/validacao');
const { exigirLogin } = require('../middlewares/autenticacao');
const { verificarCupom, calcularDesconto, ErroCupom } = require('../utils/cupons');

const router = express.Router();

const FRETE_FIXO = 19.90;
const FRETE_GRATIS_A_PARTIR = 299;
const TAMANHOS = ['P', 'M', 'G', 'GG'];
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
  'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

function calcularFrete(subtotal) {
  return subtotal >= FRETE_GRATIS_A_PARTIR ? 0 : FRETE_FIXO;
}

// Valida os dados do formulário de finalização (as mesmas regras do navegador)
function validarPedido(body) {
  const d = {
    nome: texto(body.nome, 120),
    email: texto(body.email, 160).toLowerCase(),
    telefone: texto(body.telefone, 20),
    cep: texto(body.cep, 9),
    endereco: texto(body.endereco, 160),
    numero: texto(body.numero, 10),
    complemento: texto(body.complemento, 80),
    bairro: texto(body.bairro, 80),
    cidade: texto(body.cidade, 80),
    uf: texto(body.uf, 2).toUpperCase(),
    pagamento: texto(body.pagamento, 10)
  };
  const erros = {};
  if (d.nome.length < 3) erros.nome = 'Informe o nome completo.';
  if (!emailValido(d.email)) erros.email = 'Informe um e-mail válido.';
  if (!telefoneValido(d.telefone)) erros.telefone = 'Informe um telefone com DDD.';
  if (!/^\d{5}-?\d{3}$/.test(d.cep)) erros.cep = 'Informe um CEP válido (00000-000).';
  if (d.endereco.length < 3) erros.endereco = 'Informe o endereço.';
  if (!d.numero) erros.numero = 'Informe o número.';
  if (d.bairro.length < 2) erros.bairro = 'Informe o bairro.';
  if (d.cidade.length < 2) erros.cidade = 'Informe a cidade.';
  if (!UFS.includes(d.uf)) erros.uf = 'Selecione o estado.';
  if (!['pix', 'cartao', 'boleto'].includes(d.pagamento)) erros.pagamento = 'Escolha a forma de pagamento.';
  if (d.cep.length === 8) d.cep = `${d.cep.slice(0, 5)}-${d.cep.slice(5)}`;
  return { dados: d, erros };
}

// GET /api/pedidos/frete?subtotal= -> regra de frete (usada no carrinho)
router.get('/frete', (req, res) => {
  res.json({ valorFixo: FRETE_FIXO, gratisAPartirDe: FRETE_GRATIS_A_PARTIR });
});

// GET /api/pedidos -> histórico do cliente logado
router.get('/', exigirLogin, async (req, res) => {
  const [pedidos] = await db.query(
    `SELECT id, total, subtotal, frete, desconto, cupom, status, forma_pagamento, criado_em, cidade, uf
       FROM pedidos WHERE usuario_id = ? ORDER BY criado_em DESC`, [req.session.usuario.id]
  );
  if (pedidos.length) {
    const [itens] = await db.query(
      `SELECT i.pedido_id, i.produto_id, i.nome_produto, i.tamanho, i.quantidade, i.preco_unitario,
              p.imagem, p.slug
         FROM itens_pedido i JOIN produtos p ON p.id = i.produto_id
        WHERE i.pedido_id IN (?)`, [pedidos.map(p => p.id)]
    );
    for (const p of pedidos) p.itens = itens.filter(i => i.pedido_id === p.id);
  }
  res.json(pedidos);
});

// POST /api/pedidos -> registra o pedido e dá baixa no estoque (pagamento simulado)
router.post('/', exigirLogin, async (req, res) => {
  const { dados, erros } = validarPedido(req.body);
  if (Object.keys(erros).length) return res.status(400).json({ erro: 'Verifique os campos destacados.', campos: erros });

  const itensRecebidos = Array.isArray(req.body.itens) ? req.body.itens.slice(0, 50) : [];
  if (!itensRecebidos.length) return res.status(400).json({ erro: 'Seu carrinho está vazio.' });

  const conn = await db.getConnection();
  try {
    // A transação permite desfazer todas as gravações caso uma validação ou consulta falhe.
    await conn.beginTransaction();

    const [[usuario]] = await conn.query('SELECT bloqueado FROM usuarios WHERE id = ?', [req.session.usuario.id]);
    if (!usuario || usuario.bloqueado) {
      await conn.rollback();
      return res.status(403).json({ erro: 'Sua conta não pode realizar pedidos no momento.' });
    }

    // Agrupa itens repetidos (mesmo produto e tamanho)
    const agrupados = new Map();
    for (const it of itensRecebidos) {
      const id = parseInt(it.id, 10);
      const qtd = parseInt(it.quantidade, 10);
      const tamanho = it.tamanho ? texto(it.tamanho, 2).toUpperCase() : null;
      if (!id || !(qtd > 0 && qtd <= 20)) {
        await conn.rollback();
        return res.status(400).json({ erro: 'Há itens inválidos no carrinho.' });
      }
      const chave = `${id}|${tamanho || ''}`;
      const atual = agrupados.get(chave);
      agrupados.set(chave, { id, tamanho, quantidade: (atual ? atual.quantidade : 0) + qtd });
    }

    // Busca os produtos travando as linhas para o estoque não mudar durante o pedido.
    // Os preços sempre vêm do banco, nunca do navegador.
    const ids = [...new Set([...agrupados.values()].map(i => i.id))];
    const [produtos] = await conn.query(
      'SELECT * FROM produtos WHERE id IN (?) AND ativo = 1 FOR UPDATE', [ids]
    );
    const porId = new Map(produtos.map(p => [p.id, p]));

    const pedidoPorProduto = new Map();
    const itens = [];
    for (const it of agrupados.values()) {
      const p = porId.get(it.id);
      if (!p) {
        await conn.rollback();
        return res.status(409).json({ erro: 'Um dos produtos do carrinho não está mais disponível.' });
      }
      if (p.tem_tamanhos && !TAMANHOS.includes(it.tamanho)) {
        await conn.rollback();
        return res.status(400).json({ erro: `Escolha o tamanho de "${p.nome}".` });
      }
      pedidoPorProduto.set(p.id, (pedidoPorProduto.get(p.id) || 0) + it.quantidade);
      const preco = promocaoAtiva(p) ? Number(p.preco_promocional) : Number(p.preco);
      itens.push({ produto: p, tamanho: p.tem_tamanhos ? it.tamanho : null, quantidade: it.quantidade, preco });
    }
    // Quantidades de tamanhos diferentes também consomem o estoque do mesmo produto.
    for (const [id, qtd] of pedidoPorProduto) {
      const p = porId.get(id);
      if (p.estoque < qtd) {
        await conn.rollback();
        return res.status(409).json({
          erro: p.estoque === 0
            ? `"${p.nome}" acabou de esgotar. Remova-o do carrinho para continuar.`
            : `Só temos ${p.estoque} unidade(s) de "${p.nome}" em estoque.`
        });
      }
    }

    const subtotal = Math.round(itens.reduce((s, i) => s + i.preco * i.quantidade, 0) * 100) / 100;
    const frete = calcularFrete(subtotal);

    // Cupom de desconto (conferido de novo aqui: o navegador não decide o desconto)
    let cupom = null;
    let desconto = 0;
    if (req.body.cupom) {
      try {
        cupom = await verificarCupom(conn, req.body.cupom, [dados.email, req.session.usuario.email], req.session.usuario.id);
      } catch (err) {
        await conn.rollback();
        if (err instanceof ErroCupom) return res.status(400).json({ erro: err.message, campos: { cupom: err.message } });
        throw err;
      }
      desconto = calcularDesconto(subtotal, cupom.percentual);
    }
    const total = Math.round((subtotal - desconto + frete) * 100) / 100;

    const [r] = await conn.query(
      `INSERT INTO pedidos (usuario_id, nome_cliente, email, telefone, cep, endereco, numero, complemento,
         bairro, cidade, uf, forma_pagamento, subtotal, frete, cupom, desconto, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.session.usuario.id, dados.nome, dados.email, dados.telefone, dados.cep, dados.endereco, dados.numero,
        dados.complemento || null, dados.bairro, dados.cidade, dados.uf, dados.pagamento, subtotal, frete,
        cupom ? cupom.codigo : null, desconto, total]
    );
    for (const i of itens) {
      await conn.query(
        `INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, tamanho, quantidade, preco_unitario)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [r.insertId, i.produto.id, i.produto.nome, i.tamanho, i.quantidade, i.preco]
      );
    }
    for (const [id, qtd] of pedidoPorProduto) {
      await conn.query('UPDATE produtos SET estoque = estoque - ? WHERE id = ?', [qtd, id]);
    }

    // Confirma conjuntamente o pedido, seus itens e a baixa do estoque.
    await conn.commit();
    res.status(201).json({ mensagem: 'Pedido registrado com sucesso!', pedido: { id: r.insertId, subtotal, frete, desconto, total } });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    // Devolve a conexão ao pool mesmo quando houve erro, evitando esgotar as conexões.
    conn.release();
  }
});

module.exports = router;
