/*
 * Dados de exemplo da Riff Store (usuários, pedidos, avaliações, mensagens e
 * configurações). Usados pelo banco MySQL (scripts/gerar-sql.js) e pelo modo
 * sem servidor (scripts/gerar-dados-front.js).
 * "dias" = há quantos dias o registro foi criado.
 */
module.exports = {
  usuarios: [
    { id: 1, nome: 'Administrador Riff', email: 'admin@riffstore.com', senha: 'admin123', perfil: 'admin', telefone: '(34) 99999-0000', dias: 200 },
    { id: 2, nome: 'João Silva', email: 'cliente@riffstore.com', senha: 'cliente123', perfil: 'cliente', telefone: '(34) 98888-1111', dias: 90 },
    { id: 3, nome: 'Maria Souza', email: 'maria@email.com', senha: 'maria123', perfil: 'cliente', telefone: '(34) 97777-2222', dias: 40 },
    { id: 4, nome: 'Carlos Lima', email: 'carlos@email.com', senha: 'carlos123', perfil: 'cliente', telefone: '(31) 96666-3333', dias: 20 },
    { id: 5, nome: 'Ana Pereira', email: 'ana@email.com', senha: 'ana12345', perfil: 'cliente', telefone: '(11) 95555-4444', dias: 2 }
  ],
  enderecos: {
    2: ['38500-000', 'Rua Vereador Zico Alves', '120', '', 'Centro', 'Monte Carmelo', 'MG'],
    3: ['38400-100', 'Av. João Naves de Ávila', '2121', 'Bloco B', 'Santa Mônica', 'Uberlândia', 'MG'],
    4: ['30130-000', 'Rua da Bahia', '900', 'Apto 302', 'Centro', 'Belo Horizonte', 'MG']
  },
  pedidos: [
    { usuario: 2, dias: 30, status: 'entregue', pagamento: 'pix', itens: [['camiseta-nirvana-bleach', 'M', 1], ['vinil-pink-floyd-dark-side', null, 1], ['poster-acdc-let-there-be-rock', null, 1]] },
    { usuario: 2, dias: 6, status: 'enviado', pagamento: 'cartao', itens: [['cd-iron-maiden-number-beast', null, 1], ['kit-palhetas-riff', null, 2]] },
    { usuario: 3, dias: 12, status: 'entregue', pagamento: 'boleto', itens: [['vinil-queen-night-opera', null, 1], ['camiseta-queen-news-of-the-world', 'P', 1]] },
    { usuario: 4, dias: 1, status: 'em_separacao', pagamento: 'pix', itens: [['camiseta-acdc-highway-to-hell', 'G', 2], ['vinil-acdc-back-in-black', null, 1]] },
    { usuario: 3, dias: 0, status: 'recebido', pagamento: 'cartao', itens: [['poster-led-zeppelin-physical-graffiti', null, 1], ['patch-ramones', null, 3]] },
    { usuario: 4, dias: 0, status: 'recebido', pagamento: 'pix', itens: [['bone-riff-store', null, 1]] }
  ],
  avaliacoes: [
    ['camiseta-nirvana-bleach', 2, 5, 'Malha muito boa e a estampa não desbotou depois de várias lavagens. Chegou rápido!'],
    ['vinil-pink-floyd-dark-side', 2, 5, 'Prensagem impecável, sem chiado. O encarte com os pôsteres é um presente à parte.'],
    ['poster-acdc-let-there-be-rock', 2, 4, 'Cores fortes e papel de qualidade. Só achei o tubo um pouco amassado.'],
    ['vinil-queen-night-opera', 3, 5, 'Som cristalino. Bohemian Rhapsody no vinil é outra experiência.'],
    ['camiseta-queen-news-of-the-world', 3, 4, 'Linda! O tamanho P ficou um pouquinho largo, mas adorei.']
  ],
  mensagens: [
    ['Pedro Henrique', 'pedro@email.com', 'sugestao', 'Vocês poderiam trazer mais camisetas de bandas nacionais, como Titãs e Capital Inicial?', 1, 3],
    ['Luiza Martins', 'luiza@email.com', 'pedido', 'Qual o prazo de entrega para Uberaba? Quero dar um vinil de presente no fim do mês.', 0, 2],
    ['Rafael Costa', 'rafael@email.com', 'troca', 'Comprei uma camiseta M e gostaria de trocar por G. Como faço?', 0, 1]
  ],
  configuracoes: {
    email: 'contato@riffstore.com.br',
    telefone: '(34) 3333-0000',
    whatsapp: '(34) 99999-0000',
    endereco: 'Monte Carmelo – MG',
    horario: 'Seg. a sex., das 9h às 18h',
    instagram: 'https://instagram.com/',
    facebook: 'https://facebook.com/',
    youtube: 'https://youtube.com/'
  }
};
