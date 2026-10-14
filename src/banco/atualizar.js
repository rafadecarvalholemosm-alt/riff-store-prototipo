/*
 * Migração de compatibilidade executada durante a inicialização do servidor.
 * Consulta o esquema antes de adicionar colunas, preservando registros existentes.
 * Imagens personalizadas no painel são preservadas pela condição da atualização.
 */
// Atualiza bancos importados com uma versão anterior do database/riff_store.sql,
// sem apagar dados. Roda ao iniciar o servidor:
//  - cria a tabela da newsletter e as colunas de cupom/desconto dos pedidos, se faltarem;
//  - troca as imagens .svg (ilustrações removidas) pelas fotos reais dos produtos do catálogo,
//    preservando imagens trocadas pelo painel administrativo.
const pool = require('./conexao');
// Mapa estático necessário apenas para substituir as imagens de versões antigas.
const imagensLegadas = require('./imagens-legadas.json');

async function colunaExiste(tabela, coluna) {
  // information_schema descreve as tabelas: consultar antes evita repetir um ALTER TABLE já aplicado.
  const [[r]] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [tabela, coluna]
  );
  return r.total > 0;
}

async function atualizarBanco() {
  await pool.query(`CREATE TABLE IF NOT EXISTS newsletter (
    email      VARCHAR(160) PRIMARY KEY,
    criado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  if (!(await colunaExiste('pedidos', 'cupom'))) {
    await pool.query('ALTER TABLE pedidos ADD COLUMN cupom VARCHAR(20) NULL AFTER frete');
  }
  if (!(await colunaExiste('pedidos', 'desconto'))) {
    await pool.query('ALTER TABLE pedidos ADD COLUMN desconto DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER cupom');
  }

  // A condição sobre .svg preserva imagens personalizadas e limita a atualização às ilustrações antigas.
  let alterados = 0;
  for (const { slug, imagem, galeria } of imagensLegadas) {
    const [r] = await pool.query(
      "UPDATE produtos SET imagem = ?, galeria = ? WHERE slug = ? AND imagem LIKE '%.svg'",
      [imagem, galeria.join(',') || null, slug]
    );
    alterados += r.affectedRows;
  }
  if (alterados) console.log(`Imagens de ${alterados} produto(s) atualizadas para as fotos reais.`);
}

module.exports = atualizarBanco;
