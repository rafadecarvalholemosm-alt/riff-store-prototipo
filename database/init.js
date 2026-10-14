/*
 * Cria o banco de dados da Riff Store e carrega os dados iniciais, executando
 * o mesmo SQL de database/riff_store.sql (gerado por scripts/gerar-sql.js).
 * Uso: npm run db:init   (ATENÇÃO: apaga e recria todas as tabelas)
 *
 * No XAMPP também dá para importar database/riff_store.sql pelo phpMyAdmin.
 */
require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');
const { gerarSql } = require('../scripts/gerar-sql');
const databaseErrorMessage = require('../src/db-errors');

const DB_NAME = process.env.DB_NAME || 'riff_store';

async function main() {
  if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) throw new Error('DB_NAME inválido');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    connectTimeout: 5000,
    multipleStatements: true,
    charset: 'utf8mb4'
  });

  console.log(`> Criando o banco "${DB_NAME}" e carregando os dados...`);
  await conn.query(gerarSql(DB_NAME));
  const [[{ total }]] = await conn.query(`SELECT COUNT(*) AS total FROM \`${DB_NAME}\`.produtos`);
  await conn.end();

  console.log(`> Pronto! ${total} produtos cadastrados.`);
  console.log('  Administrador: admin@riffstore.com / admin123');
  console.log('  Cliente:       cliente@riffstore.com / cliente123');
}

main().catch(err => {
  console.error('Erro ao criar o banco:', databaseErrorMessage(err) || err.message || err.code || err);
  process.exit(1);
});
