// Controlador (Meta-Reasoning, arXiv 2609.38147): antes de um agente pegar mais trabalho, pesa se
// vale a pena com o orçamento que existe. Aqui o orçamento real é o teto de envios por dia: escrever
// 40 mensagens quando só 10 saem por dia gera fila velha; varrer mais quando já há leads para dias
// só gasta o Maps. O paper avisa que controle sofisticado pode não compensar com orçamento pequeno,
// então o modo é "regra": limites de estoque explícitos, com as opções e valores registrados.
import { lerAjustes, salvarFlag } from '../db.mjs';
import { registrar } from '../eventos.mjs';
import { exigir } from './contratos.mjs';

export const CONTROLADOS = new Set(['varrer', 'redigir']);
export const DIAS_DE_ESTOQUE = { mensagens: 2, leads: 4 };

const conta = (db, sql, ...a) => db.prepare(sql).get(...a).n;

export function orcamento(db) {
  const limite = lerAjustes(db).envio.limite_diario;
  return {
    envios_por_dia: limite,
    aguardando_aprovacao: conta(db, "SELECT COUNT(*) n FROM leads WHERE etapa = 'mensagem'")
      + conta(db, "SELECT COUNT(*) n FROM envios WHERE status = 'aprovado'"),
    prontos_para_escrever: conta(db, "SELECT COUNT(*) n FROM leads WHERE etapa IN ('descoberto', 'auditado', 'qualificado')"),
  };
}

// chance de resposta com prior de Laplace: começa em 50% e aprende com os envios reais
export function taxaResposta(db) {
  const r = db.prepare(`SELECT SUM(etapa IN ('respondeu', 'fechado', 'perdido')) resp, SUM(etapa IN ('enviado', 'sem_resposta', 'respondeu', 'fechado', 'perdido', 'nao_contatar')) env FROM leads`).get();
  return ((r.resp || 0) + 1) / ((r.env || 0) + 2);
}

export function decidir(db, laco, ciclo = 0) {
  const o = orcamento(db);
  const p = +taxaResposta(db).toFixed(3);
  const tetoMsgs = DIAS_DE_ESTOQUE.mensagens * o.envios_por_dia;
  const tetoLeads = DIAS_DE_ESTOQUE.leads * o.envios_por_dia;
  let opcoes, escolhida, motivo;
  if (laco === 'redigir') {
    const cheio = o.aguardando_aprovacao >= tetoMsgs;
    opcoes = [{ acao: 'redigir', p_sucesso: p, ganho: 1, custo: cheio ? 1 : 0 }, { acao: 'esperar', p_sucesso: 1, ganho: 0, custo: 0 }];
    escolhida = cheio ? 'esperar' : 'redigir';
    motivo = cheio
      ? `${o.aguardando_aprovacao} mensagens esperando você (teto: ${tetoMsgs}, ${DIAS_DE_ESTOQUE.mensagens} dias de envio)`
      : `${o.aguardando_aprovacao} de ${tetoMsgs} mensagens em estoque`;
  } else if (laco === 'varrer') {
    const estoque = o.prontos_para_escrever + o.aguardando_aprovacao;
    const cheio = estoque >= tetoLeads;
    opcoes = [{ acao: 'varrer', p_sucesso: p, ganho: 1, custo: cheio ? 1 : 0 }, { acao: 'parar_varredura', p_sucesso: 1, ganho: 0, custo: 0 }];
    escolhida = cheio ? 'parar_varredura' : 'varrer';
    motivo = cheio ? `${estoque} leads em preparo dão para ${DIAS_DE_ESTOQUE.leads}+ dias (teto: ${tetoLeads})` : `${estoque} de ${tetoLeads} leads em estoque`;
  } else {
    throw new Error(`laço sem controle: ${laco}`);
  }
  return exigir('decisao-controlador', { ciclo, laco, opcoes, escolhida, orcamento: o, modo: 'regra', motivo });
}

export function criarControlador(db, { cacheMs = 10_000, relogio = Date.now } = {}) {
  const ultimas = {};
  let ciclo = 0;
  return {
    permite(laco) {
      if (!CONTROLADOS.has(laco)) return true;
      const u = ultimas[laco];
      if (!u || relogio() - u.em > cacheMs) {
        const d = decidir(db, laco, ++ciclo);
        if (!u || u.d.escolhida !== d.escolhida) {
          const agente = laco === 'varrer' ? 'atlas' : 'maia';
          const pausa = d.escolhida === 'esperar' || d.escolhida === 'parar_varredura';
          registrar(db, 'alva', 'controlador', `${pausa ? 'Segurei' : 'Liberei'} ${agente === 'atlas' ? 'o Atlas (varredura)' : 'a Maia (escrita)'}: ${d.motivo}`, { dados: d });
        }
        ultimas[laco] = { d, em: relogio() };
        salvarFlag(db, 'controlador', Object.fromEntries(Object.entries(ultimas).map(([k, v]) => [k, v.d])));
      }
      const e = ultimas[laco].d.escolhida;
      return e === 'redigir' || e === 'varrer';
    },
    ultimas: () => Object.fromEntries(Object.entries(ultimas).map(([k, v]) => [k, v.d])),
  };
}
