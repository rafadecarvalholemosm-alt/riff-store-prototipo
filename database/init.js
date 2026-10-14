/*
 * Instalação inicial do banco: executa a estrutura e os dados de riff_store.sql.
 * As configurações são carregadas do .env antes de abrir a conexão.
 * Este comando recria tabelas; não deve ser usado para apenas iniciar o MySQL.
 */
/*
 * Cria o banco de dados da Riff Store e carrega os dados iniciais, executando
 * o mesmo SQL de database/riff_store.sql, também importável pelo phpMyAdmin.
 * Uso: npm run db:init   (ATENÇÃO: apaga e recria todas as tabelas)
 *
 * No XAMPP também dá para importar database/riff_store.sql pelo phpMyAdmin.
 */
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const databaseErrorMessage = require('../src/banco/erros');

const DB_NAME = process.env.DB_NAME || 'riff_store';

async function main() {
  // Identificadores de banco não são valores de uma consulta parametrizada; aceitamos só letras, números e _.
  if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) throw new Error('DB_NAME inválido');

  // Usa o arquivo SQL incluído no projeto; apenas o nome do banco vem do .env.
  const sql = fs.readFileSync(path.join(__dirname, 'riff_store.sql'), 'utf8')
    .replace(/(CREATE DATABASE IF NOT EXISTS|USE) riff_store\b/g,
      (_, comando) => `${comando} \`${DB_NAME}\``);

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
  let total;
  try {
    await conn.query(sql);
    [[{ total }]] = await conn.query(`SELECT COUNT(*) AS total FROM \`${DB_NAME}\`.produtos`);
  } finally {
    // Fecha a conexão mesmo se houver erro durante a importação.
    await conn.end();
  }

  console.log(`> Pronto! ${total} produtos cadastrados.`);
  console.log('  Administrador: admin@riffstore.com / admin123');
  console.log('  Cliente:       cliente@riffstore.com / cliente123');
}

main().catch(err => {
  console.error('Erro ao criar o banco:', databaseErrorMessage(err) || err.message || err.code || err);
  process.exit(1);
});
