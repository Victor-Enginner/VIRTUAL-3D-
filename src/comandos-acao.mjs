// O que os comandos de voz novos fazem no banco. Fica fora do server.mjs para ser testável sem subir HTTP.
export const LIMITE_QUENTE = 70; // prioridade (0-100) a partir da qual o lead conta como quente
const ENCERRADOS = "('descartado', 'nao_contatar', 'perdido')";

export function contarQuentes(db) {
  const quentes = db.prepare(`SELECT COUNT(*) n FROM leads WHERE score >= ? AND etapa NOT IN ${ENCERRADOS}`).get(LIMITE_QUENTE).n;
  const para_aprovar = db.prepare("SELECT COUNT(*) n FROM leads WHERE etapa = 'mensagem'").get().n;
  return { quentes, para_aprovar };
}

// o próximo cartão é o de maior prioridade esperando decisão; empate → o mais antigo
export const proximoCartao = (db) => db.prepare("SELECT * FROM leads WHERE etapa = 'mensagem' ORDER BY score IS NULL, score DESC, criado_em ASC LIMIT 1").get() || null;

// "trocar a cidade": copia o ramo/fonte das varreduras ativas (ou, sem nenhuma ativa, da mais recente) para a cidade nova
// e desativa as de outras cidades. Não apaga nada.
export function trocarCidade(db, cidade, uf, criar, pais = 'BR') {
  let base = db.prepare('SELECT nicho, fonte, limite, cidade, uf FROM varreduras WHERE ativa = 1').all();
  if (!base.length) base = db.prepare('SELECT nicho, fonte, limite, cidade, uf FROM varreduras ORDER BY id DESC LIMIT 1').all();
  if (!base.length) return { base: 0, criadas: 0, desativadas: 0 };
  // um pedido por ramo+fonte (a mesma busca em duas cidades antigas vira uma só na cidade nova); o portão de lotes pode recusar algum
  const unicas = [...new Map(base.map((b) => [`${b.nicho}|${b.fonte}`, b])).values()];
  let criadas = 0, bloqueadas = 0;
  for (const b of unicas) {
    try { criar({ cidade, uf, pais, nicho: b.nicho, fonte: b.fonte, limite: b.limite }); criadas++; }
    catch (e) { if (e.status !== 409) throw e; bloqueadas++; }
  }
  const desativadas = db.prepare('UPDATE varreduras SET ativa = 0 WHERE ativa = 1 AND NOT (cidade = ? AND uf = ?)').run(cidade, uf).changes;
  return { base: base.length, criadas, desativadas, bloqueadas };
}
