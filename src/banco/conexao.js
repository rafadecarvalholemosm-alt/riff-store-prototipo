/*
 * A API compartilha um pool: conexões podem ser reutilizadas entre requisições.
 * As credenciais vêm do .env, enquanto os parâmetros das consultas ficam nas rotas.
 * Uma transação de pedido usa uma conexão exclusiva obtida desse pool.
 */
// Conexão compartilhada pelas rotas e pela atualização do banco (mysql2/promise).
// Todas as consultas usam parâmetros (?) para evitar injeção de SQL.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'riff_store',
  connectTimeout: 5000,
  // Quando as dez conexões estão ocupadas, as próximas consultas aguardam uma conexão livre.
  waitForConnections: true,
  connectionLimit: 10,
  // Converte DECIMAL do MySQL em Number para os cálculos monetários da aplicação.
  decimalNumbers: true,
  dateStrings: false,
  charset: 'utf8mb4'
});

module.exports = pool;
