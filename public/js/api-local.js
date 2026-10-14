/*
 * API local: responde às mesmas rotas da API do servidor (src/routes),
 * mas roda no próprio navegador e guarda os dados no localStorage.
 * É usada quando o site é aberto sem o servidor Node/MySQL
 * (RS_CONFIG.usarServidor = false em js/config.js).
 */
(function () {
  'use strict';

  const CHAVE_BANCO = 'riff_banco';
  const CHAVE_SESSAO = 'riff_sessao';
  const DIA = 24 * 60 * 60 * 1000;
  const FRETE_FIXO = 19.90;
  const FRETE_GRATIS_A_PARTIR = 299;
  const TAMANHOS = ['P', 'M', 'G', 'GG'];
  const STATUS = ['recebido', 'em_separacao', 'enviado', 'entregue'];
  const ASSUNTOS = ['duvida', 'pedido', 'troca', 'sugestao', 'outro'];
  const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
    'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  // Cupons (as mesmas regras de src/cupons.js)
  const CUPONS = { ROCK10: { percentual: 10, exigeNewsletter: true, usoUnico: true } };
  const CHAVES_CONFIG = ['email', 'telefone', 'whatsapp', 'endereco', 'horario', 'instagram', 'facebook', 'youtube'];

  // ------------------------------------------------------------------ Utilitários
  class ErroApi {
    constructor(status, erro, campos) { this.status = status; this.erro = erro; this.campos = campos || {}; }
  }
  const falha = (status, erro, campos) => { throw new ErroApi(status, erro, campos); };
  const validar = erros => { if (Object.keys(erros).length) falha(400, 'Verifique os campos destacados.', erros); };

  const texto = (v, max = 255) => (v === undefined || v === null ? '' : String(v).trim().slice(0, max));
  const emailValido = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
  const telefoneValido = t => { const d = String(t || '').replace(/\D/g, ''); return d.length >= 10 && d.length <= 11; };
  const semAcento = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const gerarSlug = n => semAcento(n).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 150);
  const agora = () => new Date();
  const iso = d => new Date(d).toISOString();
  const diasAtras = (n, hora = 14) => { const d = new Date(Date.now() - n * DIA); d.setHours(hora, (n * 17) % 60, 0, 0); return iso(d); };
  const copia = o => JSON.parse(JSON.stringify(o));
  const arred = v => Math.round(v * 100) / 100;

  // Hash da senha (SHA-256). O site real usa bcrypt no servidor.
  async function hashSenha(senha) {
    const dados = new TextEncoder().encode(`riff-store:${senha}`);
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', dados);
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381;
    for (const b of dados) h = ((h << 5) + h + b) >>> 0;
    return `djb2-${h.toString(16)}`;
  }

  // ------------------------------------------------------------------ "Banco" no localStorage
  let banco = null;

  async function criarBanco() {
    const D = window.RS_DADOS;
    const b = {
      versao: D.versao,
      categorias: copia(D.categorias),
      produtos: D.produtos.map(p => {
        const { promoDias, dias, ...resto } = p;
        return {
          ...resto,
          promocao_fim: promoDias ? iso(Date.now() + promoDias * DIA + 6 * 60 * 60 * 1000) : null,
          criado_em: diasAtras(dias)
        };
      }),
      usuarios: [],
      pedidos: [],
      itens_pedido: [],
      avaliacoes: [],
      mensagens: [],
      newsletter: [],
      configuracoes: copia(D.configuracoes),
      seq: {}
    };
    for (const u of D.usuarios) {
      b.usuarios.push({
        id: u.id, nome: u.nome, email: u.email, senha_hash: await hashSenha(u.senha), telefone: u.telefone,
        perfil: u.perfil, bloqueado: 0, token_recuperacao: null, token_expira: null, criado_em: diasAtras(u.dias)
      });
    }
    const porSlug = slug => b.produtos.find(p => p.slug === slug);
    D.pedidos.forEach((ped, i) => {
      const u = b.usuarios.find(x => x.id === ped.usuario);
      const [cep, endereco, numero, complemento, bairro, cidade, uf] = D.enderecos[ped.usuario];
      const subtotal = arred(ped.itens.reduce((s, [slug, , q]) => s + porSlug(slug).preco * q, 0));
      const frete = subtotal >= FRETE_GRATIS_A_PARTIR ? 0 : FRETE_FIXO;
      const id = i + 1;
      b.pedidos.push({
        id, usuario_id: u.id, nome_cliente: u.nome, email: u.email, telefone: u.telefone, cep, endereco, numero,
        complemento: complemento || null, bairro, cidade, uf, forma_pagamento: ped.pagamento, subtotal, frete,
        total: arred(subtotal + frete), status: ped.status,
        criado_em: ped.dias === 0 ? iso(Date.now() - (2 + i) * 60 * 60 * 1000) : diasAtras(ped.dias)
      });
      ped.itens.forEach(([slug, tamanho, quantidade]) => {
        const p = porSlug(slug);
        b.itens_pedido.push({ id: b.itens_pedido.length + 1, pedido_id: id, produto_id: p.id, nome_produto: p.nome, tamanho, quantidade, preco_unitario: p.preco });
      });
    });
    D.avaliacoes.forEach(([slug, usuario, nota, comentario], i) => {
      b.avaliacoes.push({ id: i + 1, produto_id: porSlug(slug).id, usuario_id: usuario, nota, comentario, visivel: 1, criado_em: diasAtras(5) });
    });
    D.mensagens.forEach(([nome, email, assunto, mensagem, lida, dias], i) => {
      b.mensagens.push({ id: i + 1, nome, email, assunto, mensagem, lida, criado_em: diasAtras(dias) });
    });
    return b;
  }

  async function carregarBanco() {
    if (banco) return banco;
    try { banco = JSON.parse(localStorage.getItem(CHAVE_BANCO)); } catch (e) { banco = null; }
    if (!banco || banco.versao !== window.RS_DADOS.versao) {
      banco = await criarBanco();
      salvar();
    }
    banco.newsletter = banco.newsletter || [];
    return banco;
  }

  function salvar() {
    try { localStorage.setItem(CHAVE_BANCO, JSON.stringify(banco)); } catch (e) { /* armazenamento cheio ou bloqueado */ }
  }

  function proximoId(tabela) {
    return banco[tabela].reduce((m, r) => Math.max(m, r.id), 0) + 1;
  }

  // ------------------------------------------------------------------ Sessão
  function usuarioLogado() {
    const id = Number(localStorage.getItem(CHAVE_SESSAO));
    const u = id && banco.usuarios.find(x => x.id === id);
    return u || null;
  }
  const dadosSessao = u => ({ id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, perfil: u.perfil });
  function exigirLogin() {
    const u = usuarioLogado();
    if (!u) falha(401, 'Faça login para continuar.');
    return u;
  }
  function exigirAdmin() {
    const u = exigirLogin();
    if (u.perfil !== 'admin') falha(403, 'Acesso restrito a administradores.');
    return u;
  }

  // ------------------------------------------------------------------ Produtos
  const promocaoAtiva = p => p.preco_promocional !== null && p.preco_promocional !== undefined && p.promocao_fim && new Date(p.promocao_fim) > agora();
  const precoAtual = p => (promocaoAtiva(p) ? Number(p.preco_promocional) : Number(p.preco));
  const categoriaDe = p => banco.categorias.find(c => c.id === p.categoria_id);

  function notas(p) {
    const lista = banco.avaliacoes.filter(a => a.produto_id === p.id && a.visivel);
    return { media: lista.length ? lista.reduce((s, a) => s + a.nota, 0) / lista.length : null, total: lista.length };
  }

  function formatarProduto(p) {
    const emPromocao = promocaoAtiva(p);
    const selos = [];
    if (p.estoque <= 0) selos.push('esgotado');
    if (emPromocao) selos.push('promocao');
    if (Date.now() - new Date(p.criado_em).getTime() < 30 * DIA) selos.push('novo');
    const cat = categoriaDe(p);
    const n = notas(p);
    return {
      id: p.id, nome: p.nome, slug: p.slug, banda: p.banda,
      categoria: cat ? { nome: cat.nome, slug: cat.slug } : undefined,
      descricao: p.descricao, detalhes: p.detalhes,
      faixas: p.faixas ? p.faixas.split('\n').filter(Boolean) : [],
      ano: p.ano, preco: Number(p.preco),
      precoFinal: precoAtual(p), precoOriginal: emPromocao ? Number(p.preco) : null,
      promocaoFim: emPromocao ? p.promocao_fim : null,
      estoque: p.estoque, temTamanhos: !!p.tem_tamanhos, imagem: p.imagem,
      galeria: [p.imagem, ...(p.galeria ? p.galeria.split(',').filter(Boolean) : [])],
      audio: p.audio_preview, destaque: !!p.destaque, selos,
      mediaNotas: n.media, totalAvaliacoes: n.total
    };
  }

  const ativos = () => banco.produtos.filter(p => p.ativo);

  const rotas = [];
  const rota = (metodo, padrao, fn) => rotas.push({ metodo, padrao, fn });

  rota('GET', /^\/api\/categorias$/, () => [...banco.categorias]
    .sort((a, b) => a.ordem - b.ordem)
    .map(c => ({ id: c.id, nome: c.nome, slug: c.slug, icone: c.icone, total: ativos().filter(p => p.categoria_id === c.id).length })));

  rota('GET', /^\/api\/bandas$/, () => {
    const contagem = {};
    ativos().filter(p => p.banda !== 'Riff Store').forEach(p => { contagem[p.banda] = (contagem[p.banda] || 0) + 1; });
    return Object.entries(contagem).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([nome, total]) => ({ nome, total }));
  });

  rota('GET', /^\/api\/produtos$/, (m, q) => {
    let lista = ativos();
    const ids = texto(q.ids, 500).split(',').map(n => parseInt(n, 10)).filter(n => n > 0);
    if (ids.length) lista = lista.filter(p => ids.includes(p.id));
    const busca = semAcento(texto(q.busca, 80));
    if (busca) lista = lista.filter(p => semAcento(`${p.nome} ${p.banda} ${categoriaDe(p).nome}`).includes(busca));
    if (q.categoria) lista = lista.filter(p => categoriaDe(p).slug === q.categoria);
    const bandas = texto(q.bandas, 500).split(',').map(b => b.trim()).filter(Boolean);
    if (bandas.length) lista = lista.filter(p => bandas.includes(p.banda));
    const min = parseFloat(q.precoMin);
    if (!Number.isNaN(min)) lista = lista.filter(p => precoAtual(p) >= min);
    const max = parseFloat(q.precoMax);
    if (!Number.isNaN(max)) lista = lista.filter(p => precoAtual(p) <= max);
    if (String(q.estoque) === '1') lista = lista.filter(p => p.estoque > 0);
    if (String(q.promocao) === '1') lista = lista.filter(promocaoAtiva);
    if (String(q.novos) === '1') lista = lista.filter(p => Date.now() - new Date(p.criado_em).getTime() < 30 * DIA);

    const ordens = {
      relevancia: (a, b) => b.destaque - a.destaque || (b.estoque > 0) - (a.estoque > 0) || notas(b).total - notas(a).total || a.id - b.id,
      menor: (a, b) => precoAtual(a) - precoAtual(b) || a.id - b.id,
      maior: (a, b) => precoAtual(b) - precoAtual(a) || a.id - b.id,
      novos: (a, b) => new Date(b.criado_em) - new Date(a.criado_em) || a.id - b.id,
      nome: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR')
    };
    lista.sort(ordens[q.ordem] || ordens.relevancia);

    const limite = Math.min(Math.max(parseInt(q.limite, 10) || 12, 1), 48);
    const pagina = Math.max(parseInt(q.pagina, 10) || 1, 1);
    const precos = ativos().map(precoAtual);
    return {
      produtos: lista.slice((pagina - 1) * limite, pagina * limite).map(formatarProduto),
      total: lista.length,
      pagina,
      paginas: Math.max(Math.ceil(lista.length / limite), 1),
      faixaPreco: { minimo: Math.floor(Math.min(...precos)), maximo: Math.ceil(Math.max(...precos)) }
    };
  });

  rota('GET', /^\/api\/produtos\/destaques$/, () => ativos().filter(p => p.destaque)
    .sort((a, b) => (b.estoque > 0) - (a.estoque > 0) || a.id - b.id).slice(0, 8).map(formatarProduto));

  rota('GET', /^\/api\/produtos\/ofertas$/, () => ativos().filter(promocaoAtiva)
    .sort((a, b) => new Date(a.promocao_fim) - new Date(b.promocao_fim)).slice(0, 8).map(formatarProduto));

  function comprou(usuarioId, produtoId) {
    const pedidos = banco.pedidos.filter(p => p.usuario_id === usuarioId).map(p => p.id);
    return banco.itens_pedido.some(i => pedidos.includes(i.pedido_id) && i.produto_id === produtoId);
  }

  rota('GET', /^\/api\/produtos\/([^/]+)$/, (m) => {
    const p = ativos().find(x => x.slug === decodeURIComponent(m[1]));
    if (!p) falha(404, 'Produto não encontrado.');
    const avaliacoes = banco.avaliacoes.filter(a => a.produto_id === p.id && a.visivel)
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
      .map(a => {
        const nome = banco.usuarios.find(u => u.id === a.usuario_id).nome.split(' ');
        return { id: a.id, nota: a.nota, comentario: a.comentario, data: a.criado_em, autor: nome.length > 1 ? `${nome[0]} ${nome[nome.length - 1][0]}.` : nome[0] };
      });
    const relacionados = ativos().filter(x => x.id !== p.id && (x.banda === p.banda || x.categoria_id === p.categoria_id))
      .map(x => ({ x, r: Math.random() }))
      .sort((a, b) => (b.x.banda === p.banda) - (a.x.banda === p.banda) || (b.x.estoque > 0) - (a.x.estoque > 0) || a.r - b.r)
      .slice(0, 4).map(({ x }) => formatarProduto(x));
    const u = usuarioLogado();
    const podeAvaliar = !!u && comprou(u.id, p.id) && !banco.avaliacoes.some(a => a.usuario_id === u.id && a.produto_id === p.id);
    return { produto: formatarProduto(p), avaliacoes, relacionados, podeAvaliar };
  });

  rota('POST', /^\/api\/produtos\/(\d+)\/avaliacoes$/, (m, d) => {
    const u = exigirLogin();
    const produtoId = Number(m[1]);
    const nota = parseInt(d.nota, 10);
    const comentario = texto(d.comentario, 1000);
    if (!(nota >= 1 && nota <= 5)) falha(400, 'Escolha uma nota de 1 a 5 estrelas.');
    if (comentario.length < 10) falha(400, 'Escreva um comentário com pelo menos 10 caracteres.');
    if (!comprou(u.id, produtoId)) falha(403, 'Apenas clientes que compraram este produto podem avaliá-lo.');
    if (banco.avaliacoes.some(a => a.usuario_id === u.id && a.produto_id === produtoId)) falha(409, 'Você já avaliou este produto.');
    banco.avaliacoes.push({ id: proximoId('avaliacoes'), produto_id: produtoId, usuario_id: u.id, nota, comentario, visivel: 1, criado_em: iso(agora()) });
    salvar();
    return { mensagem: 'Obrigado pela avaliação!' };
  });

  // ------------------------------------------------------------------ Autenticação
  rota('GET', /^\/api\/auth\/me$/, () => {
    const u = usuarioLogado();
    return { usuario: u && !u.bloqueado ? dadosSessao(u) : null };
  });

  rota('POST', /^\/api\/auth\/cadastro$/, async (m, d) => {
    const nome = texto(d.nome, 120);
    const email = texto(d.email, 160).toLowerCase();
    const telefone = texto(d.telefone, 20);
    const senha = String(d.senha || '');
    const erros = {};
    if (nome.length < 3) erros.nome = 'Informe seu nome completo.';
    if (!emailValido(email)) erros.email = 'Informe um e-mail válido.';
    if (telefone && !telefoneValido(telefone)) erros.telefone = 'Informe um telefone com DDD.';
    if (senha.length < 6) erros.senha = 'A senha deve ter pelo menos 6 caracteres.';
    validar(erros);
    if (banco.usuarios.some(u => u.email === email)) falha(409, 'Este e-mail já está cadastrado.', { email: 'E-mail já cadastrado.' });
    const u = {
      id: proximoId('usuarios'), nome, email, senha_hash: await hashSenha(senha), telefone: telefone || null,
      perfil: 'cliente', bloqueado: 0, token_recuperacao: null, token_expira: null, criado_em: iso(agora())
    };
    banco.usuarios.push(u);
    salvar();
    localStorage.setItem(CHAVE_SESSAO, u.id);
    return { mensagem: 'Conta criada com sucesso!', usuario: dadosSessao(u) };
  });

  rota('POST', /^\/api\/auth\/login$/, async (m, d) => {
    const email = texto(d.email, 160).toLowerCase();
    const senha = String(d.senha || '');
    if (!email || !senha) falha(400, 'Informe e-mail e senha.');
    const u = banco.usuarios.find(x => x.email === email);
    if (!u || u.senha_hash !== await hashSenha(senha)) falha(401, 'E-mail ou senha incorretos.');
    if (u.bloqueado) falha(403, 'Esta conta está bloqueada. Fale com a loja pelo formulário de contato.');
    localStorage.setItem(CHAVE_SESSAO, u.id);
    return { mensagem: `Bem-vindo de volta, ${u.nome.split(' ')[0]}!`, usuario: dadosSessao(u) };
  });

  rota('POST', /^\/api\/auth\/logout$/, () => {
    localStorage.removeItem(CHAVE_SESSAO);
    return { mensagem: 'Você saiu da sua conta.' };
  });

  rota('PUT', /^\/api\/auth\/conta$/, async (m, d) => {
    const u = exigirLogin();
    const nome = texto(d.nome, 120);
    const telefone = texto(d.telefone, 20);
    const novaSenha = String(d.novaSenha || '');
    const erros = {};
    if (nome.length < 3) erros.nome = 'Informe seu nome completo.';
    if (telefone && !telefoneValido(telefone)) erros.telefone = 'Informe um telefone com DDD.';
    if (novaSenha && novaSenha.length < 6) erros.novaSenha = 'A nova senha deve ter pelo menos 6 caracteres.';
    validar(erros);
    if (novaSenha) {
      if (u.senha_hash !== await hashSenha(String(d.senhaAtual || ''))) falha(400, 'A senha atual está incorreta.', { senhaAtual: 'Senha atual incorreta.' });
      u.senha_hash = await hashSenha(novaSenha);
    }
    u.nome = nome;
    u.telefone = telefone || null;
    salvar();
    return { mensagem: 'Dados atualizados com sucesso!', usuario: dadosSessao(u) };
  });

  rota('POST', /^\/api\/auth\/recuperar$/, (m, d) => {
    const email = texto(d.email, 160).toLowerCase();
    if (!emailValido(email)) falha(400, 'Informe um e-mail válido.');
    const resposta = { mensagem: 'Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.' };
    const u = banco.usuarios.find(x => x.email === email);
    if (u) {
      const token = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
      u.token_recuperacao = token;
      u.token_expira = iso(Date.now() + 60 * 60 * 1000);
      salvar();
      resposta.linkSimulado = `recuperar-senha.html?token=${token}`;
    }
    return resposta;
  });

  rota('POST', /^\/api\/auth\/redefinir$/, async (m, d) => {
    const token = texto(d.token, 64);
    const senha = String(d.senha || '');
    if (senha.length < 6) falha(400, 'A senha deve ter pelo menos 6 caracteres.');
    const u = token && banco.usuarios.find(x => x.token_recuperacao === token && new Date(x.token_expira) > agora());
    if (!u) falha(400, 'Link inválido ou expirado. Peça um novo link.');
    u.senha_hash = await hashSenha(senha);
    u.token_recuperacao = null;
    u.token_expira = null;
    salvar();
    return { mensagem: 'Senha alterada! Agora é só entrar com a nova senha.' };
  });

  // ------------------------------------------------------------------ Pedidos
  const itensDoPedido = id => banco.itens_pedido.filter(i => i.pedido_id === id).map(i => {
    const p = banco.produtos.find(x => x.id === i.produto_id) || {};
    return { ...i, imagem: p.imagem, slug: p.slug };
  });

  // ------------------------------------------------------------------ Newsletter e cupons
  function verificarCupom(codigoInformado, emails, usuarioId) {
    const codigo = texto(codigoInformado, 20).toUpperCase();
    const cupom = CUPONS[codigo];
    if (!cupom) falha(400, 'Cupom inválido.', { cupom: 'Cupom inválido.' });
    const lista = emails.filter(Boolean).map(e => String(e).trim().toLowerCase());
    if (cupom.exigeNewsletter && !banco.newsletter.some(n => lista.includes(n.email))) {
      const msg = `Cadastre seu e-mail na newsletter (no rodapé do site) para liberar o cupom ${codigo}.`;
      falha(400, msg, { cupom: msg });
    }
    if (cupom.usoUnico && usuarioId && banco.pedidos.some(p => p.usuario_id === usuarioId && p.cupom === codigo)) {
      const msg = `Você já usou o cupom ${codigo} em outra compra.`;
      falha(400, msg, { cupom: msg });
    }
    return { codigo, percentual: cupom.percentual };
  }
  const calcularDesconto = (subtotal, percentual) => Math.round(subtotal * percentual) / 100;

  rota('POST', /^\/api\/newsletter$/, (m, d) => {
    const email = texto(d.email, 160).toLowerCase();
    if (!emailValido(email)) falha(400, 'Informe um e-mail válido.', { email: 'Informe um e-mail válido.' });
    if (!banco.newsletter.some(n => n.email === email)) banco.newsletter.push({ email, criado_em: iso(agora()) });
    salvar();
    return { mensagem: 'Inscrição confirmada! Use o cupom ROCK10 e ganhe 10% de desconto.', cupom: 'ROCK10' };
  });

  rota('POST', /^\/api\/cupons\/validar$/, (m, d) => {
    const u = usuarioLogado();
    return verificarCupom(d.codigo, [texto(d.email, 160), u && u.email], u ? u.id : null);
  });

  rota('GET', /^\/api\/pedidos$/, () => {
    const u = exigirLogin();
    return banco.pedidos.filter(p => p.usuario_id === u.id)
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
      .map(p => ({ ...p, itens: itensDoPedido(p.id) }));
  });

  rota('POST', /^\/api\/pedidos$/, (m, body) => {
    const u = exigirLogin();
    const d = {
      nome: texto(body.nome, 120), email: texto(body.email, 160).toLowerCase(), telefone: texto(body.telefone, 20),
      cep: texto(body.cep, 9), endereco: texto(body.endereco, 160), numero: texto(body.numero, 10),
      complemento: texto(body.complemento, 80), bairro: texto(body.bairro, 80), cidade: texto(body.cidade, 80),
      uf: texto(body.uf, 2).toUpperCase(), pagamento: texto(body.pagamento, 10)
    };
    const erros = {};
    if (d.nome.length < 3) erros.nome = 'Informe o nome completo.';
    if (!emailValido(d.email)) erros.email = 'Informe um e-mail válido.';
    if (!telefoneValido(d.telefone)) erros.telefone = 'Informe um telefone com DDD.';
    if (!/^\d{5}-?\d{3}$/.test(d.cep)) erros.cep = 'Informe um CEP válido (00000-000).';
    if (d.endereco.length < 3) erros.endereco = 'Informe o endereço.';
    if (!d.numero) erros.numero = 'Informe o número.';
    if (d.bairro.length < 2) erros.bairro = 'Informe o bairro.';
    if (d.cidade.length < 2) erros.cidade = 'Informe a cidade.';
    if (!UFS.includes(d.uf)) erros.uf = 'Selecione o estado.';
    if (!['pix', 'cartao', 'boleto'].includes(d.pagamento)) erros.pagamento = 'Escolha a forma de pagamento.';
    validar(erros);
    if (u.bloqueado) falha(403, 'Sua conta não pode realizar pedidos no momento.');

    const recebidos = Array.isArray(body.itens) ? body.itens.slice(0, 50) : [];
    if (!recebidos.length) falha(400, 'Seu carrinho está vazio.');

    const agrupados = new Map();
    for (const it of recebidos) {
      const id = parseInt(it.id, 10);
      const qtd = parseInt(it.quantidade, 10);
      const tamanho = it.tamanho ? texto(it.tamanho, 2).toUpperCase() : null;
      if (!id || !(qtd > 0 && qtd <= 20)) falha(400, 'Há itens inválidos no carrinho.');
      const chave = `${id}|${tamanho || ''}`;
      agrupados.set(chave, { id, tamanho, quantidade: ((agrupados.get(chave) || {}).quantidade || 0) + qtd });
    }
    const porProduto = new Map();
    const itens = [];
    for (const it of agrupados.values()) {
      const p = ativos().find(x => x.id === it.id);
      if (!p) falha(409, 'Um dos produtos do carrinho não está mais disponível.');
      if (p.tem_tamanhos && !TAMANHOS.includes(it.tamanho)) falha(400, `Escolha o tamanho de "${p.nome}".`);
      porProduto.set(p.id, (porProduto.get(p.id) || 0) + it.quantidade);
      itens.push({ p, tamanho: p.tem_tamanhos ? it.tamanho : null, quantidade: it.quantidade, preco: precoAtual(p) });
    }
    for (const [id, qtd] of porProduto) {
      const p = banco.produtos.find(x => x.id === id);
      if (p.estoque < qtd) {
        falha(409, p.estoque === 0
          ? `"${p.nome}" acabou de esgotar. Remova-o do carrinho para continuar.`
          : `Só temos ${p.estoque} unidade(s) de "${p.nome}" em estoque.`);
      }
    }
    const subtotal = arred(itens.reduce((s, i) => s + i.preco * i.quantidade, 0));
    const frete = subtotal >= FRETE_GRATIS_A_PARTIR ? 0 : FRETE_FIXO;
    const cupom = body.cupom ? verificarCupom(body.cupom, [d.email, u.email], u.id) : null;
    const desconto = cupom ? calcularDesconto(subtotal, cupom.percentual) : 0;
    const total = arred(subtotal - desconto + frete);
    const id = proximoId('pedidos');
    if (d.cep.length === 8) d.cep = `${d.cep.slice(0, 5)}-${d.cep.slice(5)}`;
    banco.pedidos.push({
      id, usuario_id: u.id, nome_cliente: d.nome, email: d.email, telefone: d.telefone, cep: d.cep, endereco: d.endereco,
      numero: d.numero, complemento: d.complemento || null, bairro: d.bairro, cidade: d.cidade, uf: d.uf,
      forma_pagamento: d.pagamento, subtotal, frete, cupom: cupom ? cupom.codigo : null, desconto, total,
      status: 'recebido', criado_em: iso(agora())
    });
    for (const i of itens) {
      banco.itens_pedido.push({ id: proximoId('itens_pedido'), pedido_id: id, produto_id: i.p.id, nome_produto: i.p.nome, tamanho: i.tamanho, quantidade: i.quantidade, preco_unitario: i.preco });
    }
    for (const [pid, qtd] of porProduto) banco.produtos.find(x => x.id === pid).estoque -= qtd;
    salvar();
    return { mensagem: 'Pedido registrado com sucesso!', pedido: { id, subtotal, frete, desconto, total } };
  });

  // ------------------------------------------------------------------ Contato e configurações
  rota('POST', /^\/api\/mensagens$/, (m, d) => {
    const nome = texto(d.nome, 120);
    const email = texto(d.email, 160).toLowerCase();
    const assunto = texto(d.assunto, 40);
    const mensagem = texto(d.mensagem, 2000);
    const erros = {};
    if (nome.length < 3) erros.nome = 'Informe seu nome.';
    if (!emailValido(email)) erros.email = 'Informe um e-mail válido.';
    if (!ASSUNTOS.includes(assunto)) erros.assunto = 'Escolha um assunto.';
    if (mensagem.length < 10) erros.mensagem = 'A mensagem deve ter pelo menos 10 caracteres.';
    validar(erros);
    banco.mensagens.push({ id: proximoId('mensagens'), nome, email, assunto, mensagem, lida: 0, criado_em: iso(agora()) });
    salvar();
    return { mensagem: 'Mensagem enviada! Responderemos em até 2 dias úteis.' };
  });

  rota('GET', /^\/api\/configuracoes$/, () => copia(banco.configuracoes));

  // ------------------------------------------------------------------ Painel administrativo
  rota('GET', /^\/api\/admin\/resumo$/, () => {
    exigirAdmin();
    const hoje = new Date().toDateString();
    const prods = ativos();
    const dia = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    const vendas = {};
    banco.pedidos.filter(p => Date.now() - new Date(p.criado_em) < 7 * DIA).forEach(p => {
      const k = dia(p.criado_em);
      vendas[k] = vendas[k] || { dia: k, pedidos: 0, total: 0 };
      vendas[k].pedidos++;
      vendas[k].total = arred(vendas[k].total + p.total);
    });
    return {
      produtos: { total: prods.length, esgotados: prods.filter(p => p.estoque === 0).length, estoqueBaixo: prods.filter(p => p.estoque >= 1 && p.estoque <= 5).length },
      pedidos: {
        hoje: banco.pedidos.filter(p => new Date(p.criado_em).toDateString() === hoje).length,
        aguardando: banco.pedidos.filter(p => p.status === 'recebido').length,
        faturamento30: arred(banco.pedidos.filter(p => Date.now() - new Date(p.criado_em) < 30 * DIA).reduce((s, p) => s + p.total, 0))
      },
      usuarios: banco.usuarios.filter(u => u.perfil === 'cliente').length,
      mensagensNaoLidas: banco.mensagens.filter(x => !x.lida).length,
      recentes: [...banco.pedidos].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em)).slice(0, 6)
        .map(p => ({ id: p.id, nome_cliente: p.nome_cliente, total: p.total, status: p.status, criado_em: p.criado_em })),
      vendas: Object.values(vendas).sort((a, b) => a.dia.localeCompare(b.dia))
    };
  });

  rota('GET', /^\/api\/admin\/produtos$/, () => {
    exigirAdmin();
    return [...banco.produtos].sort((a, b) => b.ativo - a.ativo || b.id - a.id).map(p => ({
      ...formatarProduto(p), categoriaId: p.categoria_id,
      precoPromocional: p.preco_promocional !== null ? Number(p.preco_promocional) : null,
      promocaoFimBruto: p.promocao_fim, ativo: !!p.ativo
    }));
  });

  function lerProduto(b) {
    const p = {
      nome: texto(b.nome, 140), banda: texto(b.banda, 80), categoria_id: parseInt(b.categoriaId, 10),
      descricao: texto(b.descricao, 3000), detalhes: texto(b.detalhes, 2000) || null, faixas: texto(b.faixas, 3000) || null,
      ano: b.ano ? parseInt(b.ano, 10) : null, preco: parseFloat(b.preco),
      preco_promocional: b.precoPromocional !== '' && b.precoPromocional !== null && b.precoPromocional !== undefined ? parseFloat(b.precoPromocional) : null,
      promocao_fim: b.promocaoFim ? iso(b.promocaoFim) : null, estoque: parseInt(b.estoque, 10),
      tem_tamanhos: b.temTamanhos ? 1 : 0, imagem: texto(b.imagem, 255), galeria: texto(b.galeria, 1000) || null,
      audio_preview: texto(b.audio, 255) || null, destaque: b.destaque ? 1 : 0, ativo: b.ativo === false ? 0 : 1
    };
    const erros = {};
    if (p.nome.length < 3) erros.nome = 'Informe o nome do produto.';
    if (!p.banda) erros.banda = 'Informe a banda (ou "Riff Store").';
    if (!banco.categorias.some(c => c.id === p.categoria_id)) erros.categoriaId = 'Escolha a categoria.';
    if (p.descricao.length < 10) erros.descricao = 'Escreva uma descrição.';
    if (!(p.preco > 0)) erros.preco = 'Informe um preço maior que zero.';
    if (p.preco_promocional !== null) {
      if (!(p.preco_promocional > 0 && p.preco_promocional < p.preco)) erros.precoPromocional = 'O preço promocional deve ser menor que o preço normal.';
      if (!p.promocao_fim) erros.promocaoFim = 'Informe até quando vale a promoção.';
    } else {
      p.promocao_fim = null;
    }
    if (!(p.estoque >= 0)) erros.estoque = 'Informe o estoque (0 ou mais).';
    if (p.ano !== null && !(p.ano >= 1900 && p.ano <= 2100)) erros.ano = 'Ano inválido.';
    if (!p.imagem) erros.imagem = 'Informe o caminho da imagem.';
    validar(erros);
    return p;
  }

  rota('POST', /^\/api\/admin\/produtos$/, (m, d) => {
    exigirAdmin();
    const p = lerProduto(d);
    let slug = gerarSlug(p.nome);
    if (banco.produtos.some(x => x.slug === slug)) slug = `${slug}-${Date.now().toString(36)}`;
    const id = proximoId('produtos');
    banco.produtos.push({ id, slug, ...p, criado_em: iso(agora()) });
    salvar();
    return { mensagem: 'Produto cadastrado!', id };
  });

  const acharProduto = id => banco.produtos.find(x => x.id === Number(id)) || falha(404, 'Produto não encontrado.');

  rota('PUT', /^\/api\/admin\/produtos\/(\d+)$/, (m, d) => {
    exigirAdmin();
    Object.assign(acharProduto(m[1]), lerProduto(d));
    salvar();
    return { mensagem: 'Produto atualizado!' };
  });

  rota('PATCH', /^\/api\/admin\/produtos\/(\d+)$/, (m, d) => {
    exigirAdmin();
    const p = acharProduto(m[1]);
    if (d.estoque !== undefined) {
      const e = parseInt(d.estoque, 10);
      if (!(e >= 0)) falha(400, 'Estoque inválido.');
      p.estoque = e;
    }
    if (d.destaque !== undefined) p.destaque = d.destaque ? 1 : 0;
    if (d.ativo !== undefined) p.ativo = d.ativo ? 1 : 0;
    if (d.encerrarPromocao) { p.preco_promocional = null; p.promocao_fim = null; }
    salvar();
    return { mensagem: 'Produto atualizado!' };
  });

  rota('DELETE', /^\/api\/admin\/produtos\/(\d+)$/, (m) => {
    exigirAdmin();
    const p = acharProduto(m[1]);
    if (banco.itens_pedido.some(i => i.produto_id === p.id)) {
      p.ativo = 0;
      salvar();
      return { mensagem: 'O produto já tem vendas, então foi desativado (sai da loja, mas fica no histórico).' };
    }
    banco.produtos = banco.produtos.filter(x => x.id !== p.id);
    banco.avaliacoes = banco.avaliacoes.filter(a => a.produto_id !== p.id);
    salvar();
    return { mensagem: 'Produto excluído.' };
  });

  rota('GET', /^\/api\/admin\/pedidos$/, (m, q) => {
    exigirAdmin();
    return banco.pedidos.filter(p => !STATUS.includes(q.status) || p.status === q.status)
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
      .map(p => ({ ...p, itens: banco.itens_pedido.filter(i => i.pedido_id === p.id) }));
  });

  rota('PATCH', /^\/api\/admin\/pedidos\/(\d+)$/, (m, d) => {
    exigirAdmin();
    if (!STATUS.includes(d.status)) falha(400, 'Status inválido.');
    const p = banco.pedidos.find(x => x.id === Number(m[1])) || falha(404, 'Pedido não encontrado.');
    p.status = d.status;
    salvar();
    return { mensagem: 'Status do pedido atualizado!' };
  });

  rota('GET', /^\/api\/admin\/usuarios$/, () => {
    exigirAdmin();
    return [...banco.usuarios].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em)).map(u => {
      const pedidos = banco.pedidos.filter(p => p.usuario_id === u.id);
      return {
        id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, perfil: u.perfil, bloqueado: u.bloqueado, criado_em: u.criado_em,
        pedidos: pedidos.length, totalGasto: arred(pedidos.reduce((s, p) => s + p.total, 0))
      };
    });
  });

  rota('PATCH', /^\/api\/admin\/usuarios\/(\d+)$/, (m, d) => {
    const admin = exigirAdmin();
    const id = Number(m[1]);
    if (id === admin.id) falha(400, 'Você não pode bloquear a própria conta.');
    const u = banco.usuarios.find(x => x.id === id && x.perfil === 'cliente') || falha(404, 'Cliente não encontrado.');
    u.bloqueado = d.bloqueado ? 1 : 0;
    salvar();
    return { mensagem: d.bloqueado ? 'Conta bloqueada.' : 'Conta desbloqueada.' };
  });

  rota('GET', /^\/api\/admin\/avaliacoes$/, () => {
    exigirAdmin();
    return [...banco.avaliacoes].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em)).map(a => {
      const p = banco.produtos.find(x => x.id === a.produto_id);
      return { id: a.id, nota: a.nota, comentario: a.comentario, visivel: a.visivel, criado_em: a.criado_em, cliente: banco.usuarios.find(u => u.id === a.usuario_id).nome, produto: p.nome, slug: p.slug };
    });
  });

  rota('PATCH', /^\/api\/admin\/avaliacoes\/(\d+)$/, (m, d) => {
    exigirAdmin();
    const a = banco.avaliacoes.find(x => x.id === Number(m[1])) || falha(404, 'Avaliação não encontrada.');
    a.visivel = d.visivel ? 1 : 0;
    salvar();
    return { mensagem: d.visivel ? 'Avaliação visível na loja.' : 'Avaliação ocultada.' };
  });

  rota('GET', /^\/api\/admin\/mensagens$/, () => {
    exigirAdmin();
    return [...banco.mensagens].sort((a, b) => a.lida - b.lida || new Date(b.criado_em) - new Date(a.criado_em));
  });

  rota('PATCH', /^\/api\/admin\/mensagens\/(\d+)$/, (m, d) => {
    exigirAdmin();
    const x = banco.mensagens.find(y => y.id === Number(m[1])) || falha(404, 'Mensagem não encontrada.');
    x.lida = d.lida ? 1 : 0;
    salvar();
    return { mensagem: 'Mensagem atualizada.' };
  });

  rota('DELETE', /^\/api\/admin\/mensagens\/(\d+)$/, (m) => {
    exigirAdmin();
    const antes = banco.mensagens.length;
    banco.mensagens = banco.mensagens.filter(y => y.id !== Number(m[1]));
    if (banco.mensagens.length === antes) falha(404, 'Mensagem não encontrada.');
    salvar();
    return { mensagem: 'Mensagem excluída.' };
  });

  rota('PUT', /^\/api\/admin\/configuracoes$/, (m, d) => {
    exigirAdmin();
    CHAVES_CONFIG.forEach(k => { if (d[k] !== undefined) banco.configuracoes[k] = texto(d[k], 255); });
    salvar();
    return { mensagem: 'Configurações salvas!' };
  });

  // Volta os dados ao estado inicial (útil antes de uma apresentação)
  rota('POST', /^\/api\/admin\/restaurar$/, async () => {
    exigirAdmin();
    const admin = usuarioLogado();
    banco = await criarBanco();
    salvar();
    localStorage.setItem(CHAVE_SESSAO, admin.id);
    return { mensagem: 'Dados de demonstração restaurados!' };
  });

  // ------------------------------------------------------------------ Roteador
  async function requisicao(metodo, url, dados) {
    await carregarBanco();
    const [caminho, qs] = url.split('?');
    const q = { ...Object.fromEntries(new URLSearchParams(qs || '')), ...(metodo === 'GET' ? dados || {} : {}) };
    const corpo = metodo === 'GET' ? {} : copia(dados || {});
    for (const r of rotas) {
      if (r.metodo !== metodo) continue;
      const m = caminho.match(r.padrao);
      if (m) return copia(await r.fn(m, metodo === 'GET' ? q : corpo));
    }
    falha(404, 'Rota não encontrada.');
  }

  window.RS_API_LOCAL = function (metodo, url, dados) {
    return new Promise((resolve, reject) => {
      // pequeno atraso para imitar a resposta de um servidor
      setTimeout(() => {
        requisicao(metodo, url, dados).then(resolve).catch(e => {
          if (e instanceof ErroApi) reject({ status: e.status, erro: e.erro, campos: e.campos });
          else { console.error(e); reject({ status: 500, erro: 'Ocorreu um erro inesperado. Tente novamente.', campos: {} }); }
        });
      }, 120);
    });
  };
})();
