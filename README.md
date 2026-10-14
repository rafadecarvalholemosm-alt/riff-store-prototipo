# Riff Store: Merch & Vinis de Rock

Loja virtual fictícia desenvolvida para **Programação para Web I** — FACOM/UFU, campus Monte Carmelo, **2026/2**, Prof. Adriano Mendonça Rocha.

**Integrantes:** Gabriel Fernandes, Rafael Lemos e Nicolas Bernardes.

**[Acessar a demonstração online](https://gabrielfmck.github.io/riff-store/)**

O projeto tem 31 produtos de exemplo e permite navegar pelo catálogo, usar filtros, montar um carrinho e simular uma compra. Inclui cadastro, login, avaliações, contato e painel administrativo. Pagamentos e envio de e-mail são simulados.

## Organização do projeto

```text
riff-store/
├── public/                       # Arquivos entregues ao navegador
│   ├── *.html                    # Páginas da loja
│   ├── css/                      # Estilos e declaração das fontes
│   ├── js/
│   │   ├── compartilhado/        # Código utilizado em várias páginas
│   │   │   ├── config.js         # Seleção entre API Express e demonstração
│   │   │   ├── app.js            # API, cabeçalho, rodapé, carrinho e utilitários
│   │   │   └── fotos.js          # Referências das fotos usadas na interface
│   │   ├── paginas/              # Um controlador para cada página interativa
│   │   └── demo/                 # Funcionamento sem servidor Express/MySQL
│   │       ├── dados.js          # Dados iniciais de demonstração
│   │       └── api-local.js      # Operações e persistência no localStorage
│   ├── img/                      # Fotos, logos, ícones e créditos das imagens
│   ├── audio/                    # Prévias de áudio prontas
│   └── vendor/                   # Bibliotecas e fontes locais, com suas licenças
├── src/                          # Código executado pelo servidor
│   ├── banco/                    # Conexão, mensagens de erro e compatibilidade
│   ├── rotas/                    # Autenticação, produtos, pedidos, admin e site
│   ├── middlewares/              # Controle de acesso às rotas
│   └── utils/                    # Validação, formatação de produtos e cupons
├── database/
│   ├── riff_store.sql            # Estrutura e dados iniciais do MySQL
│   └── init.js                   # Importa esse SQL pelo comando db:init
├── .github/workflows/pages.yml   # Publicação da pasta public/ no GitHub Pages
├── .env.example                  # Modelo das configurações do servidor
├── server.js                     # Entrada do Express: sessão, API e páginas
└── package.json                  # Comandos e dependências do servidor
```

As imagens, os áudios, as fontes e as bibliotecas do navegador já estão incluídos. A execução do projeto utiliza esses arquivos prontos, sem etapas de geração de mídia ou de dados.

## Por onde começar a ler o código

1. **Página e aparência:** [public/index.html](public/index.html) e [public/css/style.css](public/css/style.css) mostram o HTML e os estilos da loja.
2. **Interação da página:** [home.js](public/js/paginas/home.js) controla a página inicial. Os demais controladores estão em `public/js/paginas/`.
3. **Código compartilhado:** [app.js](public/js/compartilhado/app.js) monta o cabeçalho e o rodapé, mantém o carrinho e oferece `RS.api()` para solicitar dados.
4. **API e regras:** [server.js](server.js) registra as rotas de `src/rotas/`. Elas validam as solicitações e consultam o banco com [conexao.js](src/banco/conexao.js).
5. **Banco:** [riff_store.sql](database/riff_store.sql) apresenta as tabelas, os relacionamentos e os dados de exemplo.

No modo com servidor, o fluxo é **HTML → controlador da página → RS.api() → rota Express → MySQL → resposta JSON → atualização da página**. No modo estático, `RS.api()` chama [api-local.js](public/js/demo/api-local.js), que executa as operações no navegador.

## Tecnologias

| Área | Tecnologias |
| --- | --- |
| Interface | HTML5, CSS3, JavaScript, jQuery, Bootstrap e Bootstrap Icons |
| Servidor | Node.js, Express, express-session e bcryptjs |
| Banco | MySQL ou MariaDB, acessado pelo mysql2 |
| Configuração | dotenv, com variáveis no arquivo `.env` |

As bibliotecas da interface ficam em `public/vendor/`. O `npm install` instala as dependências do servidor.

## Executar com Node.js e MySQL

É necessário ter **Node.js 20 ou superior**, npm e **MySQL 8 ou MariaDB compatível**. No Windows, o MySQL/MariaDB pode ser iniciado pelo painel do XAMPP.

Na pasta que contém `package.json`, execute:

```powershell
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Configure o `.env` conforme sua instalação:

| Variável | Exemplo | Finalidade |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP da loja |
| `DB_HOST` | `127.0.0.1` | Endereço do MySQL |
| `DB_PORT` | `3306` | Porta do MySQL |
| `DB_USER` | `root` | Usuário do banco |
| `DB_PASSWORD` | Vazio no XAMPP padrão | Senha do banco |
| `DB_NAME` | `riff_store` | Nome do banco |
| `SESSION_SECRET` | Um texto longo e aleatório | Chave para assinar o cookie de sessão |

Para criar um segredo de sessão, copie o resultado deste comando para `SESSION_SECRET`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

O `.env` é uma configuração local e fica fora do Git. O `.env.example` é o modelo compartilhado.

Inicie o **MySQL** no XAMPP. Na primeira instalação, crie o banco:

```powershell
npm run db:init
```

**Atenção:** `db:init` apaga e recria as tabelas do banco indicado em `DB_NAME`. Use-o somente para instalar ou restaurar os dados de demonstração. Ele não é necessário para iniciar a loja em um banco já configurado.

O comando importa [database/riff_store.sql](database/riff_store.sql), ajustando o nome do banco conforme o `.env`. Também é possível importar esse arquivo pelo phpMyAdmin; nessa alternativa, o nome usado é `riff_store`.

Depois, inicie o site:

```powershell
npm run dev
```

Abra **[http://localhost:3000](http://localhost:3000)**. Para iniciar sem reinicialização automática, use `npm start`.

O servidor verifica a conexão antes de anunciar o endereço. [atualizar.js](src/banco/atualizar.js) mantém a compatibilidade com bancos de versões anteriores, acrescentando campos ausentes e atualizando imagens antigas sem recriar os registros. O arquivo `imagens-legadas.json` é usado apenas nessa atualização.

## Executar a demonstração estática

Abra [public/index.html](public/index.html) pelo **Live Server** do VS Code ou sirva a pasta `public/` com um servidor estático. A versão online no GitHub Pages usa esse mesmo modo.

[config.js](public/js/compartilhado/config.js) seleciona a origem dos dados:

| `usarServidor` | Comportamento |
| --- | --- |
| `'auto'` — padrão | Detecta a API Express; quando ela não está disponível, usa a demonstração local. |
| `true` | Usa a API Express e o MySQL. |
| `false` | Usa a API de demonstração no navegador. |

Nesse modo, dados, contas e sessão ficam no **localStorage**. Cada navegador e endereço mantém seus próprios dados. No modo Express, os registros ficam no **MySQL**; o carrinho utiliza o localStorage nos dois modos.

Para restaurar a demonstração estática, entre como administrador e abra **Configurações → Restaurar dados de demonstração**. Essa ação substitui os dados locais daquele navegador.

## Contas de demonstração

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@riffstore.com` | `admin123` |
| Cliente | `cliente@riffstore.com` | `cliente123` |

## Páginas e seus controladores

Os HTML ficam em `public/`; os controladores abaixo ficam em `public/js/paginas/`.

| Página | HTML | JavaScript específico |
| --- | --- | --- |
| Início | `index.html` | `home.js` |
| Catálogo | `produtos.html` | `produtos.js` |
| Detalhes do produto | `produto.html` | `produto.js` |
| Carrinho | `carrinho.html` | `carrinho.js` |
| Finalização do pedido | `checkout.html` | `checkout.js` |
| Login e cadastro | `login.html` | `login.js` |
| Minha conta | `conta.html` | `conta.js` |
| Contato e FAQ | `contato.html` | `contato.js` |
| Painel administrativo | `admin.html` | `admin.js` |
| Recuperação de senha | `recuperar-senha.html` | Código do formulário no próprio HTML |
| Sobre | `sobre.html` | Apenas código compartilhado |
| Página não encontrada | `404.html` | Apenas código compartilhado |

O menu de bandas e o link de promoções abrem o catálogo com filtros na URL. O checkout e a conta exigem login; o painel exige perfil de administrador.

## Alterar os dados de exemplo

- **Modo MySQL:** altere [database/riff_store.sql](database/riff_store.sql) para definir os dados de uma nova instalação. Para editar registros existentes, utilize o painel administrativo.
- **Modo estático:** altere [dados.js](public/js/demo/dados.js). Para carregar as alterações em um navegador que já possui dados, restaure a demonstração pelo painel.
- **Mídia:** adicione arquivos em `public/img/` ou `public/audio/` e ajuste os caminhos nos dados correspondentes.

O SQL e os dados da demonstração estática são arquivos independentes. Se alterar os exemplos dos dois modos, atualize ambos. Alterações no painel afetam apenas o modo e o ambiente em uso.

## Comandos

| Comando | Função |
| --- | --- |
| `npm run dev` | Inicia o Express e reinicia ao alterar o código. |
| `npm start` | Inicia o Express. |
| `npm run db:init` | Importa o SQL e recria as tabelas com os dados iniciais. |

## Regras e limitações

- Frete de **R$ 19,90**, gratuito a partir de **R$ 299,00** em produtos, antes do desconto.
- Cupom **ROCK10**: desconto de 10% nos produtos, para e-mails inscritos na newsletter, com uso único por conta.
- Camisetas nos tamanhos **P, M, G e GG**; compra limitada ao estoque disponível.
- Pix, cartão e boleto são opções simuladas; nenhuma cobrança é realizada.
- A recuperação de senha mostra um link válido por uma hora; nenhum e-mail é enviado.
- No servidor, senhas usam bcrypt, consultas são parametrizadas, pedidos utilizam transações e acesso administrativo é validado pela sessão.
- Na demonstração estática, as regras de conta e acesso são exemplos executados no navegador.

## Problemas comuns

| Problema | O que conferir |
| --- | --- |
| `ECONNREFUSED` na porta 3306 | Inicie o MySQL e confira `DB_HOST` e `DB_PORT`. |
| Acesso ao banco negado | Confira `DB_USER` e `DB_PASSWORD`. |
| Banco ou tabelas inexistentes | Confira `DB_NAME` e a instalação do SQL. Preserve os dados antes de reinicializar um banco existente. |
| `EADDRINUSE` na porta 3000 | Encerre a outra instância ou altere `PORT`. |
| Alterações não aparecem no modo estático | Recarregue a página. Se mudou os dados iniciais, restaure a demonstração pelo painel. |

## Publicação

O workflow [pages.yml](.github/workflows/pages.yml) publica a pasta `public/` quando há um push na `main`. No repositório, a origem do GitHub Pages deve estar configurada como **GitHub Actions**.

Essa publicação hospeda a demonstração estática. A versão com Express e MySQL utiliza um servidor próprio.

## Créditos

Bootstrap, Bootstrap Icons e jQuery (MIT); fontes Bebas Neue, Pirata One e Inter (SIL Open Font License); fotos do Unsplash; fotos de base e logos do Wikimedia Commons; capas de álbuns da Wikipedia. As fotos dos produtos incluem montagens dessas imagens. Os créditos específicos estão em [public/img/fotos/CREDITOS.txt](public/img/fotos/CREDITOS.txt) e as licenças das bibliotecas estão em `public/vendor/`.

Logotipo e prévias de áudio criados pelo grupo para a demonstração acadêmica. Marcas e capas pertencem aos seus respectivos titulares; o site não realiza vendas reais.
