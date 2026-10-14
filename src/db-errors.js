// Mensagens de configuração para erros do MySQL, inclusive AggregateError.
function databaseErrorMessage(error) {
  const codes = [error.code, ...(error.errors || []).map(item => item.code)];
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 3306;
  const database = process.env.DB_NAME || 'riff_store';

  if (codes.some(code => ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET', 'PROTOCOL_CONNECTION_LOST'].includes(code))) {
    return `Não foi possível conectar ao MySQL em ${host}:${port}. No painel do XAMPP, clique em Start na linha do MySQL e confira DB_HOST e DB_PORT no arquivo .env.`;
  }
  if (codes.includes('ER_ACCESS_DENIED_ERROR')) {
    return 'Acesso ao MySQL negado. Confira DB_USER e DB_PASSWORD no arquivo .env (padrão do XAMPP: root e senha vazia).';
  }
  if (codes.includes('ER_BAD_DB_ERROR')) {
    return `O banco "${database}" não existe. Confira DB_NAME no arquivo .env. Para criar um banco novo, execute npm run db:init com o MySQL iniciado.`;
  }
  if (codes.includes('ER_NO_SUCH_TABLE')) {
    return `Faltam tabelas no banco "${database}". Confira DB_NAME e a importação de database/riff_store.sql. Atenção: npm run db:init apaga e recria as tabelas existentes.`;
  }
  return null;
}

module.exports = databaseErrorMessage;
