/*
 * Configuração da origem dos dados, lida pelo módulo comum app.js.
 * O modo auto detecta a API Express; true força o servidor e false força a demonstração.
 * A escolha permite reutilizar as mesmas páginas nos dois modos.
 */
/*
 * Configuração do site.
 * usarServidor: 'auto' -> detecta sozinho (padrão):
 *                         - aberto pelo servidor Node (npm start, http://localhost:3000):
 *                           usa a API do Express e o banco MySQL;
 *                         - aberto sem servidor (Live Server, GitHub Pages, arquivo):
 *                           usa dados de exemplo guardados no navegador.
 * usarServidor: true   -> sempre usa o servidor Node/MySQL.
 * usarServidor: false  -> sempre usa os dados no navegador.
 */
window.RS_CONFIG = {
  usarServidor: 'auto'
};
