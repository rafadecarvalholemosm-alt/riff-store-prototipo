/*
 * Entrada da aplicação Node.js. A ordem dos middlewares define o fluxo:
 * JSON e sessão → rotas da API → arquivos públicos → tratamento de erros.
 * O servidor só aceita requisições depois de conectar e atualizar o MySQL.
 */
/*
 * Riff Store: Merch & Vinis de Rock
 * Servidor Express: entrega as páginas (pasta public) e a API REST (/api).
 * Para o site usar esta API e o MySQL, defina usarServidor: true em public/js/config.js.
 */
require('dotenv').config({ quiet: true });
const path = require('path');
const express = require('express');
const session = require('express-session');
const db = require('./src/db');
const databaseErrorMessage = require('./src/db-errors');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
// Converte o corpo JSON em req.body e limita o tamanho aceito da requisição.
app.use(express.json({ limit: '100kb' }));

// Sessão guardada no servidor; o navegador recebe só um cookie assinado e HttpOnly
app.use(session({
  name: 'riff.sid',
  secret: process.env.SESSION_SECRET || 'riff-store-dev',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}));

// API --------------------------------------------------------------
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/pedidos', require('./src/routes/pedidos'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api', require('./src/routes/produtos'));
app.use('/api', require('./src/routes/site'));

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// Páginas -----------------------------------------------------------
// Caminhos sem /api são atendidos pelos HTML, CSS, JavaScript e imagens de public/.
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

// Tratamento de erros: orienta sobre o banco ou devolve uma mensagem genérica.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Dados inválidos.' });
  const databaseError = databaseErrorMessage(err);
  console.error(databaseError || err);
  if (res.headersSent) return next(err);
  if (databaseError) return res.status(503).json({ erro: databaseError });
  res.status(500).json({ erro: 'Ocorreu um erro no servidor. Tente novamente.' });
});

// async/await mantém a inicialização em ordem: banco pronto antes de abrir a porta HTTP.
async function start() {
  try {
    // Só disponibiliza a API depois de conectar e atualizar o banco existente.
    await db.query('SELECT 1');
    await require('./src/atualizar-banco')();
    app.listen(PORT, () => {
      console.log(`Riff Store rodando em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Não foi possível iniciar a Riff Store:', databaseErrorMessage(err) || err.message || err.code || err);
    await db.end();
    process.exitCode = 1;
  }
}

start();
