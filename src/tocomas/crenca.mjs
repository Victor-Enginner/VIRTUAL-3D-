// Belief state explícito por lead (PoS, arXiv 2610.01415): o que os agentes sabem agora, de onde
// veio, até quando vale, e o que ainda falta. "Preso" (Belief Trapping) = continuar agindo sem
// progresso; detectado pelos 3 sinais do paper numa janela de ciclos (ver diagnosticar).
import { agora, json, parse } from '../db.mjs';
import { exigir } from './contratos.mjs';

// quanto tempo cada fato continua valendo (dias)
export const VALIDADE_DIAS = {
  telefone: 180, site: 30, rating: 14, avaliacoes: 14,
  situacao_site: 30, sinais_atraso: 30,
  nivel_oportunidade: 30, ativo: 30, angulo: 30,
};
export const LIMITE_PRESO = 3; // ciclos de estagnação ou de lacuna persistente
export const LIMITE_RECORRENCIA = 2; // voltas a um estado já visto (A→B→A→B)
export const JANELA = 4;
// etapas em que o lead ainda está sendo trabalhado pelos agentes (fora delas não há lacuna ativa)
const EM_TRABALHO = new Set(['descoberto', 'auditado', 'qualificado']);

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const vencido = (f, quando) => f.valido_ate && f.valido_ate < quando;

function ler(db, leadId) {
  const r = db.prepare('SELECT * FROM crencas WHERE lead_id = ?').get(leadId);
  return r
    ? { ...r, fatos: parse(r.fatos, []), conflitos: parse(r.conflitos, []), preso: Boolean(r.preso), bloqueio: parse(r.bloqueio),
      historico: parse(r.historico, []), diagnostico: parse(r.diagnostico) }
    : { lead_id: leadId, versao: 0, fatos: [], conflitos: [], ciclos_sem_novidade: 0, preso: false, motivo: null, bloqueio: null, historico: [], diagnostico: null };
}

function salvar(db, c) {
  const ouNulo = (v) => (v ? json(v) : null);
  db.prepare(`INSERT INTO crencas (lead_id, versao, fatos, conflitos, ciclos_sem_novidade, preso, motivo, bloqueio, historico, diagnostico, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(lead_id) DO UPDATE SET versao = excluded.versao, fatos = excluded.fatos,
    conflitos = excluded.conflitos, ciclos_sem_novidade = excluded.ciclos_sem_novidade, preso = excluded.preso,
    motivo = excluded.motivo, bloqueio = excluded.bloqueio, historico = excluded.historico, diagnostico = excluded.diagnostico,
    atualizado_em = excluded.atualizado_em`)
    .run(c.lead_id, c.versao, json(c.fatos), json(c.conflitos), c.ciclos_sem_novidade, c.preso ? 1 : 0, c.motivo,
      ouNulo(c.bloqueio), c.historico?.length ? json(c.historico) : null, ouNulo(c.diagnostico), agora());
}

// Registra fatos novos. Valor nulo não é fato (vira pendência). Mesmo valor só renova a data;
// valor diferente vindo de outra fonte enquanto o antigo ainda vale = conflito.
export function registrarFatos(db, leadId, fatos, quando = agora()) {
  const c = ler(db, leadId);
  let novidade = false;
  for (const f of fatos) {
    if (f.valor == null || (Array.isArray(f.valor) && !f.valor.length && f.chave !== 'sinais_atraso')) continue;
    const dias = VALIDADE_DIAS[f.chave];
    const novo = exigir('fato', {
      chave: f.chave, valor: f.valor, fonte: f.fonte, observado_em: quando,
      valido_ate: dias ? new Date(Date.parse(quando) + dias * 86_400_000).toISOString() : null,
      confianca: f.confianca ?? 1,
    });
    const i = c.fatos.findIndex((x) => x.chave === f.chave);
    const antigo = c.fatos[i];
    if (!antigo) { c.fatos.push(novo); novidade = true; continue; }
    if (igual(antigo.valor, novo.valor)) {
      if (vencido(antigo, quando)) novidade = true; // reconfirmar fato vencido é progresso
      c.fatos[i] = novo;
      continue;
    }
    if (!vencido(antigo, quando) && antigo.fonte !== novo.fonte && !c.conflitos.includes(f.chave)) c.conflitos.push(f.chave);
    c.fatos[i] = novo;
    novidade = true;
  }
  if (novidade) c.versao += 1;
  salvar(db, c);
  return { versao: c.versao, novidade, conflitos: c.conflitos };
}

export function resolverConflito(db, leadId, chave) {
  const c = ler(db, leadId);
  c.conflitos = c.conflitos.filter((k) => k !== chave);
  salvar(db, c);
}

export function pendencias(c, etapa, quando = agora()) {
  const p = [];
  const valido = (k) => c.fatos.some((f) => f.chave === k && !vencido(f, quando));
  for (const k of ['telefone', 'situacao_site']) if (!valido(k)) p.push({ chave: k, tipo: 'falta_dado' });
  for (const f of c.fatos) if (vencido(f, quando) && !p.some((x) => x.chave === f.chave)) p.push({ chave: f.chave, tipo: 'falta_dado' });
  for (const k of c.conflitos) p.push({ chave: k, tipo: 'conflito' });
  if (c.bloqueio) p.push({ chave: c.bloqueio.para, tipo: 'handoff_bloqueado', falta: c.bloqueio.falta.map((f) => f.chave) });
  if (etapa === 'mensagem') p.push({ chave: 'aprovacao', tipo: 'aguardando_humano' });
  if (etapa === 'enviado') p.push({ chave: 'resposta', tipo: 'aguardando_resposta' });
  return p;
}

// contrato "crenca" completo, como os outros agentes e a tela recebem
export function lerCrenca(db, leadId, etapa = null, quando = agora()) {
  const c = ler(db, leadId);
  return exigir('crenca', {
    lead_id: leadId, versao: c.versao, fatos: c.fatos, pendencias: pendencias(c, etapa, quando),
    progresso: { ciclos_sem_novidade: c.ciclos_sem_novidade, preso: c.preso, ...(c.motivo ? { motivo: c.motivo } : {}), ...(c.diagnostico ? { diagnostico: c.diagnostico } : {}) },
  });
}

export const versaoDe = (db, leadId) => db.prepare('SELECT versao FROM crencas WHERE lead_id = ?').get(leadId)?.versao ?? 0;
export const estaPreso = (db, leadId) => Boolean(db.prepare('SELECT preso FROM crencas WHERE lead_id = ?').get(leadId)?.preso);

// Lacuna ativa (PoS): uma por vez, a que mais trava o lead agora. Só lacunas epistêmicas (falta
// saber); "esperando você/resposta" não é armadilha. Fora das etapas de trabalho não há lacuna.
const ORDEM_LACUNA = ['telefone', 'situacao_site', 'angulo'];
export function lacunaAtiva(c, etapa, quando = agora()) {
  if (!EM_TRABALHO.has(etapa)) return null;
  const p = pendencias(c, etapa, quando);
  const bloq = p.find((x) => x.tipo === 'handoff_bloqueado');
  if (bloq?.falta?.length) return bloq.falta[0];
  const conf = p.find((x) => x.tipo === 'conflito');
  if (conf) return conf.chave;
  const faltas = p.filter((x) => x.tipo === 'falta_dado').map((x) => x.chave);
  return ORDEM_LACUNA.find((k) => faltas.includes(k)) || faltas[0] || null;
}

// estado do lead como conjunto "chave=valor" (para medir se ele volta a um estado já visto)
export const assinatura = (fatos) => fatos.map((f) => `${f.chave}=${JSON.stringify(f.valor)}`).sort();
export function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const uniao = new Set([...A, ...B]).size;
  return uniao ? 1 - inter / uniao : 0;
}
const mesmoEstado = (a, b) => jaccard(a, b) === 0;

// Os 3 sinais do PoS sobre a janela de ciclos, e o padrão que eles formam:
// - estagnação: ciclos seguidos sem fato novo → Parado
// - recorrência: o estado volta a um já visto, mudando no meio (A→B→A) → Ciclo
// - persistência: houve mudança, mas a mesma lacuna não fecha → Deriva
// saude (H) = 1 − o sinal mais forte, normalizado pelo seu limite; preso quando H chega a 0.
export function diagnosticar(historico) {
  const h = historico.slice(-JANELA);
  let estagnacao = 0;
  for (let i = h.length - 1; i >= 0 && !h[i].novidade; i--) estagnacao++;
  let recorrencia = 0;
  for (let i = 2; i < h.length; i++) {
    const voltou = h.slice(0, i - 1).some((x) => mesmoEstado(x.assinatura, h[i].assinatura));
    if (voltou && !mesmoEstado(h[i - 1].assinatura, h[i].assinatura)) recorrencia++;
  }
  const lacuna = h.at(-1)?.lacuna ?? null;
  let persistencia = 0;
  for (let i = h.length - 1; i >= 0 && lacuna && h[i].lacuna === lacuna; i--) persistencia++;
  // Deriva exige movimento: lacuna parada sem nada mudando é Parado, não Deriva
  const movendo = h.slice(-persistencia || h.length).filter((x) => x.novidade).length >= 2;
  const sinais = { estagnacao, recorrencia, persistencia };
  const saude = Math.max(0, 1 - Math.max(estagnacao / LIMITE_PRESO, recorrencia / LIMITE_RECORRENCIA, (movendo ? persistencia : 0) / LIMITE_PRESO));
  let padrao = null;
  if (estagnacao >= LIMITE_PRESO) padrao = 'parado';
  else if (recorrencia >= LIMITE_RECORRENCIA) padrao = 'ciclo';
  else if (persistencia >= LIMITE_PRESO && movendo) padrao = 'deriva';
  return { padrao, saude: Math.round(saude * 100) / 100, sinais, lacuna };
}

// chaves que mudam de valor dentro da janela (no Ciclo, são as que oscilam)
function chavesQueMudam(h) {
  const valores = {};
  for (const x of h) for (const kv of x.assinatura) {
    const k = kv.slice(0, kv.indexOf('='));
    (valores[k] ||= new Set()).add(kv);
  }
  return Object.keys(valores).filter((k) => valores[k].size > 1);
}

// recuperação própria de cada padrão (PoS §3: suprimir ação ineficaz, cortar a aresta recorrente,
// re-ancorar na lacuna ativa). Todas tiram o lead da fila, mas cada uma diz o que fazer.
const RECUPERACAO = {
  parado: (d) => `Refazer auditoria${d.lacuna ? ` para buscar ${d.lacuna}` : ''}: repetir o mesmo passo não traz fato novo`,
  ciclo: (d) => `Fontes alternando ${d.chaves.join(', ')}: confira o valor certo e use Reprocessar`,
  deriva: (d) => `${d.lacuna} não se resolve sozinho: preencha ou descarte o lead`,
};
const MOTIVO = {
  parado: (d) => `${d.sinais.estagnacao} ciclos sem fato novo${d.lacuna ? ` · falta: ${d.lacuna}` : ''}`,
  ciclo: (d) => `estado voltando ao que já foi (${d.chaves.join(', ')} alternando)`,
  deriva: (d) => `${d.sinais.persistencia} ciclos mudando outras coisas e ${d.lacuna} continua faltando`,
};

// fecha um ciclo de trabalho sobre o lead: registra o passo na janela e diagnostica
export function fecharCiclo(db, leadId, versaoAntes, etapa = null, quando = agora()) {
  const c = ler(db, leadId);
  const novidade = c.versao > versaoAntes;
  c.ciclos_sem_novidade = novidade ? 0 : c.ciclos_sem_novidade + 1;
  c.historico = [...(c.historico || []), { assinatura: assinatura(c.fatos), novidade, lacuna: lacunaAtiva(c, etapa, quando) }].slice(-JANELA);
  const d = diagnosticar(c.historico);
  if (d.padrao && !c.preso) {
    d.chaves = d.padrao === 'ciclo' ? chavesQueMudam(c.historico) : d.lacuna ? [d.lacuna] : [];
    // Ciclo: corta a aresta recorrente — o fato que oscila vira conflito e só você resolve
    if (d.padrao === 'ciclo') for (const k of d.chaves) if (!c.conflitos.includes(k)) c.conflitos.push(k);
    d.recuperacao = RECUPERACAO[d.padrao](d);
    c.preso = true;
    c.motivo = MOTIVO[d.padrao](d);
    c.diagnostico = d;
  }
  salvar(db, c);
  return { preso: c.preso, ciclos: c.ciclos_sem_novidade, saude: d.saude, ...(c.preso ? { motivo: c.motivo, padrao: c.diagnostico?.padrao } : {}) };
}

// guarda o handoff que o portão recusou; devolve true se é um bloqueio novo (para não repetir aviso)
export function marcarBloqueio(db, leadId, para, falta) {
  const c = ler(db, leadId);
  const novo = !c.bloqueio || c.bloqueio.para !== para || !igual(c.bloqueio.falta, falta);
  c.bloqueio = { para, falta, em: agora() };
  salvar(db, c);
  return novo;
}

export function limparBloqueio(db, leadId) {
  const c = ler(db, leadId);
  if (!c.bloqueio) return;
  c.bloqueio = null;
  salvar(db, c);
}

export function liberar(db, leadId) {
  const c = ler(db, leadId);
  // o operador pediu para recomeçar: a reauditoria observa tudo de novo, então conflitos e janela zeram
  Object.assign(c, { preso: false, motivo: null, ciclos_sem_novidade: 0, bloqueio: null, conflitos: [], historico: [], diagnostico: null });
  salvar(db, c);
}

export function presos(db) {
  return db.prepare(`SELECT c.lead_id, c.motivo, json_extract(c.diagnostico, '$.padrao') padrao,
    json_extract(c.diagnostico, '$.recuperacao') recuperacao, l.nome
    FROM crencas c LEFT JOIN leads l ON l.id = c.lead_id WHERE c.preso = 1 ORDER BY c.atualizado_em DESC`).all();
}

// lead que já existia antes da crença: semeia com o que a linha do lead já sabe (mesmas fontes)
export function semearDoLead(db, lead) {
  if (!lead || versaoDe(db, lead.id) > 0) return false;
  const aud = parse(lead.auditoria);
  registrarFatos(db, lead.id, [
    ...fatosDaFonte(lead),
    ...(lead.situacao_site ? [{ chave: 'situacao_site', valor: lead.situacao_site, fonte: 'auditoria' }, { chave: 'sinais_atraso', valor: aud?.sinais || [], fonte: 'auditoria' }] : []),
  ], lead.atualizado_em || agora());
  return true;
}

// fatos que a Coleta traz da fonte (Maps/OSM)
export function fatosDaFonte(lead) {
  const fonte = lead.fonte === 'osm' ? 'osm' : 'maps';
  return [
    { chave: 'telefone', valor: lead.telefone, fonte },
    { chave: 'site', valor: lead.site, fonte },
    { chave: 'rating', valor: lead.rating, fonte },
    { chave: 'avaliacoes', valor: lead.avaliacoes, fonte },
  ];
}
