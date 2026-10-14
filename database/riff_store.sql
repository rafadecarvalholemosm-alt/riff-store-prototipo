-- Modelo relacional: IDs identificam registros, e chaves estrangeiras preservam relacionamentos.
-- Produtos pertencem a categorias; pedidos pertencem a usuários e contêm itens de produtos.
-- DECIMAL representa valores monetários, e CHECK restringe preços, estoque, quantidade e notas.
-- Os DROP TABLE abaixo fazem parte da instalação/restauração e apagam tabelas existentes.
-- =============================================================
-- Riff Store: Merch & Vinis de Rock
-- Banco de dados completo (estrutura + dados iniciais)
--
-- Como importar no XAMPP:
--   1. Inicie o Apache e o MySQL no painel do XAMPP
--   2. Abra http://localhost/phpmyadmin
--   3. Aba "Importar" -> escolha este arquivo -> "Executar"
--   (o banco "riff_store" é criado automaticamente; reimportar apaga os dados)
--
-- Contas: admin@riffstore.com / admin123  ·  cliente@riffstore.com / cliente123
-- Arquivo de instalação: estrutura e dados iniciais usados por npm run db:init.
-- =============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

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

-- -------------------------------------------------------------
-- Dados iniciais
-- -------------------------------------------------------------

INSERT INTO categorias (id, nome, slug, icone, ordem) VALUES
  (1, 'Camisetas', 'camisetas', 'bi-shirt', 1),
  (2, 'Discos de Vinil', 'vinil', 'bi-vinyl', 2),
  (3, 'CDs', 'cds', 'bi-disc', 3),
  (4, 'Pôsteres', 'posteres', 'bi-image', 4),
  (5, 'Acessórios', 'acessorios', 'bi-bag', 5);

INSERT INTO produtos (id, categoria_id, nome, slug, banda, descricao, detalhes, faixas, ano, preco, preco_promocional, promocao_fim, estoque, tem_tamanhos, imagem, galeria, destaque, criado_em) VALUES
  (1, 1, 'Camiseta Nirvana – Bleach', 'camiseta-nirvana-bleach', 'Nirvana', 'Camiseta preta com a capa de Bleach (1989), o primeiro disco do Nirvana, estampada no peito. Malha macia, gola reforçada e caimento reto, para usar no show ou no dia a dia.', 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria', NULL, NULL, 89.90, NULL, NULL, 34, 1, 'img/fotos/produtos/camiseta-nirvana-bleach.jpg', 'img/fotos/capas/camiseta-nirvana-bleach.jpg,img/fotos/camisetas-arara.jpg', 1, TIMESTAMP(CURDATE() - INTERVAL 60 DAY, '14:00:00')),
  (2, 1, 'Camiseta Rolling Stones – Tattoo You', 'camiseta-rolling-stones-tattoo-you', 'Rolling Stones', 'Camiseta preta com a capa de Tattoo You (1981), o disco de "Start Me Up". Um clássico dos Stones para quem tem atitude de sobra.', 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria', NULL, NULL, 89.90, 69.90, NOW() + INTERVAL 222 HOUR, 21, 1, 'img/fotos/produtos/camiseta-rolling-stones-tattoo-you.jpg', 'img/fotos/capas/camiseta-rolling-stones-tattoo-you.jpg,img/fotos/camisetas-arara.jpg', 1, TIMESTAMP(CURDATE() - INTERVAL 67 DAY, '14:59:00')),
  (3, 1, 'Camiseta AC/DC – Highway to Hell', 'camiseta-acdc-highway-to-hell', 'AC/DC', 'Camiseta preta com a capa de Highway to Hell (1979), o último disco com Bon Scott nos vocais. Para quem gosta de som alto.', 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria', NULL, NULL, 89.90, NULL, NULL, 40, 1, 'img/fotos/produtos/camiseta-acdc-highway-to-hell.jpg', 'img/fotos/capas/camiseta-acdc-highway-to-hell.jpg,img/fotos/camisetas-arara.jpg', 1, TIMESTAMP(CURDATE() - INTERVAL 74 DAY, '14:58:00')),
  (4, 1, 'Camiseta Metallica – Master of Puppets', 'camiseta-metallica-master-of-puppets', 'Metallica', 'Camiseta preta com a capa de Master of Puppets (1986): o cemitério de cruzes e os fios de marionete do álbum mais cultuado do thrash metal.', 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria', NULL, NULL, 99.90, NULL, NULL, 18, 1, 'img/fotos/produtos/camiseta-metallica-master-of-puppets.jpg', 'img/fotos/capas/camiseta-metallica-master-of-puppets.jpg,img/fotos/camisetas-arara.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 6 DAY, '14:42:00')),
  (5, 1, 'Camiseta Iron Maiden – The Trooper', 'camiseta-iron-maiden-trooper', 'Iron Maiden', 'Camiseta preta com a arte de The Trooper (1983): o Eddie de casaca vermelha e bandeira em punho. Esgotada no momento, volte em breve!', 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria', NULL, NULL, 99.90, NULL, NULL, 0, 1, 'img/fotos/produtos/camiseta-iron-maiden-trooper.jpg', 'img/fotos/capas/camiseta-iron-maiden-trooper.jpg,img/fotos/camisetas-arara.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 88 DAY, '14:56:00')),
  (6, 1, 'Camiseta Ramones – Rocket to Russia', 'camiseta-ramones-rocket-to-russia', 'Ramones', 'Camiseta preta com a capa de Rocket to Russia (1977), o disco de "Sheena Is a Punk Rocker". Três acordes e muita atitude.', 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria', NULL, NULL, 79.90, 59.90, NOW() + INTERVAL 222 HOUR, 27, 1, 'img/fotos/produtos/camiseta-ramones-rocket-to-russia.jpg', 'img/fotos/capas/camiseta-ramones-rocket-to-russia.jpg,img/fotos/camisetas-arara.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 95 DAY, '14:55:00')),
  (7, 1, 'Camiseta Led Zeppelin – Led Zeppelin I', 'camiseta-led-zeppelin-i', 'Led Zeppelin', 'Camiseta preta com a capa do primeiro disco do Led Zeppelin (1969): o dirigível Hindenburg em chamas, em preto e branco.', 'Malha 100% algodão fio 30.1 penteado, cor off-white\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria', NULL, NULL, 89.90, NULL, NULL, 15, 1, 'img/fotos/produtos/camiseta-led-zeppelin-i.jpg', 'img/fotos/capas/camiseta-led-zeppelin-i.jpg,img/fotos/camisetas-arara.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 102 DAY, '14:54:00')),
  (8, 1, 'Camiseta Queen – News of the World', 'camiseta-queen-news-of-the-world', 'Queen', 'Camiseta preta com a capa de News of the World (1977), o disco de "We Will Rock You" e "We Are the Champions", com o robô gigante de Frank Kelly Freas.', 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria', NULL, NULL, 89.90, NULL, NULL, 22, 1, 'img/fotos/produtos/camiseta-queen-news-of-the-world.jpg', 'img/fotos/capas/camiseta-queen-news-of-the-world.jpg,img/fotos/camisetas-arara.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 10 DAY, '14:50:00')),
  (9, 1, 'Camiseta Legião Urbana – Que País É Este', 'camiseta-legiao-urbana-que-pais-e-este', 'Legião Urbana', 'Homenagem ao rock de Brasília: camiseta preta com a capa de Que País É Este (1987), o terceiro disco da Legião Urbana.', 'Malha 100% algodão fio 30.1 penteado, cor chumbo\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria', NULL, NULL, 79.90, NULL, NULL, 30, 1, 'img/fotos/produtos/camiseta-legiao-urbana-que-pais-e-este.jpg', 'img/fotos/capas/camiseta-legiao-urbana-que-pais-e-este.jpg,img/fotos/camisetas-arara.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 116 DAY, '14:52:00')),
  (10, 1, 'Camiseta Sepultura – Roots', 'camiseta-sepultura-roots', 'Sepultura', 'O metal brasileiro mais conhecido do mundo: camiseta preta com a capa de Roots (1996), o disco que misturou thrash metal e percussão brasileira.', 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria', NULL, NULL, 94.90, NULL, NULL, 12, 1, 'img/fotos/produtos/camiseta-sepultura-roots.jpg', 'img/fotos/capas/camiseta-sepultura-roots.jpg,img/fotos/camisetas-arara.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 12 DAY, '14:24:00')),
  (11, 2, 'Disco de Vinil Pink Floyd – The Dark Side of the Moon', 'vinil-pink-floyd-dark-side', 'Pink Floyd', 'Um dos álbuns mais vendidos da história, em LP de 180 gramas. Prensagem remasterizada, capa gatefold e encarte com pôsteres.', 'LP 180 g, 33 1/3 RPM\nCapa gatefold com encarte\nRemasterizado\nLançamento original: 1973', 'Speak to Me\nBreathe\nOn the Run\nTime\nThe Great Gig in the Sky\nMoney\nUs and Them\nAny Colour You Like\nBrain Damage\nEclipse', 1973, 189.90, NULL, NULL, 9, 0, 'img/fotos/produtos/vinil-pink-floyd-dark-side.jpg', 'img/fotos/capas/vinil-pink-floyd-dark-side.jpg,img/fotos/toca-discos-agulha.jpg', 1, TIMESTAMP(CURDATE() - INTERVAL 130 DAY, '14:50:00')),
  (12, 2, 'Disco de Vinil Nirvana – MTV Unplugged in New York', 'vinil-nirvana-unplugged', 'Nirvana', 'O lendário acústico gravado em 1993 para a MTV, com "About a Girl", "The Man Who Sold the World" e "Where Did You Sleep Last Night". LP de 180 gramas.', 'LP 180 g, 33 1/3 RPM\nCapa com acabamento fosco\nLançamento original: 1994', 'About a Girl\nCome as You Are\nJesus Doesn\'t Want Me for a Sunbeam\nThe Man Who Sold the World\nPennyroyal Tea\nDumb\nPolly\nOn a Plain\nSomething in the Way\nPlateau\nOh Me\nLake of Fire\nAll Apologies\nWhere Did You Sleep Last Night', 1994, 179.90, 149.90, NOW() + INTERVAL 150 HOUR, 6, 0, 'img/fotos/produtos/vinil-nirvana-unplugged.jpg', 'img/fotos/capas/vinil-nirvana-unplugged.jpg,img/fotos/toca-discos-agulha.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 137 DAY, '14:49:00')),
  (13, 2, 'Disco de Vinil AC/DC – Back in Black', 'vinil-acdc-back-in-black', 'AC/DC', 'Capa toda preta, riffs inesquecíveis e um dos álbuns de rock mais vendidos de todos os tempos. Edição remasterizada.', 'LP 180 g, 33 1/3 RPM\nRemasterizado\nLançamento original: 1980', 'Hells Bells\nShoot to Thrill\nWhat Do You Do for Money Honey\nGivin the Dog a Bone\nLet Me Put My Love into You\nBack in Black\nYou Shook Me All Night Long\nHave a Drink on Me\nShake a Leg\nRock and Roll Ain\'t Noise Pollution', 1980, 169.90, NULL, NULL, 11, 0, 'img/fotos/produtos/vinil-acdc-back-in-black.jpg', 'img/fotos/capas/vinil-acdc-back-in-black.jpg,img/fotos/toca-discos-agulha.jpg', 1, TIMESTAMP(CURDATE() - INTERVAL 144 DAY, '14:48:00')),
  (14, 2, 'Disco de Vinil Led Zeppelin – IV', 'vinil-led-zeppelin-iv', 'Led Zeppelin', 'O quarto álbum, sem título na capa, guarda "Stairway to Heaven" e "Black Dog". Prensagem remasterizada em 180 gramas.', 'LP 180 g, 33 1/3 RPM\nCapa sanduíche com encarte\nLançamento original: 1971', 'Black Dog\nRock and Roll\nThe Battle of Evermore\nStairway to Heaven\nMisty Mountain Hop\nFour Sticks\nGoing to California\nWhen the Levee Breaks', 1971, 189.90, NULL, NULL, 7, 0, 'img/fotos/produtos/vinil-led-zeppelin-iv.jpg', 'img/fotos/capas/vinil-led-zeppelin-iv.jpg,img/fotos/toca-discos-agulha.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 151 DAY, '14:47:00')),
  (15, 2, 'Disco de Vinil Metallica – Metallica (Black Album)', 'vinil-metallica-black-album', 'Metallica', 'Edição dupla remasterizada do álbum que levou o metal às rádios do mundo inteiro, com "Enter Sandman" e "Nothing Else Matters".', 'LP duplo 180 g, 45 RPM\nCapa gatefold\nRemasterizado\nLançamento original: 1991', 'Enter Sandman\nSad but True\nHoly Wars... The Punishment Due\nThe Unforgiven\nWherever I May Roam\nDon\'t Tread on Me\nThrough the Never\nNothing Else Matters\nOf Wolf and Man\nThe God That Failed\nMy Friend of Misery\nThe Struggle Within', 1991, 249.90, NULL, NULL, 4, 0, 'img/fotos/produtos/vinil-metallica-black-album.jpg', 'img/fotos/capas/vinil-metallica-black-album.jpg,img/fotos/toca-discos-agulha.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '14:59:00')),
  (16, 2, 'Disco de Vinil Queen – A Night at the Opera', 'vinil-queen-night-opera', 'Queen', 'O álbum de "Bohemian Rhapsody", com a capa branca e o brasão da banda. Uma obra-prima do rock teatral.', 'LP 180 g, 33 1/3 RPM\nEncarte com letras\nLançamento original: 1975', 'Death on Two Legs\nLazing on a Sunday Afternoon\nI\'m in Love with My Car\nYou\'re My Best Friend\n\'39\nSweet Lady\nSeaside Rendezvous\nThe Prophet\'s Song\nLove of My Life\nGood Company\nBohemian Rhapsody\nGod Save the Queen', 1975, 179.90, 139.90, NOW() + INTERVAL 294 HOUR, 8, 0, 'img/fotos/produtos/vinil-queen-night-opera.jpg', 'img/fotos/capas/vinil-queen-night-opera.jpg,img/fotos/toca-discos-agulha.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 165 DAY, '14:45:00')),
  (17, 2, 'Disco de Vinil Secos & Molhados – 1973', 'vinil-secos-molhados', 'Secos & Molhados', 'Estreia histórica do rock brasileiro, com "Sangue Latino" e "O Vira". Reedição em vinil com encarte e fotos raras.', 'LP 180 g, 33 1/3 RPM\nEncarte com fotos\nLançamento original: 1973', 'Sangue Latino\nO Vira\nO Patrão Nosso de Cada Dia\nAmor\nPrimavera nos Dentes\nAssim Assado\nMulher Barriguda\nEl Rey\nRosa de Hiroshima\nPrece Cósmica\nRondó do Capitão\nAs Andorinhas\nFala', 1973, 159.90, NULL, NULL, 5, 0, 'img/fotos/produtos/vinil-secos-molhados.jpg', 'img/fotos/capas/vinil-secos-molhados.jpg,img/fotos/toca-discos-agulha.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 9 DAY, '14:33:00')),
  (18, 3, 'CD Iron Maiden – The Number of the Beast', 'cd-iron-maiden-number-beast', 'Iron Maiden', 'O primeiro álbum com Bruce Dickinson nos vocais, com "Run to the Hills" e "Hallowed Be Thy Name". Edição remasterizada.', 'CD em caixa acrílica\nEncarte com letras\nRemasterizado', 'Invaders\nChildren of the Damned\nThe Prisoner\n22 Acacia Avenue\nThe Number of the Beast\nRun to the Hills\nGangland\nHallowed Be Thy Name', 1982, 49.90, NULL, NULL, 19, 0, 'img/fotos/produtos/cd-iron-maiden-number-beast.jpg', 'img/fotos/capas/cd-iron-maiden-number-beast.jpg,img/fotos/cds-caixa.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 179 DAY, '14:43:00')),
  (19, 3, 'CD Ramones – Ramones (1976)', 'cd-ramones-1976', 'Ramones', 'Catorze músicas em menos de 30 minutos: o disco que inventou o punk rock. Edição com faixas bônus.', 'CD em caixa acrílica\nFaixas bônus\nRemasterizado', 'Blitzkrieg Bop\nBeat on the Brat\nJudy Is a Punk\nI Wanna Be Your Boyfriend\nChain Saw\nNow I Wanna Sniff Some Glue\nI Don\'t Wanna Go Down to the Basement\nLoudmouth\nHavana Affair\nListen to My Heart\n53rd & 3rd\nLet\'s Dance\nI Don\'t Wanna Walk Around with You\nToday Your Love, Tomorrow the World', 1976, 44.90, NULL, NULL, 14, 0, 'img/fotos/produtos/cd-ramones-1976.jpg', 'img/fotos/capas/cd-ramones-1976.jpg,img/fotos/cds-caixa.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 186 DAY, '14:42:00')),
  (20, 3, 'CD Legião Urbana – Dois', 'cd-legiao-urbana-dois', 'Legião Urbana', 'O segundo disco da Legião, com "Tempo Perdido", "Eduardo e Mônica" e "Índios". Esgotado no momento.', 'CD em embalagem digipack\nEncarte com letras\nRemasterizado', 'Daniel na Cova dos Leões\nQuase Sem Querer\nAcrilic on Canvas\nEduardo e Mônica\nCentral do Brasil\nTempo Perdido\nMetrópole\nPlantas Embaixo do Aquário\nMúsica Urbana 2\nAndrea Doria\nFábrica\nÍndios', 1986, 39.90, NULL, NULL, 0, 0, 'img/fotos/produtos/cd-legiao-urbana-dois.jpg', 'img/fotos/capas/cd-legiao-urbana-dois.jpg,img/fotos/cds-caixa.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 193 DAY, '14:41:00')),
  (21, 3, 'CD Guns N\' Roses – Use Your Illusion I', 'cd-guns-n-roses-use-your-illusion-i', 'Guns N\' Roses', 'O primeiro volume do projeto duplo de 1991, com "November Rain", "Don\'t Cry" e "Live and Let Die". Edição remasterizada.', 'CD em caixa acrílica\nEncarte com letras\nRemasterizado', 'Right Next Door to Hell\nDust N\' Bones\nLive and Let Die\nDon\'t Cry\nPerfect Crime\nYou Ain\'t the First\nBad Obsession\nBack Off Bitch\nDouble Talkin\' Jive\nNovember Rain\nThe Garden\nGarden of Eden\nDon\'t Damn Me\nBad Apples\nDead Horse\nComa', 1991, 49.90, 39.90, NOW() + INTERVAL 366 HOUR, 23, 0, 'img/fotos/produtos/cd-guns-n-roses-use-your-illusion-i.jpg', 'img/fotos/capas/cd-guns-n-roses-use-your-illusion-i.jpg,img/fotos/cds-caixa.jpg', 1, TIMESTAMP(CURDATE() - INTERVAL 200 DAY, '14:40:00')),
  (22, 4, 'Pôster Led Zeppelin – Physical Graffiti', 'poster-led-zeppelin-physical-graffiti', 'Led Zeppelin', 'Pôster com a capa de Physical Graffiti (1975): a fachada do prédio de Nova York com as janelas recortadas. Ótimo para quadros e estúdios.', 'Tamanho A2 (42 x 59,4 cm)\nPapel couché 180 g, fosco\nEnviado em tubo rígido', NULL, NULL, 39.90, NULL, NULL, 25, 0, 'img/fotos/produtos/poster-led-zeppelin-physical-graffiti.jpg', 'img/fotos/capas/poster-led-zeppelin-physical-graffiti.jpg,img/fotos/posteres-parede.jpg', 1, TIMESTAMP(CURDATE() - INTERVAL 207 DAY, '14:39:00')),
  (23, 4, 'Pôster AC/DC – Let There Be Rock', 'poster-acdc-let-there-be-rock', 'AC/DC', 'Pôster com a capa de Let There Be Rock (1977): a banda ao vivo, iluminada por fachos de luz, no auge da energia.', 'Tamanho A3 (29,7 x 42 cm)\nPapel couché 180 g, brilho\nEnviado em tubo rígido', NULL, NULL, 29.90, NULL, NULL, 31, 0, 'img/fotos/produtos/poster-acdc-let-there-be-rock.jpg', 'img/fotos/capas/poster-acdc-let-there-be-rock.jpg,img/fotos/posteres-parede.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 214 DAY, '14:38:00')),
  (24, 4, 'Pôster Queen – Live at Wembley \'86', 'poster-queen-live-at-wembley', 'Queen', 'Pôster comemorativo do show histórico do Queen em Wembley, em 1986, com a arte do álbum ao vivo.', 'Tamanho A2 (42 x 59,4 cm)\nPapel couché 180 g, fosco\nEnviado em tubo rígido', NULL, NULL, 34.90, 24.90, NOW() + INTERVAL 102 HOUR, 17, 0, 'img/fotos/produtos/poster-queen-live-at-wembley.jpg', 'img/fotos/capas/poster-queen-live-at-wembley.jpg,img/fotos/posteres-parede.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 6 DAY, '14:42:00')),
  (25, 4, 'Pôster Pink Floyd – The Wall', 'poster-pink-floyd-wall', 'Pink Floyd', 'Pôster com a capa de The Wall (1979): o muro de tijolos brancos da ópera-rock do Pink Floyd.', 'Tamanho A2 (42 x 59,4 cm)\nPapel couché 180 g, fosco\nEnviado em tubo rígido', NULL, NULL, 34.90, NULL, NULL, 12, 0, 'img/fotos/produtos/poster-pink-floyd-wall.jpg', 'img/fotos/capas/poster-pink-floyd-wall.jpg,img/fotos/posteres-parede.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 228 DAY, '14:36:00')),
  (26, 5, 'Kit de Palhetas Riff Store (6 unidades)', 'kit-palhetas-riff', 'Riff Store', 'Seis palhetas em espessuras variadas (0,46 a 1,0 mm) com estampas exclusivas da loja. Acompanha estojo metálico.', 'Celuloide, espessuras 0,46 / 0,60 / 0,71 / 0,81 / 0,88 / 1,0 mm\nEstojo metálico com fecho', NULL, NULL, 24.90, NULL, NULL, 60, 0, 'img/fotos/produtos/kit-palhetas-riff.jpg', NULL, 1, TIMESTAMP(CURDATE() - INTERVAL 235 DAY, '14:35:00')),
  (27, 5, 'Boné Aba Curva Riff Store', 'bone-riff-store', 'Riff Store', 'Boné preto de aba curva com logo bordado da Riff Store e regulagem traseira. Combina com qualquer camiseta de banda.', 'Tamanho único com regulagem\nBordado em alto-relevo\nAba curva', NULL, NULL, 79.90, NULL, NULL, 14, 0, 'img/fotos/produtos/bone-riff-store.jpg', NULL, 0, TIMESTAMP(CURDATE() - INTERVAL 242 DAY, '14:34:00')),
  (28, 5, 'Caneca Preta Riff Store', 'caneca-riff-store', 'Riff Store', 'Caneca de cerâmica de 325 ml, preta e fosca, para o café antes do ensaio.', 'Cerâmica, 325 ml\nPode ir ao micro-ondas\nNão recomendada para lava-louças', NULL, NULL, 44.90, 34.90, NOW() + INTERVAL 222 HOUR, 26, 0, 'img/fotos/produtos/caneca-riff-store.jpg', NULL, 0, TIMESTAMP(CURDATE() - INTERVAL 249 DAY, '14:33:00')),
  (29, 5, 'Patch Bordado Ramones', 'patch-ramones', 'Ramones', 'Patch bordado de 8 cm com a capa do primeiro disco dos Ramones, para customizar jaquetas, mochilas e coletes. Termocolante ou para costurar.', 'Diâmetro: 8 cm\nBordado com fundo termocolante', NULL, NULL, 19.90, NULL, NULL, 48, 0, 'img/fotos/produtos/patch-ramones.jpg', 'img/fotos/capas/patch-ramones.jpg', 0, TIMESTAMP(CURDATE() - INTERVAL 256 DAY, '14:32:00')),
  (30, 5, 'Cinto de Rebites', 'cinto-rebites-riff', 'Riff Store', 'Cinto em couro sintético preto com rebites metálicos e fivela prateada. O acessório clássico do punk e do metal.', 'Couro sintético\nRebites metálicos\nFivela prateada\nTamanhos do 38 ao 46', NULL, NULL, 34.90, NULL, NULL, 20, 0, 'img/fotos/produtos/cinto-rebites-riff.jpg', NULL, 0, TIMESTAMP(CURDATE() - INTERVAL 12 DAY, '14:24:00')),
  (31, 5, 'Toca-discos Portátil Retrô', 'toca-discos-portatil', 'Riff Store', 'Toca-discos em maleta com alto-falante embutido, três velocidades (33, 45 e 78 RPM) e saída para fones. Esgotado no momento.', 'Velocidades: 33 1/3, 45 e 78 RPM\nAlto-falantes embutidos\nSaída RCA e para fones de ouvido\nBivolt', NULL, NULL, 449.90, NULL, NULL, 0, 0, 'img/fotos/produtos/toca-discos-portatil.jpg', NULL, 0, TIMESTAMP(CURDATE() - INTERVAL 270 DAY, '14:30:00'));

INSERT INTO usuarios (id, nome, email, senha_hash, telefone, perfil, criado_em) VALUES
  (1, 'Administrador Riff', 'admin@riffstore.com', '$2b$10$yc7UButt1Eu9Ku5lp9CPHu.Dv8AvcbO1Nhmuoj0JiUOtZYIxI5BLO', '(34) 99999-0000', 'admin', TIMESTAMP(CURDATE() - INTERVAL 200 DAY, '14:40:00')),
  (2, 'João Silva', 'cliente@riffstore.com', '$2b$10$.T7DUw9a1po2mapdhbFBSeJy6Uyf0e4xsPosSAGjRX92VPO6rz08.', '(34) 98888-1111', 'cliente', TIMESTAMP(CURDATE() - INTERVAL 90 DAY, '14:30:00')),
  (3, 'Maria Souza', 'maria@email.com', '$2b$10$Goq97zKivFKp/F.Nz93lnOe7iS0mpZ6JreMxiGk6rQbMBb2A/TRYW', '(34) 97777-2222', 'cliente', TIMESTAMP(CURDATE() - INTERVAL 40 DAY, '14:20:00')),
  (4, 'Carlos Lima', 'carlos@email.com', '$2b$10$TvmTDc67Sf1nEEhib5dEjOnpzZ0KycnG03bZSqDEx7ZH1Nk0wvU9a', '(31) 96666-3333', 'cliente', TIMESTAMP(CURDATE() - INTERVAL 20 DAY, '14:40:00')),
  (5, 'Ana Pereira', 'ana@email.com', '$2b$10$kee2kSlIWu7mx67wlaqdu.wNvZk2r3S1NSWnSDp2/9Rs/dIY.Mslu', '(11) 95555-4444', 'cliente', TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '14:34:00'));

INSERT INTO pedidos (id, usuario_id, nome_cliente, email, telefone, cep, endereco, numero, complemento, bairro, cidade, uf, forma_pagamento, subtotal, frete, total, status, criado_em) VALUES
  (1, 2, 'João Silva', 'cliente@riffstore.com', '(34) 98888-1111', '38500-000', 'Rua Vereador Zico Alves', '120', NULL, 'Centro', 'Monte Carmelo', 'MG', 'pix', 309.70, 0.00, 309.70, 'entregue', TIMESTAMP(CURDATE() - INTERVAL 30 DAY, '14:30:00')),
  (2, 2, 'João Silva', 'cliente@riffstore.com', '(34) 98888-1111', '38500-000', 'Rua Vereador Zico Alves', '120', NULL, 'Centro', 'Monte Carmelo', 'MG', 'cartao', 99.70, 19.90, 119.60, 'enviado', TIMESTAMP(CURDATE() - INTERVAL 6 DAY, '14:42:00')),
  (3, 3, 'Maria Souza', 'maria@email.com', '(34) 97777-2222', '38400-100', 'Av. João Naves de Ávila', '2121', 'Bloco B', 'Santa Mônica', 'Uberlândia', 'MG', 'boleto', 269.80, 19.90, 289.70, 'entregue', TIMESTAMP(CURDATE() - INTERVAL 12 DAY, '14:24:00')),
  (4, 4, 'Carlos Lima', 'carlos@email.com', '(31) 96666-3333', '30130-000', 'Rua da Bahia', '900', 'Apto 302', 'Centro', 'Belo Horizonte', 'MG', 'pix', 349.70, 0.00, 349.70, 'em_separacao', TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '14:17:00')),
  (5, 3, 'Maria Souza', 'maria@email.com', '(34) 97777-2222', '38400-100', 'Av. João Naves de Ávila', '2121', 'Bloco B', 'Santa Mônica', 'Uberlândia', 'MG', 'cartao', 99.60, 19.90, 119.50, 'recebido', NOW() - INTERVAL 6 HOUR),
  (6, 4, 'Carlos Lima', 'carlos@email.com', '(31) 96666-3333', '30130-000', 'Rua da Bahia', '900', 'Apto 302', 'Centro', 'Belo Horizonte', 'MG', 'pix', 79.90, 19.90, 99.80, 'recebido', NOW() - INTERVAL 7 HOUR);

INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, tamanho, quantidade, preco_unitario) VALUES
  (1, 1, 'Camiseta Nirvana – Bleach', 'M', 1, 89.90),
  (1, 11, 'Disco de Vinil Pink Floyd – The Dark Side of the Moon', NULL, 1, 189.90),
  (1, 23, 'Pôster AC/DC – Let There Be Rock', NULL, 1, 29.90),
  (2, 18, 'CD Iron Maiden – The Number of the Beast', NULL, 1, 49.90),
  (2, 26, 'Kit de Palhetas Riff Store (6 unidades)', NULL, 2, 24.90),
  (3, 16, 'Disco de Vinil Queen – A Night at the Opera', NULL, 1, 179.90),
  (3, 8, 'Camiseta Queen – News of the World', 'P', 1, 89.90),
  (4, 3, 'Camiseta AC/DC – Highway to Hell', 'G', 2, 89.90),
  (4, 13, 'Disco de Vinil AC/DC – Back in Black', NULL, 1, 169.90),
  (5, 22, 'Pôster Led Zeppelin – Physical Graffiti', NULL, 1, 39.90),
  (5, 29, 'Patch Bordado Ramones', NULL, 3, 19.90),
  (6, 27, 'Boné Aba Curva Riff Store', NULL, 1, 79.90);

INSERT INTO avaliacoes (produto_id, usuario_id, nota, comentario, criado_em) VALUES
  (1, 2, 5, 'Malha muito boa e a estampa não desbotou depois de várias lavagens. Chegou rápido!', TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '14:25:00')),
  (11, 2, 5, 'Prensagem impecável, sem chiado. O encarte com os pôsteres é um presente à parte.', TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '14:25:00')),
  (23, 2, 4, 'Cores fortes e papel de qualidade. Só achei o tubo um pouco amassado.', TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '14:25:00')),
  (16, 3, 5, 'Som cristalino. Bohemian Rhapsody no vinil é outra experiência.', TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '14:25:00')),
  (8, 3, 4, 'Linda! O tamanho P ficou um pouquinho largo, mas adorei.', TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '14:25:00'));

INSERT INTO mensagens (nome, email, assunto, mensagem, lida, criado_em) VALUES
  ('Pedro Henrique', 'pedro@email.com', 'sugestao', 'Vocês poderiam trazer mais camisetas de bandas nacionais, como Titãs e Capital Inicial?', 1, TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '14:51:00')),
  ('Luiza Martins', 'luiza@email.com', 'pedido', 'Qual o prazo de entrega para Uberaba? Quero dar um vinil de presente no fim do mês.', 0, TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '14:34:00')),
  ('Rafael Costa', 'rafael@email.com', 'troca', 'Comprei uma camiseta M e gostaria de trocar por G. Como faço?', 0, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '14:17:00'));

INSERT INTO configuracoes (chave, valor) VALUES
  ('email', 'contato@riffstore.com.br'),
  ('telefone', '(34) 3333-0000'),
  ('whatsapp', '(34) 99999-0000'),
  ('endereco', 'Monte Carmelo – MG'),
  ('horario', 'Seg. a sex., das 9h às 18h'),
  ('instagram', 'https://instagram.com/'),
  ('facebook', 'https://facebook.com/'),
  ('youtube', 'https://youtube.com/');
