// Quantas empresas buscar para sustentar o envio diário. O limite de MENSAGENS é um número que o Victor escolhe (Ajustes);
// o de BUSCA se calcula: nem toda empresa achada vira mensagem (tem site bom, sem telefone celular, você descarta...).
//   empresas por dia = mensagens por dia ÷ taxa de aproveitamento
// A taxa vem dos leads reais já resolvidos. Com poucos leads usa uma taxa de partida, marcada como estimativa.
import { lerAjustes } from './db.mjs';

export const TAXA_DE_PARTIDA = 0.4; // vale até haver amostra; calibrada pelo que se viu nos primeiros lotes
export const AMOSTRA_MINIMA = 30;
const AINDA_NO_FLUXO = ['descoberto', 'auditado']; // sem resposta dos agentes ainda: não entra na conta
const PERDIDOS = ['descartado', 'sem_contato', 'nao_contatar'];

export function taxaDeAproveitamento(db) {
  const placeholders = (l) => l.map(() => '?').join(',');
  const resolvidos = db.prepare(`SELECT COUNT(*) n FROM leads WHERE etapa NOT IN (${placeholders(AINDA_NO_FLUXO)})`).get(...AINDA_NO_FLUXO).n;
  const aproveitados = db.prepare(`SELECT COUNT(*) n FROM leads WHERE etapa NOT IN (${placeholders([...AINDA_NO_FLUXO, ...PERDIDOS])})`).get(...AINDA_NO_FLUXO, ...PERDIDOS).n;
  const real = resolvidos >= AMOSTRA_MINIMA;
  const taxa = real ? Math.max(aproveitados / resolvidos, 0.05) : TAXA_DE_PARTIDA;
  return { taxa, resolvidos, aproveitados, estimativa: !real };
}

export function calcularCapacidade(db, { metaDia = null, porLote = 50 } = {}) {
  const ajustes = lerAjustes(db);
  const meta = Math.max(1, Math.round(Number(metaDia) || ajustes.envio.limite_diario));
  const t = taxaDeAproveitamento(db);
  const empresasPorDia = Math.ceil(meta / t.taxa);
  return {
    mensagens_por_dia: meta,
    taxa: Math.round(t.taxa * 100) / 100,
    leads_na_conta: t.resolvidos,
    estimativa: t.estimativa,
    empresas_por_dia: empresasPorDia,
    lotes_por_dia: Math.ceil(empresasPorDia / porLote),
    por_lote: porLote,
    dias_de_envio_por_semana: ajustes.envio.dias_semana.length,
  };
}

export function fraseDaCapacidade(c) {
  const base = `Para enviar ${c.mensagens_por_dia} mensagens por dia, busque cerca de ${c.empresas_por_dia} empresas por dia (${c.lotes_por_dia} lote${c.lotes_por_dia > 1 ? 's' : ''} de ${c.por_lote}).`;
  const como = c.estimativa
    ? `Estimativa inicial de ${Math.round(c.taxa * 100)}% de aproveitamento: ainda há só ${c.leads_na_conta} leads resolvidos. O número se ajusta sozinho conforme os agentes tratam mais empresas.`
    : `Aproveitamento real de ${Math.round(c.taxa * 100)}% em ${c.leads_na_conta} leads.`;
  return `${base} ${como}`;
}
