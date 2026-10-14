/*
 * Fonte do catálogo de demonstração, compartilhada pelos geradores de SQL e JavaScript.
 * Cada produto informa categoria, slug, preço, estoque, imagens e opções de apresentação.
 * Os valores são exemplos acadêmicos, independentes de registros editados no MySQL.
 */
/*
 * Catálogo inicial da Riff Store.
 * Usado por database/init.js e scripts/gerar-sql.js (banco MySQL),
 * scripts/gerar-dados-front.js (modo sem servidor) e scripts/baixar-fotos.js
 * (fotos dos produtos).
 *
 * real  -> de onde vem a foto do produto:
 *          tipo: camiseta | vinil | cd | poster | patch -> capa do álbum aplicada sobre uma foto real
 *          tipo: foto -> foto do Unsplash
 *          capa: artigos da Wikipedia ("idioma:Título") cuja imagem principal é a capa
 * promo -> { preco, dias }: promoção válida por "dias" a partir da carga do banco
 * novo  -> produto cadastrado recentemente (recebe o selo "Novo")
 */

const categorias = [
  { nome: 'Camisetas', slug: 'camisetas', icone: 'bi-shirt', ordem: 1 },
  { nome: 'Discos de Vinil', slug: 'vinil', icone: 'bi-vinyl', ordem: 2 },
  { nome: 'CDs', slug: 'cds', icone: 'bi-disc', ordem: 3 },
  { nome: 'Pôsteres', slug: 'posteres', icone: 'bi-image', ordem: 4 },
  { nome: 'Acessórios', slug: 'acessorios', icone: 'bi-bag', ordem: 5 }
];

const produtos = [
  // ---------------------------------------------------------------- Camisetas
  {
    slug: 'camiseta-nirvana-bleach',
    categoria: 'camisetas',
    banda: 'Nirvana',
    nome: 'Camiseta Nirvana – Bleach',
    preco: 89.9,
    estoque: 34,
    destaque: true,
    descricao: 'Camiseta preta com a capa de Bleach (1989), o primeiro disco do Nirvana, estampada no peito. Malha macia, gola reforçada e caimento reto, para usar no show ou no dia a dia.',
    detalhes: 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria',
    real: { tipo: 'camiseta', capa: ['en:Bleach (Nirvana album)'] }
  },
  {
    slug: 'camiseta-rolling-stones-tattoo-you',
    categoria: 'camisetas',
    banda: 'Rolling Stones',
    nome: 'Camiseta Rolling Stones – Tattoo You',
    preco: 89.9,
    estoque: 21,
    destaque: true,
    promo: { preco: 69.9, dias: 9 },
    descricao: 'Camiseta preta com a capa de Tattoo You (1981), o disco de "Start Me Up". Um clássico dos Stones para quem tem atitude de sobra.',
    detalhes: 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria',
    real: { tipo: 'camiseta', capa: ['en:Tattoo You'] }
  },
  {
    slug: 'camiseta-acdc-highway-to-hell',
    categoria: 'camisetas',
    banda: 'AC/DC',
    nome: 'Camiseta AC/DC – Highway to Hell',
    preco: 89.9,
    estoque: 40,
    destaque: true,
    descricao: 'Camiseta preta com a capa de Highway to Hell (1979), o último disco com Bon Scott nos vocais. Para quem gosta de som alto.',
    detalhes: 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria',
    real: { tipo: 'camiseta', capa: ['en:Highway to Hell'] }
  },
  {
    slug: 'camiseta-metallica-master-of-puppets',
    categoria: 'camisetas',
    banda: 'Metallica',
    nome: 'Camiseta Metallica – Master of Puppets',
    preco: 99.9,
    estoque: 18,
    novo: true,
    descricao: 'Camiseta preta com a capa de Master of Puppets (1986): o cemitério de cruzes e os fios de marionete do álbum mais cultuado do thrash metal.',
    detalhes: 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria',
    real: { tipo: 'camiseta', capa: ['en:Master of Puppets'] }
  },
  {
    slug: 'camiseta-iron-maiden-trooper',
    categoria: 'camisetas',
    banda: 'Iron Maiden',
    nome: 'Camiseta Iron Maiden – The Trooper',
    preco: 99.9,
    estoque: 0,
    descricao: 'Camiseta preta com a arte de The Trooper (1983): o Eddie de casaca vermelha e bandeira em punho. Esgotada no momento, volte em breve!',
    detalhes: 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria',
    real: { tipo: 'camiseta', capa: ['en:The Trooper'] }
  },
  {
    slug: 'camiseta-ramones-rocket-to-russia',
    categoria: 'camisetas',
    banda: 'Ramones',
    nome: 'Camiseta Ramones – Rocket to Russia',
    preco: 79.9,
    estoque: 27,
    promo: { preco: 59.9, dias: 9 },
    descricao: 'Camiseta preta com a capa de Rocket to Russia (1977), o disco de "Sheena Is a Punk Rocker". Três acordes e muita atitude.',
    detalhes: 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria',
    real: { tipo: 'camiseta', capa: ['en:Rocket to Russia'] }
  },
  {
    slug: 'camiseta-led-zeppelin-i',
    categoria: 'camisetas',
    banda: 'Led Zeppelin',
    nome: 'Camiseta Led Zeppelin – Led Zeppelin I',
    preco: 89.9,
    estoque: 15,
    descricao: 'Camiseta preta com a capa do primeiro disco do Led Zeppelin (1969): o dirigível Hindenburg em chamas, em preto e branco.',
    detalhes: 'Malha 100% algodão fio 30.1 penteado, cor off-white\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria',
    real: { tipo: 'camiseta', capa: ['en:Led Zeppelin (album)'] }
  },
  {
    slug: 'camiseta-queen-news-of-the-world',
    categoria: 'camisetas',
    banda: 'Queen',
    nome: 'Camiseta Queen – News of the World',
    preco: 89.9,
    estoque: 22,
    novo: true,
    descricao: 'Camiseta preta com a capa de News of the World (1977), o disco de "We Will Rock You" e "We Are the Champions", com o robô gigante de Frank Kelly Freas.',
    detalhes: 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria',
    real: { tipo: 'camiseta', capa: ['en:News of the World (Queen album)'] }
  },
  {
    slug: 'camiseta-legiao-urbana-que-pais-e-este',
    categoria: 'camisetas',
    banda: 'Legião Urbana',
    nome: 'Camiseta Legião Urbana – Que País É Este',
    preco: 79.9,
    estoque: 30,
    descricao: 'Homenagem ao rock de Brasília: camiseta preta com a capa de Que País É Este (1987), o terceiro disco da Legião Urbana.',
    detalhes: 'Malha 100% algodão fio 30.1 penteado, cor chumbo\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria',
    real: { tipo: 'camiseta', capa: ['pt:Que País É Este (álbum)','en:Que País É Este'] }
  },
  {
    slug: 'camiseta-sepultura-roots',
    categoria: 'camisetas',
    banda: 'Sepultura',
    nome: 'Camiseta Sepultura – Roots',
    preco: 94.9,
    estoque: 12,
    novo: true,
    descricao: 'O metal brasileiro mais conhecido do mundo: camiseta preta com a capa de Roots (1996), o disco que misturou thrash metal e percussão brasileira.',
    detalhes: 'Malha 100% algodão fio 30.1 penteado\nEstampa da capa em silk-screen de alta definição\nGola careca com ribana reforçada\nLavar do avesso, em água fria',
    real: { tipo: 'camiseta', capa: ['en:Roots (Sepultura album)'] }
  },
  // ---------------------------------------------------------------- Discos de vinil
  {
    slug: 'vinil-pink-floyd-dark-side',
    categoria: 'vinil',
    banda: 'Pink Floyd',
    nome: 'Disco de Vinil Pink Floyd – The Dark Side of the Moon',
    preco: 189.9,
    estoque: 9,
    destaque: true,
    ano: 1973,
    audio: '/audio/previa-1.wav',
    descricao: 'Um dos álbuns mais vendidos da história, em LP de 180 gramas. Prensagem remasterizada, capa gatefold e encarte com pôsteres.',
    detalhes: 'LP 180 g, 33 1/3 RPM\nCapa gatefold com encarte\nRemasterizado\nLançamento original: 1973',
    faixas: 'Speak to Me\nBreathe\nOn the Run\nTime\nThe Great Gig in the Sky\nMoney\nUs and Them\nAny Colour You Like\nBrain Damage\nEclipse',
    real: { tipo: 'vinil', capa: ['en:The Dark Side of the Moon'] }
  },
  {
    slug: 'vinil-nirvana-unplugged',
    categoria: 'vinil',
    banda: 'Nirvana',
    nome: 'Disco de Vinil Nirvana – MTV Unplugged in New York',
    preco: 179.9,
    estoque: 6,
    promo: { preco: 149.9, dias: 6 },
    ano: 1994,
    audio: '/audio/previa-2.wav',
    descricao: 'O lendário acústico gravado em 1993 para a MTV, com "About a Girl", "The Man Who Sold the World" e "Where Did You Sleep Last Night". LP de 180 gramas.',
    detalhes: 'LP 180 g, 33 1/3 RPM\nCapa com acabamento fosco\nLançamento original: 1994',
    faixas: 'About a Girl\nCome as You Are\nJesus Doesn\'t Want Me for a Sunbeam\nThe Man Who Sold the World\nPennyroyal Tea\nDumb\nPolly\nOn a Plain\nSomething in the Way\nPlateau\nOh Me\nLake of Fire\nAll Apologies\nWhere Did You Sleep Last Night',
    real: { tipo: 'vinil', capa: ['en:MTV Unplugged in New York'] }
  },
  {
    slug: 'vinil-acdc-back-in-black',
    categoria: 'vinil',
    banda: 'AC/DC',
    nome: 'Disco de Vinil AC/DC – Back in Black',
    preco: 169.9,
    estoque: 11,
    destaque: true,
    ano: 1980,
    audio: '/audio/previa-3.wav',
    descricao: 'Capa toda preta, riffs inesquecíveis e um dos álbuns de rock mais vendidos de todos os tempos. Edição remasterizada.',
    detalhes: 'LP 180 g, 33 1/3 RPM\nRemasterizado\nLançamento original: 1980',
    faixas: 'Hells Bells\nShoot to Thrill\nWhat Do You Do for Money Honey\nGivin the Dog a Bone\nLet Me Put My Love into You\nBack in Black\nYou Shook Me All Night Long\nHave a Drink on Me\nShake a Leg\nRock and Roll Ain\'t Noise Pollution',
    real: { tipo: 'vinil', capa: ['en:Back in Black'] }
  },
  {
    slug: 'vinil-led-zeppelin-iv',
    categoria: 'vinil',
    banda: 'Led Zeppelin',
    nome: 'Disco de Vinil Led Zeppelin – IV',
    preco: 189.9,
    estoque: 7,
    ano: 1971,
    audio: '/audio/previa-1.wav',
    descricao: 'O quarto álbum, sem título na capa, guarda "Stairway to Heaven" e "Black Dog". Prensagem remasterizada em 180 gramas.',
    detalhes: 'LP 180 g, 33 1/3 RPM\nCapa sanduíche com encarte\nLançamento original: 1971',
    faixas: 'Black Dog\nRock and Roll\nThe Battle of Evermore\nStairway to Heaven\nMisty Mountain Hop\nFour Sticks\nGoing to California\nWhen the Levee Breaks',
    real: { tipo: 'vinil', capa: ['en:Led Zeppelin IV'] }
  },
  {
    slug: 'vinil-metallica-black-album',
    categoria: 'vinil',
    banda: 'Metallica',
    nome: 'Disco de Vinil Metallica – Metallica (Black Album)',
    preco: 249.9,
    estoque: 4,
    novo: true,
    ano: 1991,
    audio: '/audio/previa-3.wav',
    descricao: 'Edição dupla remasterizada do álbum que levou o metal às rádios do mundo inteiro, com "Enter Sandman" e "Nothing Else Matters".',
    detalhes: 'LP duplo 180 g, 45 RPM\nCapa gatefold\nRemasterizado\nLançamento original: 1991',
    faixas: 'Enter Sandman\nSad but True\nHoly Wars... The Punishment Due\nThe Unforgiven\nWherever I May Roam\nDon\'t Tread on Me\nThrough the Never\nNothing Else Matters\nOf Wolf and Man\nThe God That Failed\nMy Friend of Misery\nThe Struggle Within',
    real: { tipo: 'vinil', capa: ['en:Metallica (album)'] }
  },
  {
    slug: 'vinil-queen-night-opera',
    categoria: 'vinil',
    banda: 'Queen',
    nome: 'Disco de Vinil Queen – A Night at the Opera',
    preco: 179.9,
    estoque: 8,
    promo: { preco: 139.9, dias: 12 },
    ano: 1975,
    audio: '/audio/previa-2.wav',
    descricao: 'O álbum de "Bohemian Rhapsody", com a capa branca e o brasão da banda. Uma obra-prima do rock teatral.',
    detalhes: 'LP 180 g, 33 1/3 RPM\nEncarte com letras\nLançamento original: 1975',
    faixas: 'Death on Two Legs\nLazing on a Sunday Afternoon\nI\'m in Love with My Car\nYou\'re My Best Friend\n\'39\nSweet Lady\nSeaside Rendezvous\nThe Prophet\'s Song\nLove of My Life\nGood Company\nBohemian Rhapsody\nGod Save the Queen',
    real: { tipo: 'vinil', capa: ['en:A Night at the Opera (Queen album)'] }
  },
  {
    slug: 'vinil-secos-molhados',
    categoria: 'vinil',
    banda: 'Secos & Molhados',
    nome: 'Disco de Vinil Secos & Molhados – 1973',
    preco: 159.9,
    estoque: 5,
    novo: true,
    ano: 1973,
    audio: '/audio/previa-1.wav',
    descricao: 'Estreia histórica do rock brasileiro, com "Sangue Latino" e "O Vira". Reedição em vinil com encarte e fotos raras.',
    detalhes: 'LP 180 g, 33 1/3 RPM\nEncarte com fotos\nLançamento original: 1973',
    faixas: 'Sangue Latino\nO Vira\nO Patrão Nosso de Cada Dia\nAmor\nPrimavera nos Dentes\nAssim Assado\nMulher Barriguda\nEl Rey\nRosa de Hiroshima\nPrece Cósmica\nRondó do Capitão\nAs Andorinhas\nFala',
    real: { tipo: 'vinil', capa: ['pt:Secos & Molhados (álbum de 1973)','en:Secos & Molhados (1973 album)','pt:Secos & Molhados (1973)'] }
  },
  // ---------------------------------------------------------------- CDs
  {
    slug: 'cd-iron-maiden-number-beast',
    categoria: 'cds',
    banda: 'Iron Maiden',
    nome: 'CD Iron Maiden – The Number of the Beast',
    preco: 49.9,
    estoque: 19,
    ano: 1982,
    audio: '/audio/previa-3.wav',
    descricao: 'O primeiro álbum com Bruce Dickinson nos vocais, com "Run to the Hills" e "Hallowed Be Thy Name". Edição remasterizada.',
    detalhes: 'CD em caixa acrílica\nEncarte com letras\nRemasterizado',
    faixas: 'Invaders\nChildren of the Damned\nThe Prisoner\n22 Acacia Avenue\nThe Number of the Beast\nRun to the Hills\nGangland\nHallowed Be Thy Name',
    real: { tipo: 'cd', capa: ['en:The Number of the Beast (album)'] }
  },
  {
    slug: 'cd-ramones-1976',
    categoria: 'cds',
    banda: 'Ramones',
    nome: 'CD Ramones – Ramones (1976)',
    preco: 44.9,
    estoque: 14,
    ano: 1976,
    audio: '/audio/previa-2.wav',
    descricao: 'Catorze músicas em menos de 30 minutos: o disco que inventou o punk rock. Edição com faixas bônus.',
    detalhes: 'CD em caixa acrílica\nFaixas bônus\nRemasterizado',
    faixas: 'Blitzkrieg Bop\nBeat on the Brat\nJudy Is a Punk\nI Wanna Be Your Boyfriend\nChain Saw\nNow I Wanna Sniff Some Glue\nI Don\'t Wanna Go Down to the Basement\nLoudmouth\nHavana Affair\nListen to My Heart\n53rd & 3rd\nLet\'s Dance\nI Don\'t Wanna Walk Around with You\nToday Your Love, Tomorrow the World',
    real: { tipo: 'cd', capa: ['en:Ramones (album)'] }
  },
  {
    slug: 'cd-legiao-urbana-dois',
    categoria: 'cds',
    banda: 'Legião Urbana',
    nome: 'CD Legião Urbana – Dois',
    preco: 39.9,
    estoque: 0,
    ano: 1986,
    descricao: 'O segundo disco da Legião, com "Tempo Perdido", "Eduardo e Mônica" e "Índios". Esgotado no momento.',
    detalhes: 'CD em embalagem digipack\nEncarte com letras\nRemasterizado',
    faixas: 'Daniel na Cova dos Leões\nQuase Sem Querer\nAcrilic on Canvas\nEduardo e Mônica\nCentral do Brasil\nTempo Perdido\nMetrópole\nPlantas Embaixo do Aquário\nMúsica Urbana 2\nAndrea Doria\nFábrica\nÍndios',
    real: { tipo: 'cd', capa: ['pt:Dois (álbum)','pt:Dois (álbum de Legião Urbana)','en:Dois (album)'] }
  },
  {
    slug: 'cd-guns-n-roses-use-your-illusion-i',
    categoria: 'cds',
    banda: 'Guns N\' Roses',
    nome: 'CD Guns N\' Roses – Use Your Illusion I',
    preco: 49.9,
    estoque: 23,
    destaque: true,
    promo: { preco: 39.9, dias: 15 },
    ano: 1991,
    audio: '/audio/previa-3.wav',
    descricao: 'O primeiro volume do projeto duplo de 1991, com "November Rain", "Don\'t Cry" e "Live and Let Die". Edição remasterizada.',
    detalhes: 'CD em caixa acrílica\nEncarte com letras\nRemasterizado',
    faixas: 'Right Next Door to Hell\nDust N\' Bones\nLive and Let Die\nDon\'t Cry\nPerfect Crime\nYou Ain\'t the First\nBad Obsession\nBack Off Bitch\nDouble Talkin\' Jive\nNovember Rain\nThe Garden\nGarden of Eden\nDon\'t Damn Me\nBad Apples\nDead Horse\nComa',
    real: { tipo: 'cd', capa: ['en:Use Your Illusion I'] }
  },
  // ---------------------------------------------------------------- Pôsteres
  {
    slug: 'poster-led-zeppelin-physical-graffiti',
    categoria: 'posteres',
    banda: 'Led Zeppelin',
    nome: 'Pôster Led Zeppelin – Physical Graffiti',
    preco: 39.9,
    estoque: 25,
    destaque: true,
    descricao: 'Pôster com a capa de Physical Graffiti (1975): a fachada do prédio de Nova York com as janelas recortadas. Ótimo para quadros e estúdios.',
    detalhes: 'Tamanho A2 (42 x 59,4 cm)\nPapel couché 180 g, fosco\nEnviado em tubo rígido',
    real: { tipo: 'poster', capa: ['en:Physical Graffiti'] }
  },
  {
    slug: 'poster-acdc-let-there-be-rock',
    categoria: 'posteres',
    banda: 'AC/DC',
    nome: 'Pôster AC/DC – Let There Be Rock',
    preco: 29.9,
    estoque: 31,
    descricao: 'Pôster com a capa de Let There Be Rock (1977): a banda ao vivo, iluminada por fachos de luz, no auge da energia.',
    detalhes: 'Tamanho A3 (29,7 x 42 cm)\nPapel couché 180 g, brilho\nEnviado em tubo rígido',
    real: { tipo: 'poster', capa: ['en:Let There Be Rock'] }
  },
  {
    slug: 'poster-queen-live-at-wembley',
    categoria: 'posteres',
    banda: 'Queen',
    nome: 'Pôster Queen – Live at Wembley \'86',
    preco: 34.9,
    estoque: 17,
    novo: true,
    promo: { preco: 24.9, dias: 4 },
    descricao: 'Pôster comemorativo do show histórico do Queen em Wembley, em 1986, com a arte do álbum ao vivo.',
    detalhes: 'Tamanho A2 (42 x 59,4 cm)\nPapel couché 180 g, fosco\nEnviado em tubo rígido',
    real: { tipo: 'poster', capa: ['en:Live at Wembley \'86'] }
  },
  {
    slug: 'poster-pink-floyd-wall',
    categoria: 'posteres',
    banda: 'Pink Floyd',
    nome: 'Pôster Pink Floyd – The Wall',
    preco: 34.9,
    estoque: 12,
    descricao: 'Pôster com a capa de The Wall (1979): o muro de tijolos brancos da ópera-rock do Pink Floyd.',
    detalhes: 'Tamanho A2 (42 x 59,4 cm)\nPapel couché 180 g, fosco\nEnviado em tubo rígido',
    real: { tipo: 'poster', capa: ['en:The Wall'] }
  },
  // ---------------------------------------------------------------- Acessórios
  {
    slug: 'kit-palhetas-riff',
    categoria: 'acessorios',
    banda: 'Riff Store',
    nome: 'Kit de Palhetas Riff Store (6 unidades)',
    preco: 24.9,
    estoque: 60,
    destaque: true,
    descricao: 'Seis palhetas em espessuras variadas (0,46 a 1,0 mm) com estampas exclusivas da loja. Acompanha estojo metálico.',
    detalhes: 'Celuloide, espessuras 0,46 / 0,60 / 0,71 / 0,81 / 0,88 / 1,0 mm\nEstojo metálico com fecho',
    real: { tipo: 'foto', unsplash: 'GMb9DOBxl4s' }
  },
  {
    slug: 'bone-riff-store',
    categoria: 'acessorios',
    banda: 'Riff Store',
    nome: 'Boné Aba Curva Riff Store',
    preco: 79.9,
    estoque: 14,
    descricao: 'Boné preto de aba curva com logo bordado da Riff Store e regulagem traseira. Combina com qualquer camiseta de banda.',
    detalhes: 'Tamanho único com regulagem\nBordado em alto-relevo\nAba curva',
    real: { tipo: 'foto', unsplash: 'p98GwQHzYPQ' }
  },
  {
    slug: 'caneca-riff-store',
    categoria: 'acessorios',
    banda: 'Riff Store',
    nome: 'Caneca Preta Riff Store',
    preco: 44.9,
    estoque: 26,
    promo: { preco: 34.9, dias: 9 },
    descricao: 'Caneca de cerâmica de 325 ml, preta e fosca, para o café antes do ensaio.',
    detalhes: 'Cerâmica, 325 ml\nPode ir ao micro-ondas\nNão recomendada para lava-louças',
    real: { tipo: 'foto', unsplash: 'bwq_f_JGKvg' }
  },
  {
    slug: 'patch-ramones',
    categoria: 'acessorios',
    banda: 'Ramones',
    nome: 'Patch Bordado Ramones',
    preco: 19.9,
    estoque: 48,
    descricao: 'Patch bordado de 8 cm com a capa do primeiro disco dos Ramones, para customizar jaquetas, mochilas e coletes. Termocolante ou para costurar.',
    detalhes: 'Diâmetro: 8 cm\nBordado com fundo termocolante',
    real: { tipo: 'patch', capa: ['en:Ramones (album)'] }
  },
  {
    slug: 'cinto-rebites-riff',
    categoria: 'acessorios',
    banda: 'Riff Store',
    nome: 'Cinto de Rebites',
    preco: 34.9,
    estoque: 20,
    novo: true,
    descricao: 'Cinto em couro sintético preto com rebites metálicos e fivela prateada. O acessório clássico do punk e do metal.',
    detalhes: 'Couro sintético\nRebites metálicos\nFivela prateada\nTamanhos do 38 ao 46',
    real: { tipo: 'foto', unsplash: 'lucrbz6Q27k' }
  },
  {
    slug: 'toca-discos-portatil',
    categoria: 'acessorios',
    banda: 'Riff Store',
    nome: 'Toca-discos Portátil Retrô',
    preco: 449.9,
    estoque: 0,
    descricao: 'Toca-discos em maleta com alto-falante embutido, três velocidades (33, 45 e 78 RPM) e saída para fones. Esgotado no momento.',
    detalhes: 'Velocidades: 33 1/3, 45 e 78 RPM\nAlto-falantes embutidos\nSaída RCA e para fones de ouvido\nBivolt',
    real: { tipo: 'foto', unsplash: 'HRyjETL87Gg' }
  }
];

module.exports = { categorias, produtos };
