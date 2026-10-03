// Utilitários das abas do Workspace. Todo texto vindo da API (fichas do Maps, títulos de sites,
// mensagens recebidas) é dado de terceiros: sempre passa por esc() antes de virar HTML.
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pct = (p) => `${Math.round(p * 100)}%`;
export const dois = (n) => String(n ?? 0).padStart(2, '0');
export const quando = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
export const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

export async function api(caminho, corpo) {
  const r = await fetch(caminho, corpo === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
  return j;
}

// etapas do lead em português, com o dono (a cor do agente marca o cartão)
export const ETAPAS = [
  ['descoberto', 'Descobertos', 'atlas', 'O Atlas achou; falta auditar o site'],
  ['auditado', 'Auditados', 'nova', 'Site medido; a Nova decide'],
  ['qualificado', 'Qualificados', 'maia', 'Vale a pena; a Maia escreve'],
  ['mensagem', 'Para aprovar', 'operador', 'Esperando você'],
  ['aprovado', 'Na fila', 'leo', 'O Leo envia no ritmo seguro'],
  ['enviado', 'Enviados', 'leo', 'Esperando resposta'],
  ['respondeu', 'Responderam', 'leo', 'Conversa aberta'],
];
export const ETAPAS_FORA = [['sem_contato', 'Sem telefone'], ['sem_resposta', 'Sem resposta'], ['descartado', 'Descartados'], ['nao_contatar', 'Pediram para sair']];

export const vazio = (titulo, texto, acao = '') => `<div class="o-vazio"><strong>${esc(titulo)}</strong><p>${esc(texto)}</p>${acao}</div>`;

// atualiza a cada `ms` só com a aba visível (nada de trabalho com a aba escondida).
// A primeira carga roda sempre: página aberta em segundo plano não pode ficar vazia.
export function aCada(ms, fn) {
  let t = null;
  // erro não pode sumir calado: vai para o console e a próxima volta tenta de novo
  const rodar = async (forcar = false) => { if (forcar || !document.hidden) { try { await fn(); } catch (e) { console.error('[atualização]', e); } } t = setTimeout(rodar, ms); };
  rodar(true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { clearTimeout(t); rodar(); } });
}
