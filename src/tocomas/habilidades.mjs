// Meta-skills (arXiv 2609.38143): o "Builder" aprende princípios — quando agir e o que fazer — a partir
// do feedback de quem executa. Aqui o feedback é você: cada descarte com motivo é evidência. Quando o
// mesmo motivo se repete num padrão (mesmo ramo, mesma cidade…) e nenhum lead parecido foi aprovado,
// os agentes PROPÕEM uma regra. Ela só vale depois que você aceita, e guarda os descartes que a motivaram.
import crypto from 'node:crypto';
import { agora, json, parse } from '../db.mjs';
import { NICHOS } from '../nichos.mjs';
import { SITUACOES } from '../regras.mjs';
import { exigir } from './contratos.mjs';

export const MOTIVOS = {
  nicho: 'Ramo que não atendo',
  regiao: 'Fora da minha região',
  site_bom: 'Já tem site bom',
  grande: 'Negócio grande demais',
  mensagem: 'Mensagem ruim',
  outro: 'Outro motivo',
};
export const MIN_EVIDENCIAS = 2;
const PONTOS_REBAIXAR = 30;

const ROTULO_ANGULO = { ser_encontrado: 'ser encontrado no Google', modernizar: 'modernizar o site', independencia: 'independência das plataformas', reputacao: 'reputação', recuperar: 'site fora do ar' };

// retrato do lead no momento do descarte: é isso que vira evidência (o lead pode mudar depois)
export function retrato(lead) {
  const d = parse(lead.decisao);
  return {
    nicho: lead.nicho, cidade_uf: `${lead.cidade}-${lead.uf}`, situacao_site: lead.situacao_site,
    avaliacoes: lead.avaliacoes ?? null, angulo: d?.answers?.abordagem?.choice ?? null,
  };
}

export function casa(condicao, lead, angulos = []) {
  const r = retrato(lead);
  if (condicao.campo === 'avaliacoes') return r.avaliacoes != null && r.avaliacoes >= condicao.min;
  if (condicao.campo === 'angulo') return angulos.includes(condicao.igual);
  return r[condicao.campo] === condicao.igual;
}

const idDe = (condicao, efeito) => crypto.createHash('sha1').update(JSON.stringify([condicao, efeito])).digest('hex').slice(0, 12);

function candidatos(descartes) {
  const porMotivo = (m) => descartes.filter((e) => e.dados.motivo === m);
  const agrupar = (lista, campo) => {
    const g = new Map();
    for (const e of lista) { const k = e.dados.retrato?.[campo]; if (k != null) g.set(k, [...(g.get(k) || []), e.id]); }
    return [...g].filter(([, ids]) => ids.length >= MIN_EVIDENCIAS);
  };
  const c = [];
  for (const [nicho, ids] of agrupar(porMotivo('nicho'), 'nicho')) {
    c.push({ motivo: 'nicho', condicao: { campo: 'nicho', igual: nicho }, efeito: { tipo: 'descartar' }, ids,
      quando: `o ramo é ${NICHOS[nicho]?.rotulo || nicho}`, fornecer: 'descartar antes de escrever (você disse que não atende esse ramo)' });
  }
  for (const [cid, ids] of agrupar(porMotivo('regiao'), 'cidade_uf')) {
    c.push({ motivo: 'regiao', condicao: { campo: 'cidade_uf', igual: cid }, efeito: { tipo: 'descartar' }, ids,
      quando: `o negócio fica em ${cid}`, fornecer: 'descartar antes de escrever (fora da sua região)' });
  }
  for (const [sit, ids] of agrupar(porMotivo('site_bom'), 'situacao_site')) {
    c.push({ motivo: 'site_bom', condicao: { campo: 'situacao_site', igual: sit }, efeito: { tipo: 'rebaixar', pontos: PONTOS_REBAIXAR }, ids,
      quando: `a situação do site é "${SITUACOES[sit] || sit}"`, fornecer: `baixar a prioridade em ${PONTOS_REBAIXAR} pontos` });
  }
  const grandes = porMotivo('grande').filter((e) => e.dados.retrato?.avaliacoes != null);
  if (grandes.length >= MIN_EVIDENCIAS) {
    const min = Math.min(...grandes.map((e) => e.dados.retrato.avaliacoes));
    c.push({ motivo: 'grande', condicao: { campo: 'avaliacoes', min }, efeito: { tipo: 'rebaixar', pontos: PONTOS_REBAIXAR }, ids: grandes.map((e) => e.id),
      quando: `o negócio tem ${min}+ avaliações no Google`, fornecer: `baixar a prioridade em ${PONTOS_REBAIXAR} pontos (negócio grande demais)` });
  }
  for (const [ang, ids] of agrupar(porMotivo('mensagem'), 'angulo')) {
    c.push({ motivo: 'mensagem', condicao: { campo: 'angulo', igual: ang }, efeito: { tipo: 'evitar_angulo', angulo: ang }, ids,
      quando: `o ângulo "${ROTULO_ANGULO[ang] || ang}" é uma das opções`, fornecer: 'escolher outro ângulo válido, se houver' });
  }
  return c;
}

// leads que você aprovou (foram para a fila de envio): contraexemplos de uma regra que descarta/rebaixa
function aprovados(db) {
  return db.prepare('SELECT DISTINCT l.* FROM leads l JOIN envios e ON e.lead_id = l.id').all();
}

// B9 (2609.38143): "usar" diz o que os agentes passam a FAZER e deixa claro de quem é a decisão
export const usarDe = (fornecer, estado) => (estado === 'ativa' ? `Em uso, por decisão sua: ${fornecer}` : `Só passa a valer se você aceitar: ${fornecer}`);
const linha = (r) => ({ ...r, condicao: parse(r.condicao), efeito: parse(r.efeito), evidencias: parse(r.evidencias, []), usar: usarDe(r.fornecer, r.estado) });

export function listar(db, estado = null) {
  const rows = estado ? db.prepare('SELECT * FROM habilidades WHERE estado = ? ORDER BY criado_em DESC').all(estado)
    : db.prepare("SELECT * FROM habilidades WHERE estado != 'descartada' ORDER BY estado = 'proposta' DESC, criado_em DESC").all();
  return rows.map(linha);
}

// olha seus descartes com motivo e propõe regras novas; devolve só as recém-propostas
export function propor(db, quando = agora()) {
  const descartes = db.prepare("SELECT id, dados FROM eventos WHERE tipo = 'descartado' AND dados IS NOT NULL").all()
    .map((e) => ({ id: e.id, dados: parse(e.dados, {}) })).filter((e) => e.dados.motivo && e.dados.retrato);
  const contra = aprovados(db);
  const novas = [];
  // uma mudança por vez (B9): se vários candidatos ficaram prontos, propõe o que cita o descarte mais recente; o resto espera a próxima chamada
  const recente = (c) => Math.max(...c.ids);
  for (const c of candidatos(descartes).sort((a, b) => recente(b) - recente(a))) {
    if (novas.length) break;
    if (c.efeito.tipo !== 'evitar_angulo' && contra.some((l) => casa(c.condicao, l))) continue; // você aprovou um igual
    const id = idDe(c.condicao, c.efeito);
    const ja = db.prepare('SELECT estado FROM habilidades WHERE id = ?').get(id);
    const h = exigir('habilidade', { id, motivo: c.motivo, quando: c.quando, fornecer: c.fornecer, condicao: c.condicao, efeito: c.efeito, evidencias: c.ids, estado: ja?.estado || 'proposta' });
    if (ja) { db.prepare('UPDATE habilidades SET evidencias = ?, atualizado_em = ? WHERE id = ?').run(json(h.evidencias), quando, id); continue; }
    db.prepare(`INSERT INTO habilidades (id, motivo, quando, fornecer, condicao, efeito, evidencias, estado, criado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'proposta', ?, ?)`).run(id, h.motivo, h.quando, h.fornecer, json(h.condicao), json(h.efeito), json(h.evidencias), quando, quando);
    novas.push({ ...h, usar: usarDe(h.fornecer, 'proposta') });
  }
  return novas;
}

const TRANSICOES = { aceitar: ['proposta', 'ativa'], recusar: ['proposta', 'descartada'], desativar: ['ativa', 'revisada'], reativar: ['revisada', 'ativa'] };

export function mudarEstado(db, id, acao) {
  const t = TRANSICOES[acao];
  if (!t) throw new Error(`ação inválida: ${acao}`);
  const r = db.prepare('UPDATE habilidades SET estado = ?, atualizado_em = ? WHERE id = ? AND estado = ?').run(t[1], agora(), id, t[0]);
  if (!r.changes) throw new Error('regra não encontrada ou já mudou de estado');
  return linha(db.prepare('SELECT * FROM habilidades WHERE id = ?').get(id));
}

// aplica as regras ATIVAS a um lead (chamado pela Nova antes de decidir)
export function aplicar(db, lead, angulos = []) {
  const out = { descartar: null, rebaixar: 0, evitar: [], aplicadas: [] };
  for (const h of listar(db, 'ativa')) {
    if (!casa(h.condicao, lead, angulos)) continue;
    if (h.efeito.tipo === 'descartar') out.descartar ??= h;
    if (h.efeito.tipo === 'rebaixar') out.rebaixar += h.efeito.pontos;
    if (h.efeito.tipo === 'evitar_angulo') out.evitar.push(h.efeito.angulo);
    out.aplicadas.push(h);
    db.prepare('UPDATE habilidades SET aplicada = aplicada + 1 WHERE id = ?').run(h.id);
  }
  return out;
}
