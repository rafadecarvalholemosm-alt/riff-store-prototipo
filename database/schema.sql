-- Modelo relacional: IDs identificam registros, e chaves estrangeiras preservam relacionamentos.
-- Produtos pertencem a categorias; pedidos pertencem a usuários e contêm itens de produtos.
-- DECIMAL representa valores monetários, e CHECK restringe preços, estoque, quantidade e notas.
-- Os DROP TABLE abaixo fazem parte da instalação/restauração e apagam tabelas existentes.
-- =============================================================
-- Riff Store: Merch & Vinis de Rock
-- Modelo do banco de dados (MySQL 8+ / MariaDB 10.5+)
-- =============================================================

CREATE DATABASE IF NOT EXISTS riff_store
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE riff_store;

DROP TABLE IF EXISTS itens_pedido;
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS avaliacoes;
DROP TABLE IF EXISTS produtos;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS mensagens;
DROP TABLE IF EXISTS newsletter;
DROP TABLE IF EXISTS configuracoes;
DROP TABLE IF EXISTS usuarios;

-- Usuários: clientes e administradores ------------------------
CREATE TABLE usuarios (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  nome              VARCHAR(120) NOT NULL,
  email             VARCHAR(160) NOT NULL UNIQUE,
  senha_hash        VARCHAR(100) NOT NULL,
  telefone          VARCHAR(20)  NULL,
  perfil            ENUM('cliente', 'admin') NOT NULL DEFAULT 'cliente',
  bloqueado         TINYINT(1)   NOT NULL DEFAULT 0,
  token_recuperacao VARCHAR(64)  NULL,
  token_expira      DATETIME     NULL,
  criado_em         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Categorias da vitrine ----------------------------------------
CREATE TABLE categorias (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nome   VARCHAR(60) NOT NULL,
  slug   VARCHAR(60) NOT NULL UNIQUE,
  icone  VARCHAR(40) NULL,
  ordem  INT NOT NULL DEFAULT 0
);

-- Produtos -----------------------------------------------------
-- Os selos são calculados a partir destes dados:
--   "Novo"     -> criado_em nos últimos 30 dias
--   "Promoção" -> preco_promocional preenchido e promocao_fim no futuro
--   "Esgotado" -> estoque = 0
CREATE TABLE produtos (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  categoria_id      INT NOT NULL,
  nome              VARCHAR(140) NOT NULL,
  slug              VARCHAR(160) NOT NULL UNIQUE,
  banda             VARCHAR(80)  NOT NULL,
  descricao         TEXT NOT NULL,
  detalhes          TEXT NULL,            -- material, edição, medidas...
  faixas            TEXT NULL,            -- discos: uma faixa por linha
  ano               SMALLINT NULL,
  preco             DECIMAL(10,2) NOT NULL,
  preco_promocional DECIMAL(10,2) NULL,
  promocao_fim      DATETIME NULL,
  estoque           INT NOT NULL DEFAULT 0,
  tem_tamanhos      TINYINT(1) NOT NULL DEFAULT 0,
  imagem            VARCHAR(255) NOT NULL,
  galeria           TEXT NULL,            -- caminhos extras separados por vírgula
  audio_preview     VARCHAR(255) NULL,
  destaque          TINYINT(1) NOT NULL DEFAULT 0,
  ativo             TINYINT(1) NOT NULL DEFAULT 1,
  criado_em         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_produto_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id),
  CONSTRAINT ck_preco CHECK (preco > 0),
  CONSTRAINT ck_estoque CHECK (estoque >= 0)
);

CREATE INDEX idx_produtos_banda ON produtos (banda);
CREATE INDEX idx_produtos_categoria ON produtos (categoria_id);

-- Pedidos ------------------------------------------------------
CREATE TABLE pedidos (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id       INT NOT NULL,
  nome_cliente     VARCHAR(120) NOT NULL,
  email            VARCHAR(160) NOT NULL,
  telefone         VARCHAR(20)  NOT NULL,
  cep              CHAR(9)      NOT NULL,
  endereco         VARCHAR(160) NOT NULL,
  numero           VARCHAR(10)  NOT NULL,
  complemento      VARCHAR(80)  NULL,
  bairro           VARCHAR(80)  NOT NULL,
  cidade           VARCHAR(80)  NOT NULL,
  uf               CHAR(2)      NOT NULL,
  forma_pagamento  ENUM('pix', 'cartao', 'boleto') NOT NULL,
  subtotal         DECIMAL(10,2) NOT NULL,
  frete            DECIMAL(10,2) NOT NULL,
  cupom            VARCHAR(20)  NULL,
  desconto         DECIMAL(10,2) NOT NULL DEFAULT 0,
  total            DECIMAL(10,2) NOT NULL,
  status           ENUM('recebido', 'em_separacao', 'enviado', 'entregue') NOT NULL DEFAULT 'recebido',
  criado_em        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pedido_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Itens do pedido: guarda o preço no momento da compra ----------
-- Cada item preserva o nome e o preço da compra, mesmo se o catálogo for editado depois.
CREATE TABLE itens_pedido (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id       INT NOT NULL,
  produto_id      INT NOT NULL,
  nome_produto    VARCHAR(140) NOT NULL,
  tamanho         VARCHAR(4) NULL,
  quantidade      INT NOT NULL,
  preco_unitario  DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_item_pedido  FOREIGN KEY (pedido_id)  REFERENCES pedidos(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_produto FOREIGN KEY (produto_id) REFERENCES produtos(id),
  CONSTRAINT ck_quantidade CHECK (quantidade > 0)
);

-- Avaliações (apenas de quem comprou o produto) ------------------
CREATE TABLE avaliacoes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  produto_id  INT NOT NULL,
  usuario_id  INT NOT NULL,
  nota        TINYINT NOT NULL,
  comentario  TEXT NOT NULL,
  visivel     TINYINT(1) NOT NULL DEFAULT 1,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_avaliacao_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
  CONSTRAINT fk_avaliacao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT uq_avaliacao UNIQUE (produto_id, usuario_id),
  CONSTRAINT ck_nota CHECK (nota BETWEEN 1 AND 5)
);

-- Mensagens do formulário de contato ---------------------------
CREATE TABLE mensagens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  nome       VARCHAR(120) NOT NULL,
  email      VARCHAR(160) NOT NULL,
  assunto    VARCHAR(40)  NOT NULL,
  mensagem   TEXT NOT NULL,
  lida       TINYINT(1) NOT NULL DEFAULT 0,
  criado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- E-mails inscritos na newsletter (liberam o cupom ROCK10) -----
CREATE TABLE newsletter (
  email      VARCHAR(160) PRIMARY KEY,
  criado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Configurações da loja (contato e redes sociais) --------------
-- Pares chave/valor permitem editar contatos e redes sociais pelo painel administrativo.
CREATE TABLE configuracoes (
  chave  VARCHAR(40) PRIMARY KEY,
  valor  VARCHAR(255) NOT NULL
);
