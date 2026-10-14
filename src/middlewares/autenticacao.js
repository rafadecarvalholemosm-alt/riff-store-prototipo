/* Controle de acesso compartilhado pelas rotas do servidor.
 * Middleware é uma função executada antes da ação da rota.
 * A sessão identifica o usuário; 401 indica ausência de login e 403 falta de permissão.
 * next() permite continuar somente depois da verificação exigida.
 */
// Middlewares de controle de acesso baseados na sessão.

// Exige um usuário logado (cliente ou administrador).
function exigirLogin(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Faça login para continuar.' });
  }
  next();
}

// Exige um usuário com perfil de administrador.
function exigirAdmin(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Faça login para continuar.' });
  }
  if (req.session.usuario.perfil !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
  }
  next();
}

module.exports = { exigirLogin, exigirAdmin };
