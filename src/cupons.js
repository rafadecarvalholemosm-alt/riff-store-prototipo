// Cupons de desconto. ROCK10: 10% sobre os produtos, liberado para quem cadastrou o
// e-mail na newsletter e válido uma vez por conta. O frete é calculado sobre o subtotal
// sem desconto (a regra do frete grátis não muda).
const CUPONS = {
  ROCK10: { percentual: 10, exigeNewsletter: true, usoUnico: true }
};

class ErroCupom extends Error {}

// Confere o cupom. emails: e-mails do cliente (o do pedido e o da conta); usuarioId: cliente logado ou null.
// Devolve { codigo, percentual } ou lança ErroCupom com a mensagem para o cliente.
async function verificarCupom(conn, codigoInformado, emails, usuarioId) {
  const codigo = String(codigoInformado || '').trim().toUpperCase();
  const cupom = CUPONS[codigo];
  if (!cupom) throw new ErroCupom('Cupom inválido.');

  const lista = [...new Set(emails.filter(Boolean).map(e => String(e).trim().toLowerCase()))];
  if (cupom.exigeNewsletter) {
    const [linhas] = lista.length
      ? await conn.query('SELECT email FROM newsletter WHERE email IN (?)', [lista])
      : [[]];
    if (!linhas.length) throw new ErroCupom(`Cadastre seu e-mail na newsletter (no rodapé do site) para liberar o cupom ${codigo}.`);
  }
  if (cupom.usoUnico && usuarioId) {
    const [[uso]] = await conn.query('SELECT COUNT(*) AS total FROM pedidos WHERE usuario_id = ? AND cupom = ?', [usuarioId, codigo]);
    if (uso.total) throw new ErroCupom(`Você já usou o cupom ${codigo} em outra compra.`);
  }
  return { codigo, percentual: cupom.percentual };
}

const calcularDesconto = (subtotal, percentual) => Math.round(subtotal * percentual) / 100;

module.exports = { verificarCupom, calcularDesconto, ErroCupom };
