# Riff Store: Merch & Vinis de Rock

Loja virtual **fictícia** de produtos ligados ao rock (camisetas de bandas, discos de vinil, CDs, pôsteres e acessórios), desenvolvida como Trabalho Final da disciplina **Programação para Web I** (FACOM/UFU, campus Monte Carmelo, 2026/2, Prof. Adriano Mendonça Rocha).

**Grupo:** Gabriel Fernandes, Rafael Lemos e Nicolas Bernardes.

> Projeto acadêmico: nenhum pagamento é processado e nenhum produto é vendido. Os nomes de bandas aparecem só como exemplos de catálogo; as fotos dos produtos são montagens das capas reais dos álbuns (Wikipedia) sobre fotos livres do Wikimedia Commons, as demais fotos são do Unsplash e as prévias de áudio foram criadas pelo grupo (por código).

O catálogo inicial contém **31 produtos**. O projeto oferece vitrine, carrinho, cadastro, login, pedidos, avaliações e painel administrativo, com duas formas de execução: **Node.js + MySQL**, para persistir os dados no banco, e **demonstração estática**, com os dados armazenados no navegador.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Front-end | HTML5 semântico, CSS3 (variáveis CSS), JavaScript, jQuery 4, Bootstrap 5, Bootstrap Icons |
| Back-end | Node.js, Express 5, express-session, bcryptjs |
| Banco de dados | MySQL 8 ou MariaDB 10.4+ (XAMPP), via `mysql2` com consultas parametrizadas |

## Como rodar com Node.js e MySQL

### Requisitos

- **Node.js 20.9 ou superior**, com npm. Essa versão mínima atende ao `sharp`, usado na geração das imagens e instalado junto às demais dependências.
- **MySQL 8 ou MariaDB 10.4+**. No Windows, o XAMPP oferece MariaDB e phpMyAdmin.

Clone o repositório ou extraia o ZIP do projeto. Execute os comandos abaixo no **PowerShell**, na pasta que contém o `package.json`.

### 1. Instalar as dependências

```powershell
npm install
```

As imagens, fontes, bibliotecas do front-end e prévias de áudio já estão versionadas. O download das imagens é opcional para quem deseja regenerá-las.

### 2. Configurar o ambiente

Crie o `.env` a partir de [.env.example](.env.example), preservando o arquivo caso ele já exista:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

| Variável | Valor de exemplo | Finalidade |
| --- | --- | --- |
| `PORT` | `3000` | Porta do servidor Express |
| `DB_HOST` | `127.0.0.1` | Endereço do MySQL |
| `DB_PORT` | `3306` | Porta do MySQL |
| `DB_USER` | `root` | Usuário do banco; padrão do XAMPP |
| `DB_PASSWORD` | Vazio | Senha do banco; ajuste conforme sua instalação |
| `DB_NAME` | `riff_store` | Nome do banco utilizado pela aplicação |
| `SESSION_SECRET` | Substitua o texto de exemplo | Segredo para assinar o cookie de sessão |

Para gerar um segredo de sessão, execute o comando abaixo e copie o resultado para `SESSION_SECRET` no `.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

O `.env` fica fora do Git pelo `.gitignore`; a configuração compartilhada está no `.env.example`.

### 3. Iniciar o MySQL

Abra o painel do XAMPP e clique em **Start** na linha do **MySQL**. Inicie também o **Apache** se quiser acessar o phpMyAdmin.

`npm install`, `npm start` e `npm run dev` não iniciam o serviço MySQL. Ele precisa estar ativo antes de executar a aplicação.

### 4. Criar o banco na primeira execução

Se o banco ainda não foi criado, carregue as tabelas e os dados de demonstração:

```powershell
npm run db:init
```

> **Atenção:** esse comando apaga e recria as tabelas do banco configurado em `DB_NAME`. Use-o para a instalação inicial ou para restaurar os dados de exemplo. Preserve um banco existente ao corrigir problemas de conexão.

Como alternativa, acesse [phpMyAdmin](http://localhost/phpmyadmin), abra **Importar**, selecione [database/riff_store.sql](database/riff_store.sql) e clique em **Executar**. Esse arquivo cria o banco `riff_store` e também substitui as tabelas existentes.

### 5. Iniciar o site

Durante o desenvolvimento, use o modo que reinicia o servidor ao alterar o código:

```powershell
npm run dev
```

Para executar sem observar alterações nos arquivos, use `npm start`.

Acesse **[http://localhost:3000](http://localhost:3000)**. Caso altere `PORT` no `.env`, use a porta configurada.

O servidor verifica a conexão e conclui as atualizações de compatibilidade do banco antes de anunciar que o site está rodando. Essas atualizações acrescentam a tabela da newsletter, as colunas de cupom/desconto e substituem imagens antigas em SVG, conforme necessário, sem recriar o catálogo.

Nesse modo, cadastros, pedidos, estoque, avaliações, mensagens, newsletter e alterações administrativas ficam no **MySQL**. O carrinho permanece no `localStorage` do navegador.

### Problemas comuns

| Mensagem ou situação | Como resolver |
| --- | --- |
| `ECONNREFUSED` ou falha de conexão na porta 3306 | Inicie o MySQL no XAMPP e confira `DB_HOST` e `DB_PORT` no `.env`. |
| Acesso ao MySQL negado | Confira `DB_USER` e `DB_PASSWORD`. No XAMPP padrão, o usuário é `root` e a senha fica vazia. |
| O banco não existe | Confira `DB_NAME`. Se for uma instalação nova, execute `npm run db:init` com o MySQL ativo. |
| Faltam tabelas no banco | Confira se a aplicação aponta para o banco correto e se a importação foi concluída. Faça backup dos dados antes de reinicializar um banco existente. |
| `EADDRINUSE` na porta 3000 | Encerre a outra instância do servidor ou altere `PORT` no `.env`. |
| O modo watch continua aguardando após uma falha de inicialização | Corrija a configuração ou inicie o MySQL, pressione `Ctrl+C` e execute `npm run dev` novamente. |

Se o banco ficar indisponível durante uma requisição, a API responde com **HTTP 503** para os erros de conexão/configuração tratados e informa o que conferir.

### Contas de demonstração

As contas abaixo fazem parte dos dados iniciais, tanto no MySQL quanto no modo estático:

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@riffstore.com` | `admin123` |
| Cliente (com pedidos) | `cliente@riffstore.com` | `cliente123` |

## Demonstração sem Node.js e MySQL

Abra [public/index.html](public/index.html) pelo **Live Server** do VS Code ou sirva a pasta `public/` com um servidor estático. Uma opção, se tiver Node.js instalado, é:

```powershell
npx serve public
```

Acesse o endereço informado no terminal. A API de demonstração em [public/js/api-local.js](public/js/api-local.js) atende às operações no próprio navegador, e os dados ficam no **localStorage**. Cada navegador e endereço de acesso mantém seus próprios dados; eles não são sincronizados com o MySQL.

### Seleção do modo de funcionamento

O arquivo [public/js/config.js](public/js/config.js) controla a origem dos dados:

| `usarServidor` | Comportamento |
| --- | --- |
| `'auto'` — padrão | Consulta `/api/configuracoes`; usa a API Express quando ela responde e os dados locais quando a detecção falha. |
| `true` | Usa a API Express e o MySQL. |
| `false` | Usa a API de demonstração no navegador. |

Para restaurar os dados do **modo estático**, entre como administrador e abra **Configurações → Restaurar dados de demonstração**. Essa ação substitui os dados locais desse navegador. No modo MySQL, a restauração é feita pela importação do SQL ou por `npm run db:init`.

### GitHub Pages

O workflow [pages.yml](.github/workflows/pages.yml) está preparado para publicar a pasta `public/` em pushes na `main` ou por execução manual. Para habilitar, acesse **Settings → Pages → Source: GitHub Actions**.

O GitHub Pages hospeda a **demonstração estática**; o servidor Express e o MySQL precisam de uma hospedagem própria para funcionar online. A disponibilidade do Pages em repositórios privados depende do plano da conta, conforme a [documentação do GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Comandos disponíveis

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Inicia o Express com reinicialização automática ao alterar o código. |
| `npm start` | Inicia o Express sem observar alterações. |
| `npm run db:init` | Apaga e recria as tabelas do banco configurado, carregando os dados iniciais. |
| `npm run sql` | Regenera `database/riff_store.sql`; não altera o banco em execução. |
| `npm run dados` | Regenera os dados do modo estático e o arquivo SQL a partir do catálogo e dos dados de exemplo. |
| `npm run fotos` | Baixa as imagens ausentes e refaz as montagens dos produtos; requer internet. |
| `npm run audios` | Regenera as prévias em `public/audio/`. |

Edite [database/catalogo.js](database/catalogo.js) para alterar o catálogo de origem e [database/seed.js](database/seed.js) para alterar os dados de demonstração. Depois, execute `npm run dados`. Isso atualiza os arquivos gerados; os registros de um banco MySQL já existente continuam sendo administrados pelo painel ou por alterações no próprio banco.

## Imagens

As imagens utilizadas pelo site estão versionadas em `public/img/`. Para regenerá-las, execute `npm run fotos`; para baixar novamente todas as fontes das imagens, use `npm run fotos -- --tudo`. O processo utiliza a pasta `.cache/` como apoio e grava as fotos em `public/img/fotos/` e os logos de bandas em `public/img/bandas/`.

| Imagem | Origem |
| --- | --- |
| Fundos, banners, categorias e galeria | Fotos do [Unsplash](https://unsplash.com) (lista em `public/js/fotos.js`) |
| Camisetas, vinis, CDs, pôsteres e patch | Capa real do álbum (Wikipedia) aplicada por `scripts/montagens.js` sobre fotos reais do [Wikimedia Commons](https://commons.wikimedia.org) (camiseta, disco, caixa de CD, parede e jeans) |
| Palhetas, boné, caneca, cinto e toca-discos | Fotos do Unsplash |
| Logos das bandas (faixa rolante da home) | Wikipedia/Wikimedia Commons, convertidos para branco em `public/img/bandas/` |
| Bandeiras de pagamento e transportadora (Visa, Mastercard, Elo, Amex, Hipercard, Diners, Pix e Correios) | Logos oficiais do Wikimedia Commons, em `public/img/pagamentos/` e `public/img/envio/` |

As montagens usam o pacote `sharp` (instalado com `npm install`). Os créditos e licenças de cada foto ficam em `public/img/fotos/CREDITOS.txt`.

## Páginas

| Página | Arquivo | Acesso |
| --- | --- | --- |
| Início (carrossel, categorias, destaques, ofertas com contagem regressiva, lançamentos, vídeos) | `index.html` | Todos |
| Produtos (categorias, filtros por preço, banda e estoque, ordenação e paginação via AJAX) | `produtos.html` | Todos |
| Detalhes do produto (galeria com zoom, tamanhos, quantidade, faixas, prévia de áudio, avaliações) | `produto.html?slug=...` | Todos |
| Carrinho (localStorage, totais, frete e cupom ROCK10 calculados na hora) | `carrinho.html` | Todos |
| Finalizar pedido (identificação, endereço, pagamento simulado, revisão) | `checkout.html` | Cliente |
| Login / Cadastro (abas) | `login.html` | Todos |
| Recuperação de senha (link simulado, válido por 1 hora) | `recuperar-senha.html` | Todos |
| Minha conta (histórico de pedidos com status e edição de dados) | `conta.html` | Cliente |
| Sobre | `sobre.html` | Todos |
| Contato / FAQ | `contato.html` | Todos |
| Painel administrativo (dashboard, produtos, pedidos, usuários, avaliações, mensagens, configurações) | `admin.html` | Administrador |

Os links **Bandas** e **Promoções** do menu abrem a vitrine já filtrada (`produtos.html?bandas=...` e `produtos.html?promocao=1`).

## Funcionalidades implementadas

| ID | Funcionalidade | Situação |
| --- | --- | --- |
| F01 | Vitrine de produtos carregada do banco | ✅ |
| F02 | Busca e filtros (nome, categoria, banda, preço, estoque), ordenação e paginação sem recarregar | ✅ |
| F03 | Detalhes do produto (imagem ampliada, descrição, tamanho, quantidade, estoque) | ✅ |
| F04 | Carrinho mantido no localStorage | ✅ |
| F05 | Cadastro e login com senha criptografada (bcrypt) | ✅ |
| F06 | Finalização em etapas, validada no navegador e no servidor, com baixa no estoque | ✅ |
| F07 | Histórico de pedidos com status | ✅ |
| F08 | Selos "Novo", "Promoção" e "Esgotado" gerados a partir dos dados | ✅ |
| F09 | Avaliações (só para quem comprou o produto) | ✅ |
| F10 | Contagem regressiva; a oferta sai do ar ao expirar | ✅ |
| F11 | Formulário de contato salvo no banco | ✅ |
| F12 | Prévias de áudio com a tag `<audio>` | ✅ |
| F13 | Recuperação de senha | ✅ (e-mail simulado na tela) |
| Extra | Newsletter que libera o cupom ROCK10 (10% de desconto, conferido também no servidor) | ✅ |
| A01–A07 | Acesso restrito, gestão de produtos, pedidos, moderação, resumo, usuários e configurações | ✅ |

### Regras da demonstração

- **Frete:** R$ 19,90, com gratuidade a partir de R$ 299,00 em produtos, antes do desconto do cupom.
- **Cupom ROCK10:** 10% de desconto nos produtos, para e-mails inscritos na newsletter, com uso único por conta.
- **Tamanhos das camisetas:** P, M, G e GG.
- **Pagamentos:** Pix, cartão e boleto são opções simuladas; a aplicação não processa cobranças.
- **Recuperação de senha:** o link é exibido na tela e expira em uma hora; nenhum e-mail é enviado.

## Estrutura

```
├── public/                  # o site (abre sem servidor)
│   ├── *.html               # 12 páginas
│   ├── css/                 # style.css e fontes.css
│   ├── js/
│   │   ├── config.js        # usarServidor: 'auto', true ou false
│   │   ├── api-local.js     # API no navegador (localStorage)
│   │   ├── dados.js         # catálogo e dados de exemplo (gerado)
│   │   ├── fotos.js         # lista de fotos do Unsplash
│   │   ├── app.js           # cabeçalho, rodapé, carrinho e utilitários
│   │   └── <página>.js      # script de cada página
│   ├── img/                 # logotipo, ícones e fotos (img/fotos)
│   ├── audio/               # prévias das faixas
│   └── vendor/              # Bootstrap, Bootstrap Icons, jQuery e fontes
├── server.js                # servidor Express (páginas + API)
├── src/
│   ├── db.js                # pool de conexões MySQL
│   ├── db-errors.js         # mensagens para falhas de conexão/configuração
│   ├── atualizar-banco.js   # atualizações de compatibilidade sem recriar o catálogo
│   ├── cupons.js            # validação e cálculo de descontos
│   ├── middleware/         # controle de acesso
│   └── routes/             # autenticação, produtos, pedidos, administração e contato
├── database/                # schema.sql, riff_store.sql (importar no phpMyAdmin), catálogo e dados de exemplo
└── scripts/                 # download das fotos, montagens, geração do SQL, dos dados e dos áudios
```

## API (resumo)

| Método e rota | Descrição |
| --- | --- |
| `GET /api/categorias`, `GET /api/bandas` | Listas para menus e filtros |
| `GET /api/produtos` | Vitrine com `busca`, `categoria`, `bandas`, `precoMin`, `precoMax`, `estoque`, `promocao`, `ordem`, `pagina` |
| `GET /api/produtos/destaques`, `GET /api/produtos/ofertas` | Destaques e promoções ativas |
| `GET /api/produtos/:slug` | Detalhes, avaliações e relacionados |
| `POST /api/produtos/:id/avaliacoes` | Avaliar (cliente que comprou) |
| `POST /api/auth/cadastro`, `/login`, `/logout`, `/recuperar`, `/redefinir` · `GET /api/auth/me` · `PUT /api/auth/conta` | Autenticação e conta |
| `GET /api/pedidos`, `POST /api/pedidos` | Histórico e finalização do pedido |
| `GET /api/pedidos/frete` | Regra de frete utilizada no carrinho |
| `POST /api/mensagens`, `GET /api/configuracoes` | Contato e dados da loja |
| `POST /api/newsletter`, `POST /api/cupons/validar` | Inscrição na newsletter e cupom **ROCK10** (10% nos produtos, uma vez por conta, para e-mails inscritos) |
| `/api/admin/*` | Rotas do painel (somente administradores) |

## Segurança

As proteções abaixo se aplicam ao **modo Node.js + MySQL**:

- Senhas guardadas com hash **bcrypt**; o hash nunca sai do servidor.
- Valores recebidos nas consultas são enviados por **parâmetros** (`?`), para evitar injeção de SQL.
- Os dados são **validados também no servidor**; preços, estoque e desconto do cupom vêm sempre do banco, nunca do navegador.
- Pedido gravado numa **transação** com `SELECT ... FOR UPDATE`, para o estoque não ficar negativo.
- **Sessões** com cookie `HttpOnly` e `SameSite=Lax`; as rotas `/api/admin` respondem só ao perfil administrador.
- Textos vindos do banco são escapados antes de entrar no HTML (contra XSS).

No modo estático, contas, sessão e validações são controladas pelo navegador, com um hash de senha próprio da demonstração. Esse modo serve para apresentar e experimentar as funcionalidades; as restrições de acesso do servidor são aplicadas pela API Express no modo MySQL.

## Identidade visual

Paleta do protótipo: **preto** no cabeçalho, nos banners e no rodapé; **branco e cinza-claro** na área de conteúdo; **vermelho** (`#B01116`) nas ações principais e nos selos. Títulos em fonte condensada (Bebas Neue), texto em Inter e o logotipo em Pirata One com a "mão chifrada" do protótipo.

## Créditos

Bootstrap e Bootstrap Icons (MIT), jQuery (MIT), fontes Bebas Neue, Pirata One e Inter (SIL Open Font License, via Fontsource), fotos do Unsplash (Unsplash License), fotos de base do Wikimedia Commons (CC0, domínio público e CC BY-SA; ver `public/img/fotos/CREDITOS.txt`), logos de pagamento e dos Correios do Wikimedia Commons (domínio público; marcas de seus donos) e capas de álbuns da Wikipedia (uso acadêmico; direitos das gravadoras e artistas). Logotipo e prévias de áudio criados pelo grupo.
