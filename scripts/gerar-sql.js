/*
 * Gera um arquivo de instalação a partir do esquema, catálogo e dados fictícios.
 * IDs e chaves estrangeiras ligam usuários, produtos, pedidos e avaliações.
 * As datas são expressões SQL relativas à importação; as senhas usam bcrypt.
 */
/*
 * Gera database/riff_store.sql: estrutura do banco + dados iniciais, pronto
 * para importar no phpMyAdmin (XAMPP) ou rodar com "npm run db:init".
 * As datas são relativas ao momento da importação (NOW()), então as
 * promoções e os pedidos "de hoje" sempre aparecem atualizados.
 *
 * Uso: node scripts/gerar-sql.js   (ou npm run sql)
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { categorias, produtos } = require('../database/catalogo');
const { imagensDoProduto } = require('../database/imagens');
const seed = require('../database/seed');

// Formata literais dos dados de origem para o arquivo SQL, incluindo nulos e caracteres escapados.
const sql = v => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
};
const diasAtras = (n, hora = 14) => `TIMESTAMP(CURDATE() - INTERVAL ${n} DAY, '${String(hora).padStart(2, '0')}:${String((n * 17) % 60).padStart(2, '0')}:00')`;
const insert = (tabela, colunas, linhas) =>
  `INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES\n${linhas.map(l => `  (${l.join(', ')})`).join(',\n')};\n`;

// A função retorna o SQL como texto; a execução no MySQL é responsabilidade de database/init.js.
function gerarSql(nomeBanco = 'riff_store') {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8').replace(/riff_store/g, nomeBanco);
  const idProduto = slug => produtos.findIndex(p => p.slug === slug) + 1;
  const produto = slug => produtos[idProduto(slug) - 1];
  let saida = `-- =============================================================
-- Riff Store: Merch & Vinis de Rock
-- Banco de dados completo (estrutura + dados iniciais)
--
-- Como importar no XAMPP:
--   1. Inicie o Apache e o MySQL no painel do XAMPP
--   2. Abra http://localhost/phpmyadmin
--   3. Aba "Importar" -> escolha este arquivo -> "Executar"
--   (o banco "${nomeBanco}" é criado automaticamente; reimportar apaga os dados)
--
-- Contas: admin@riffstore.com / admin123  ·  cliente@riffstore.com / cliente123
-- Gerado por scripts/gerar-sql.js
-- =============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

${schema}
-- -------------------------------------------------------------
-- Dados iniciais
-- -------------------------------------------------------------

`;

  saida += insert('categorias', ['id', 'nome', 'slug', 'icone', 'ordem'],
    categorias.map((c, i) => [i + 1, sql(c.nome), sql(c.slug), sql(c.icone), c.ordem]));

  saida += '\n' + insert('produtos',
    ['id', 'categoria_id', 'nome', 'slug', 'banda', 'descricao', 'detalhes', 'faixas', 'ano', 'preco', 'preco_promocional',
      'promocao_fim', 'estoque', 'tem_tamanhos', 'imagem', 'galeria', 'audio_preview', 'destaque', 'criado_em'],
    produtos.map((p, i) => {
      const img = imagensDoProduto(p);
      return [
        i + 1, categorias.findIndex(c => c.slug === p.categoria) + 1, sql(p.nome), sql(p.slug), sql(p.banda), sql(p.descricao),
        sql(p.detalhes || null), sql(p.faixas || null), sql(p.ano || null), p.preco.toFixed(2), p.promo ? p.promo.preco.toFixed(2) : 'NULL',
        p.promo ? `NOW() + INTERVAL ${p.promo.dias * 24 + 6} HOUR` : 'NULL', p.estoque, p.categoria === 'camisetas' ? 1 : 0,
        sql(img.imagem), sql(img.galeria.join(',') || null), sql(p.audio ? p.audio.replace(/^\//, '') : null), p.destaque ? 1 : 0,
        diasAtras(p.novo ? 3 + (i % 10) : 60 + i * 7)
      ];
    }));

  saida += '\n' + insert('usuarios', ['id', 'nome', 'email', 'senha_hash', 'telefone', 'perfil', 'criado_em'],
    seed.usuarios.map(u => [u.id, sql(u.nome), sql(u.email), sql(bcrypt.hashSync(u.senha, 10)), sql(u.telefone), sql(u.perfil), diasAtras(u.dias)]));

  const pedidos = [];
  const itens = [];
  seed.pedidos.forEach((ped, i) => {
    const u = seed.usuarios.find(x => x.id === ped.usuario);
    const [cep, endereco, numero, complemento, bairro, cidade, uf] = seed.enderecos[ped.usuario];
    const subtotal = Math.round(ped.itens.reduce((s, [slug, , q]) => s + produto(slug).preco * q, 0) * 100) / 100;
    const frete = subtotal >= 299 ? 0 : 19.90;
    pedidos.push([i + 1, u.id, sql(u.nome), sql(u.email), sql(u.telefone), sql(cep), sql(endereco), sql(numero), sql(complemento || null),
      sql(bairro), sql(cidade), sql(uf), sql(ped.pagamento), subtotal.toFixed(2), frete.toFixed(2), (subtotal + frete).toFixed(2),
      sql(ped.status), ped.dias === 0 ? `NOW() - INTERVAL ${2 + i} HOUR` : diasAtras(ped.dias)]);
    ped.itens.forEach(([slug, tamanho, qtd]) => {
      itens.push([i + 1, idProduto(slug), sql(produto(slug).nome), sql(tamanho), qtd, produto(slug).preco.toFixed(2)]);
    });
  });
  saida += '\n' + insert('pedidos', ['id', 'usuario_id', 'nome_cliente', 'email', 'telefone', 'cep', 'endereco', 'numero', 'complemento',
    'bairro', 'cidade', 'uf', 'forma_pagamento', 'subtotal', 'frete', 'total', 'status', 'criado_em'], pedidos);
  saida += '\n' + insert('itens_pedido', ['pedido_id', 'produto_id', 'nome_produto', 'tamanho', 'quantidade', 'preco_unitario'], itens);

  saida += '\n' + insert('avaliacoes', ['produto_id', 'usuario_id', 'nota', 'comentario', 'criado_em'],
    seed.avaliacoes.map(([slug, usuario, nota, comentario]) => [idProduto(slug), usuario, nota, sql(comentario), diasAtras(5)]));

  saida += '\n' + insert('mensagens', ['nome', 'email', 'assunto', 'mensagem', 'lida', 'criado_em'],
    seed.mensagens.map(([nome, email, assunto, mensagem, lida, dias]) => [sql(nome), sql(email), sql(assunto), sql(mensagem), lida, diasAtras(dias)]));

  saida += '\n' + insert('configuracoes', ['chave', 'valor'], Object.entries(seed.configuracoes).map(([k, v]) => [sql(k), sql(v)]));
  return saida;
}

module.exports = { gerarSql };

if (require.main === module) {
  const arquivo = path.join(__dirname, '..', 'database', 'riff_store.sql');
  fs.writeFileSync(arquivo, gerarSql());
  console.log(`Gerado: database/riff_store.sql (${produtos.length} produtos, ${seed.usuarios.length} usuários, ${seed.pedidos.length} pedidos).`);
}
