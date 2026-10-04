// Os cinco agentes do AGENT_FOUNDRY_GEN01, cada um com um papel real no pipeline:
//
//   Alva  (assistente)   liga o expediente: reabre as varreduras ativas e faz o briefing
//   Atlas (mercado)      varre a fonte (Maps/OSM) e audita o site de cada empresa
//   Nova  (estratégia)   decide oportunidade, se o negócio está ativo e o ângulo da abordagem
//   Maia  (copy)         escreve a primeira mensagem com base só nos fatos medidos
//   Leo   (operações)    envia no ritmo seguro via OpenWA e trata respostas e pedidos de saída
//
// Coordenação por fila (tabela jobs): cada agente só pega jobs do seu tipo, e cada etapa
// enfileira a próxima. Nada roda em paralelo no mesmo lead.
//
// TOCOMAS (docs/TOCOMAS.md): o handoff só acontece por aresta do grafo de tarefas (src/tocomas/grafo.mjs),
// cada lead tem uma crença com fatos datados, cada job declara as ferramentas que vai usar, e um
// controlador segura a escrita/varredura quando o estoque passa do que o teto de envios dá conta.

import crypto from 'node:crypto';
import { agora, concluirJob, enfileirar, falharJob, json, lerAjustes, lerFlag, parse, pegarJob, salvarFlag } from './db.mjs';
import { registrar } from './eventos.mjs';
import { NICHOS } from './nichos.mjs';
import { classificarUrl, formatarTelefone, normalizarTelefone, sinaisDeAtraso, SITUACOES } from './regras.mjs';
import { auditarSite } from './auditoria.mjs';
import { coletarMaps, coletarOsm } from './fontes/index.mjs';
import { decide } from './decide/index.mjs';
import { gerarTexto, saudeOllama } from './llm.mjs';
import { CONFIG } from './config.mjs';
import { avaliarEnvio, inicioDoDia, intervaloAleatorioMs } from './envio/politica.mjs';
import { enviarTexto, openwaConfigurado, PEDIU_PARA_SAIR, saudeOpenwa } from './envio/openwa.mjs';
import { aprender, caracteristicas, contribuicoes, lerCabecas, misturar } from './aprendizado.mjs';
import { conferirHandoff, exigirHandoff, visao } from './tocomas/grafo.mjs';
import { prontidao, zona } from './tocomas/zonas.mjs';
import { estaPreso, fatosDaFonte, fecharCiclo, lerCrenca, limparBloqueio, marcarBloqueio, registrarFatos, semearDoLead, versaoDe } from './tocomas/crenca.mjs';
import { abrirPlano, registrarFidelidade } from './tocomas/fidelidade.mjs';
import { CONTROLADOS, criarControlador } from './tocomas/controlador.mjs';
import { aplicar as aplicarHabilidades } from './tocomas/habilidades.mjs';

export const AGENTES = {
  alva: { nome: 'Alva', papel: 'Assistente executiva', funcao: 'Abre o expediente, reabre varreduras e resume o dia', cor: '#d9468f' },
  atlas: { nome: 'Atlas', papel: 'Inteligência de mercado', funcao: 'Varre o Maps/OSM e audita o site de cada empresa', cor: '#0e9fb8' },
  nova: { nome: 'Nova', papel: 'Estratégia', funcao: 'Decide oportunidade, atividade e ângulo de abordagem', cor: '#3b5bdb' },
  maia: { nome: 'Maia', papel: 'Copy', funcao: 'Escreve a primeira mensagem a partir dos fatos medidos', cor: '#7c3aed' },
  leo: { nome: 'Leo', papel: 'Operações', funcao: 'Envia no ritmo seguro e trata respostas e opt-out', cor: '#16a34a' },
};

// passar trabalho adiante: só pelas arestas do grafo de tarefas e só se o próximo nó tem os fatos
// de que precisa (portão de handoff). Recusado, vira pendência na crença em vez de job que vai falhar.
export function passar(db, de, para, ref) {
  exigirHandoff(de, para);
  const lead = db.prepare('SELECT nome, etapa, telefone_tipo FROM leads WHERE id = ?').get(ref);
  if (lead) {
    const contexto = { soCelular: lerAjustes(db).envio.so_celular !== false, telefoneTipo: lead.telefone_tipo };
    const falta = conferirHandoff(lerCrenca(db, ref, lead.etapa), para, contexto);
    if (falta.length) {
      if (marcarBloqueio(db, ref, para, falta)) {
        const lista = falta.map((f) => (f.chave === 'telefone_celular' ? 'telefone celular ("só celular" está ligado nos Ajustes)' : `${f.chave}${f.tipo === 'conflito' ? ' (fontes discordam)' : ''}`)).join(', ');
        registrar(db, 'alva', 'handoff_bloqueado', `${lead.nome}: não passei para "${para}" — falta ${lista}`, { lead_id: ref, dados: { de, para, falta } });
      }
      return null;
    }
    limparBloqueio(db, ref);
  }
  return enfileirar(db, para, ref);
}

// B16: depois de mudar um ajuste que afeta os portões (ex.: desligar "só celular"), os leads
// parados antes da Maia são reavaliados na hora em vez de esperar o próximo expediente
export function reavaliarBloqueados(db) {
  let liberados = 0;
  for (const l of db.prepare("SELECT id FROM leads WHERE etapa = 'qualificado'").all()) {
    if (estaPreso(db, l.id)) continue;
    if (passar(db, 'controle', 'redigir', l.id)) liberados++;
  }
  return liberados;
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const idDoLead = (nome, cidade, uf) => crypto.createHash('sha1').update(`${norm(nome)}|${norm(cidade)}|${norm(uf)}`).digest('hex').slice(0, 16);

// ------------------------------------------------------------------ Atlas

async function varrer(db, job, ctx) {
  const v = db.prepare('SELECT * FROM varreduras WHERE id = ?').get(Number(job.ref));
  if (!v || !v.ativa) return;
  const rotulo = `${NICHOS[v.nicho]?.rotulo || v.nicho} em ${v.cidade}-${v.uf}`;
  ctx.tarefa('atlas', `Varrendo ${rotulo} (${v.fonte})`);
  registrar(db, 'atlas', 'varredura_inicio', `Começou a varrer ${rotulo} via ${v.fonte === 'maps' ? 'Google Maps' : 'OpenStreetMap'}`);
  let novos = 0, repetidos = 0;
  const salvar = (item) => {
    const r = salvarLead(db, item, v);
    if (r === 'novo') novos++; else repetidos++;
  };
  const args = { cidade: v.cidade, uf: v.uf, nicho: v.nicho, limite: v.limite };
  ctx.usar?.(v.fonte === 'maps' ? 'coletor_maps' : 'overpass');
  const res = v.fonte === 'maps' ? await coletarMaps({ ...args, aoItem: salvar }) : await coletarOsm(args);
  if (v.fonte !== 'maps') res.itens.forEach(salvar);
  const resultado = { coletados: res.itens.length, novos, repetidos, aviso: res.aviso };
  db.prepare('UPDATE varreduras SET ultima_execucao = ?, ultimo_resultado = ? WHERE id = ?').run(agora(), json(resultado), v.id);
  registrar(db, 'atlas', 'varredura_fim', `${rotulo}: ${res.itens.length} encontrados, ${novos} novos${res.aviso ? ` (${res.aviso})` : ''}`, { dados: resultado });
}

function salvarLead(db, item, v) {
  const { telefone, tipo } = normalizarTelefone(item.telefone);
  const id = idDoLead(item.nome, v.cidade, v.uf);
  const existe = db.prepare('SELECT id, site, etapa FROM leads WHERE id = ?').get(id)
    || (telefone && db.prepare('SELECT id, site, etapa FROM leads WHERE telefone = ?').get(telefone));
  const t = agora();
  if (existe) {
    // mesmo negócio listado duas vezes (mesmo telefone) pode trazer outro site: a auditoria antiga deixa de valer
    const siteMudou = item.site && item.site !== existe.site;
    const reabrir = siteMudou && ['descoberto', 'auditado', 'qualificado', 'mensagem', 'sem_contato', 'descartado'].includes(existe.etapa);
    db.prepare(`UPDATE leads SET telefone = COALESCE(?, telefone), telefone_tipo = COALESCE(?, telefone_tipo), site = COALESCE(?, site),
      rating = COALESCE(?, rating), avaliacoes = COALESCE(?, avaliacoes), endereco = COALESCE(?, endereco), atualizado_em = ? WHERE id = ?`)
      .run(telefone, tipo, item.site || null, item.rating ?? null, item.avaliacoes ?? null, item.endereco || null, t, existe.id);
    if (reabrir) {
      db.prepare("UPDATE leads SET etapa = 'descoberto' WHERE id = ?").run(existe.id);
      passar(db, 'varrer', 'auditar', existe.id);
    }
    return 'repetido';
  }
  db.prepare(`INSERT INTO leads (id, nome, categoria, nicho, cidade, uf, endereco, telefone, telefone_tipo, site, rating, avaliacoes, maps_url, fonte, varredura_id, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, item.nome, item.categoria || null, v.nicho, v.cidade, v.uf, item.endereco || null, telefone, tipo, item.site || null,
      item.rating ?? null, item.avaliacoes ?? null, item.maps_url || null, v.fonte, v.id, t, t);
  passar(db, 'varrer', 'auditar', id);
  return 'novo';
}

async function auditar(db, job, ctx) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(job.ref);
  if (!lead) return;
  ctx.tarefa('atlas', `Auditando ${lead.nome}`);
  let situacao = classificarUrl(lead.site);
  let aud = null;
  if (situacao === 'site_proprio' || situacao === 'site_gratuito') {
    ctx.usar?.('buscar_seguro');
    aud = await auditarSite(lead.site, lead.fonte); // B15: a origem é a fonte de coleta do lead
    if (aud.erro) situacao = 'site_fora_do_ar';
    else if (aud.redireciona_para) {
      const destino = classificarUrl(aud.redireciona_para);
      if (destino !== 'site_proprio') situacao = destino;
    }
  }
  const sinais = sinaisDeAtraso(aud);
  db.prepare("UPDATE leads SET situacao_site = ?, auditoria = ?, etapa = 'auditado', atualizado_em = ? WHERE id = ?")
    .run(situacao, json(aud ? { ...aud, sinais } : null), agora(), lead.id);
  registrar(db, 'atlas', 'auditoria', `${lead.nome}: ${SITUACOES[situacao]}${sinais.length ? ` · ${sinais.length} sinal(is) de atraso` : ''}`, { lead_id: lead.id });
  registrarFatos(db, lead.id, [
    ...fatosDaFonte(lead),
    { chave: 'situacao_site', valor: situacao, fonte: 'auditoria' },
    { chave: 'sinais_atraso', valor: sinais, fonte: 'auditoria' },
  ]);
  passar(db, 'auditar', 'qualificar', lead.id);
}

// ------------------------------------------------------------------ Nova

// Nível de oportunidade é fato medido, não opinião: sai da situação do site e dos sinais.
// (No teste ao vivo de 02/10/2026 o Qwen3-1.7B respondeu "Nada" com 100% para negócios que só
// têm Instagram — o viés de escala ordinal do arXiv 2609.38827. Por isso isto é regra.)
export const NIVEIS_OPORTUNIDADE = ['Nada', 'Pouco', 'Médio', 'Alto', 'Muito alto'];

export function nivelOportunidade(situacao, sinais = []) {
  if (situacao === 'sem_site' || situacao === 'site_fora_do_ar') return 4;
  if (['so_rede_social', 'so_cardapio', 'so_agendamento'].includes(situacao)) return 3;
  if (situacao === 'site_gratuito') return sinais.length ? 3 : 2;
  return sinais.length >= 2 ? 2 : sinais.length;
}

// Espaço de ações por lead (arXiv 2610.00437, JevSpawn): o código define quais ângulos são
// verdadeiros para este negócio; o modelo só escolhe entre eles.
export function angulosPermitidos(lead, sinais = []) {
  const base = {
    sem_site: ['ser_encontrado'],
    site_fora_do_ar: ['recuperar'],
    so_rede_social: ['independencia'],
    so_cardapio: ['independencia'],
    so_agendamento: ['independencia'],
    site_gratuito: sinais.length ? ['independencia', 'modernizar'] : ['independencia'],
    site_proprio: sinais.length ? ['modernizar'] : [],
  }[lead.situacao_site] || [];
  const boaReputacao = lead.rating >= 4.5 && lead.avaliacoes >= 30;
  return boaReputacao && base.length && lead.situacao_site !== 'site_fora_do_ar' ? [...base, 'reputacao'] : base;
}

export const PERGUNTAS_QUALIFICACAO = {
  ativo: {
    type: 'noul',
    instructions: 'Pelos dados, este negócio está ativo e atendendo clientes hoje?',
    criteria: { true: 'Sim, há sinais de que está ativo (avaliações, telefone, presença online)', false: 'Não há sinais suficientes de que está ativo' },
  },
  abordagem: {
    type: 'choice',
    instructions: 'Qual é o melhor ângulo para a primeira mensagem a este negócio?',
    criteria: {
      ser_encontrado: 'Quem procura no Google não encontra um site do negócio',
      modernizar: 'O site atual está desatualizado, inseguro ou ruim no celular',
      independencia: 'Ter um site próprio em vez de depender de rede social ou plataforma de terceiros',
      reputacao: 'Transformar a boa nota no Google em mais clientes com um site à altura',
      recuperar: 'O endereço do site não funciona e clientes caem numa página quebrada',
    },
  },
};

export const ROTULO_ABORDAGEM = PERGUNTAS_QUALIFICACAO.abordagem.criteria;

export function estadoDoLead(lead) {
  const aud = parse(lead.auditoria);
  return {
    negocio: lead.nome,
    categoria: lead.categoria || NICHOS[lead.nicho]?.rotulo,
    cidade: `${lead.cidade}-${lead.uf}`,
    nota_google: lead.rating,
    quantidade_de_avaliacoes: lead.avaliacoes,
    tem_telefone: Boolean(lead.telefone),
    endereco_do_site: lead.site || 'nenhum',
    situacao_do_site: SITUACOES[lead.situacao_site] || 'desconhecida',
    sinais_de_atraso: aud?.sinais?.length ? aud.sinais : 'nenhum medido',
    site_medido: aud && !aud.erro ? { titulo: aud.titulo, https: aud.https, adaptado_ao_celular: aud.viewport, ano_no_rodape: aud.ano_copyright, tecnologias: aud.tecnologias } : aud?.erro ? { erro: aud.erro } : 'não se aplica',
  };
}

async function qualificar(db, job, ctx) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(job.ref);
  if (!lead) return;
  ctx.tarefa('nova', `Decidindo sobre ${lead.nome}`);
  ctx.usar?.('regras');
  const aud = parse(lead.auditoria);
  const sinais = aud?.sinais || [];
  const motivo = [SITUACOES[lead.situacao_site], ...sinais].filter(Boolean).join(' · ');
  const nivel = nivelOportunidade(lead.situacao_site, sinais);
  // regras que você aceitou na Base do Mestre (meta-skills) entram antes de qualquer decisão
  const hab = aplicarHabilidades(db, lead, angulosPermitidos(lead, sinais));
  if (hab.descartar) {
    db.prepare("UPDATE leads SET score = 0, motivo = ?, etapa = 'descartado', atualizado_em = ? WHERE id = ?")
      .run(`regra aprendida: quando ${hab.descartar.quando}`, agora(), lead.id);
    registrar(db, 'nova', 'habilidade_aplicada', `${lead.nome}: descartado pela regra que você aceitou (quando ${hab.descartar.quando})`, { lead_id: lead.id, dados: { habilidade: hab.descartar.id } });
    return;
  }
  const todos = angulosPermitidos(lead, sinais);
  const angulos = todos.filter((a) => !hab.evitar.includes(a)).length ? todos.filter((a) => !hab.evitar.includes(a)) : todos;
  const regra = (type, chave, extra = {}) => ({ type, origem: 'regra', probabilities: { [chave]: 1 }, confidence: 1, coverage: 1, ...extra });
  const oportunidade = regra('score', String(nivel), { score: nivel / 4, level: nivel });

  if (nivel === 0 || !angulos.length) {
    db.prepare("UPDATE leads SET decisao = ?, score = 0, motivo = ?, etapa = 'descartado', atualizado_em = ? WHERE id = ?")
      .run(json({ answers: { oportunidade }, backend: 'regra', model: null, latency_ms: 0 }), `${motivo} · nenhum problema medido`, agora(), lead.id);
    registrarFatos(db, lead.id, [{ chave: 'nivel_oportunidade', valor: nivel, fonte: 'regra' }]);
    registrar(db, 'nova', 'decisao', `${lead.nome}: descartado (site próprio sem problemas medidos)`, { lead_id: lead.id });
    return;
  }

  const perguntas = { ativo: PERGUNTAS_QUALIFICACAO.ativo };
  if (angulos.length > 1) {
    perguntas.abordagem = { ...PERGUNTAS_QUALIFICACAO.abordagem, criteria: Object.fromEntries(angulos.map((k) => [k, ROTULO_ABORDAGEM[k]])) };
  }
  let r;
  const saude = CONFIG.decideBackend === 'local' ? await saudeOllama() : { ok: true, decide: true };
  if (saude.ok && saude.decide) {
    ctx.usar?.('decide');
    r = await decide({ state: estadoDoLead(lead), questions: perguntas });
  } else {
    // sem modelo, a fila não trava: a regra decide o que é fato, e "ativo" fica neutro (50%), sem chute
    r = decisaoSemModelo();
    registrar(db, 'nova', 'aviso', `${lead.nome}: decidi só por regra (${CONFIG.modelos.decisao.modelo ? 'modelo de decisão indisponível' : 'LLM da decisão desligado em modelos.json'}); ângulo = o primeiro válido`, { lead_id: lead.id });
  }
  const abordagem = r.answers.abordagem || regra('choice', angulos[0], { choice: angulos[0] });
  const ativo = r.answers.ativo;
  // prioridade 0–100: oportunidade (regra) pesa mais que atividade (modelo); a fórmula aparece na tela
  const scoreRegra = Math.round(100 * (0.75 * oportunidade.score + 0.25 * ativo.noul));
  const etapa = lead.telefone ? 'qualificado' : 'sem_contato';
  const decisao = { ...r, answers: { oportunidade, ativo, abordagem }, angulos_permitidos: angulos, score_regra: scoreRegra,
    formula: 'regra = 0,75 × oportunidade + 0,25 × ativo; final = mistura com o que os agentes aprenderam (α cresce com os exemplos)' };
  // o aprendizado usa a decisão (ângulo) como característica, então entra depois dela
  const cabecas = lerCabecas(db);
  const x = caracteristicas({ ...lead, decisao: json(decisao) });
  const m = misturar(scoreRegra, cabecas, x);
  decisao.aprendizado = { ...m, contribuicoes: contribuicoes(cabecas.aprovacao, x) };
  const score = Math.max(0, m.score - hab.rebaixar);
  if (hab.aplicadas.length) decisao.habilidades = hab.aplicadas.map((h) => ({ id: h.id, quando: h.quando, fornecer: h.fornecer }));
  // 3 zonas (B3): só com o nicho calibrado; zona baixa = a Nova descarta sozinha, sem gastar a Maia
  decisao.zona = zona(m.p_aprovacao, prontidao(db, lead.nicho), lead.id);
  if (decisao.zona.zona === 'baixa') {
    const chance = `${Math.round(m.p_aprovacao * 100)}%`;
    db.prepare("UPDATE leads SET decisao = ?, score = ?, motivo = ?, etapa = 'descartado', atualizado_em = ? WHERE id = ?")
      .run(json(decisao), score, `a Nova descartou sozinha: ${chance} de chance de você aprovar (zona baixa)`, agora(), lead.id);
    registrar(db, 'nova', 'zona_baixa', `${lead.nome}: descartei sozinha — ${chance} de chance de você aprovar, nicho calibrado com ${decisao.zona.n} decisões suas (ECE ${decisao.zona.ece})`, { lead_id: lead.id, dados: decisao.zona });
    return;
  }
  db.prepare('UPDATE leads SET decisao = ?, score = ?, motivo = ?, etapa = ?, atualizado_em = ? WHERE id = ?')
    .run(json(decisao), score, motivo, etapa, agora(), lead.id);
  registrar(db, 'nova', 'decisao', `${lead.nome}: prioridade ${score} · ângulo "${abordagem.choice}"${r.backend === 'regra_sem_modelo' ? ' (sem modelo)' : abordagem.origem === 'regra' ? ' (único válido)' : ` (${Math.round(abordagem.confidence * 100)}%)`} · ${r.latency_ms} ms${hab.aplicadas.length ? ` · ${hab.aplicadas.length} regra(s) aprendida(s)` : ''}`, { lead_id: lead.id });
  registrarFatos(db, lead.id, [
    { chave: 'nivel_oportunidade', valor: nivel, fonte: 'regra' },
    ...(ativo.origem === 'sem_modelo' ? [] : [{ chave: 'ativo', valor: ativo.noul, fonte: 'modelo', confianca: ativo.confidence }]),
    { chave: 'angulo', valor: abordagem.choice, fonte: abordagem.origem === 'regra' ? 'regra' : 'modelo', confianca: abordagem.confidence },
  ]);
  if (etapa === 'qualificado') passar(db, 'qualificar', 'redigir', lead.id);
}

export function decisaoSemModelo() {
  return {
    answers: { ativo: { type: 'noul', origem: 'sem_modelo', probabilities: { true: 0.5, false: 0.5 }, confidence: 0.5, coverage: 0, noul: 0.5 } },
    backend: 'regra_sem_modelo', model: null, latency_ms: 0,
  };
}

// ------------------------------------------------------------------ Maia

const MODELOS_FALLBACK = {
  ser_encontrado: (l) => `quem procura ${l.categoria?.toLowerCase() || 'esse serviço'} em ${l.cidade} no Google não encontra um site da ${l.nome}`,
  modernizar: (l, s) => `o site da ${l.nome} tem alguns pontos que afastam cliente${s[0] ? ` (${s[0]})` : ''}`,
  independencia: (l) => `a ${l.nome} depende hoje de ${SITUACOES[l.situacao_site]?.toLowerCase().replace('só ', '') || 'plataformas de terceiros'} para aparecer online`,
  reputacao: (l) => `a ${l.nome} tem nota ${l.rating} no Google${l.avaliacoes ? ` com ${l.avaliacoes} avaliações` : ''}, mas não tem um site à altura`,
  recuperar: (l) => `o endereço do site da ${l.nome} não está abrindo`,
};

export function observacao(lead, angulo) {
  const aud = parse(lead.auditoria);
  return (MODELOS_FALLBACK[angulo] || MODELOS_FALLBACK.ser_encontrado)(lead, aud?.sinais || []);
}

// Afirmações que o modelo pequeno inventou no teste ao vivo ("o site está desativado" para quem
// nem tem site). Cada uma só é permitida quando o fato medido a sustenta.
export function contradicoes(texto, lead, ajustes) {
  const t = texto.toLowerCase();
  const p = [];
  if (lead.situacao_site !== 'site_fora_do_ar' && /desativad|fora do ar|n[aã]o (abre|carrega|funciona)|quebrad|caiu/.test(t)) p.push('diz que o site está fora do ar');
  if (lead.situacao_site === 'sem_site' && /seu site|site atual|site de voc|\bo site d[aoe]\b/.test(t)) p.push('fala de um site que não existe');
  if (!lead.rating && /nota|estrelas|avalia/.test(t)) p.push('cita nota sem ter nota');
  const remetente = norm(ajustes.remetente_nome).split(' ')[0];
  const palavraDoNegocio = norm(lead.nome).split(' ').filter((w) => w.length > 3 && !['barbearia', 'restaurante', 'clinica', 'studio', 'academia'].includes(w))[0] || norm(lead.nome);
  const tn = norm(texto);
  if (!tn.includes(remetente)) p.push('não se apresenta');
  if (!tn.includes(palavraDoNegocio)) p.push('não cita o nome do negócio');
  // visto ao vivo: "Sou Victor da Boareto Barbershop" — o modelo se passou pelo próprio negócio
  if (new RegExp(`\\b(sou|aqui e)( o)? ${remetente} d[aoe] ${palavraDoNegocio}`).test(tn) || new RegExp(`\\b${remetente} d[aoe] (barbearia|${palavraDoNegocio})`).test(tn)) p.push('se apresenta como se fosse o negócio');
  if (/nossos clientes|nossa regiao|cuidar d[eo]s? (seus|sua|voces) cabel/.test(tn)) p.push('fala como se fosse o negócio');
  return p;
}

// O texto do modelo precisa carregar a observação do ângulo; senão não disse nada concreto.
const PALAVRAS_DO_ANGULO = {
  ser_encontrado: /google|encontr|procura|busca/, independencia: /depend|propri|rede social|instagram|plataforma|agendamento|cardapio/,
  modernizar: /celular|https|segur|atualiz|desatualiz|lent/, reputacao: /nota|avalia|estrela/, recuperar: /abr|funcion|endereco/,
};
export const carregaObservacao = (texto, angulo) => (PALAVRAS_DO_ANGULO[angulo] || /./).test(norm(texto));

// Variações do texto fixo escolhidas pelo id do lead: 10 mensagens no dia não saem idênticas,
// e o mesmo lead sempre recebe a mesma versão (reprocessar não muda o texto à toa).
const ABERTURAS = [
  (a, l) => `Olá! Aqui é o ${a.remetente_nome}, ${a.remetente_oferta} em ${l.cidade}.`,
  (a) => `Oi, tudo bem? Meu nome é ${a.remetente_nome}, ${a.remetente_oferta}.`,
  (a, l) => `Boa tarde! Sou o ${a.remetente_nome}, aqui de ${l.cidade}; ${a.remetente_oferta}.`,
];
const FECHOS = [
  'Posso te mostrar em 5 minutos como ficaria?',
  'Faz sentido eu te mandar uma ideia de como ficaria?',
  'Topa ver um exemplo rápido, sem compromisso?',
];

export function mensagemFallback(lead, ajustes, angulo) {
  const obs = observacao(lead, angulo);
  const h = parseInt(crypto.createHash('sha1').update(String(lead.id || lead.nome)).digest('hex').slice(0, 6), 16);
  const port = ajustes.remetente_portfolio ? `\nMeus trabalhos: ${ajustes.remetente_portfolio}` : '';
  return `${ABERTURAS[h % 3](ajustes, lead)} Vi que ${obs}. ${FECHOS[Math.floor(h / 3) % 3]}${port}\n\nSe não quiser receber mensagens, é só responder SAIR.`;
}

export function validarMensagem(texto, ajustes) {
  let t = String(texto || '').trim().replace(/^["“']|["”']$/g, '').trim();
  // remove links que o modelo possa ter inventado; o único permitido é o portfólio do operador
  t = t.replace(/https?:\/\/\S+/g, (u) => (ajustes.remetente_portfolio && u.startsWith(ajustes.remetente_portfolio) ? u : '')).replace(/[ \t]{2,}/g, ' ');
  if (!/responder SAIR/i.test(t)) t = `${t}\n\nSe não quiser receber mensagens, é só responder SAIR.`;
  const problemas = [];
  if (t.length > 700) problemas.push('longa demais');
  if (/preparamos|preparei|já fiz|já criei|prévia pronta/i.test(t)) problemas.push('promete algo que não foi feito');
  return { texto: t, problemas };
}

// Prompt da Maia. Exportado para a bancada de modelos testar exatamente o que roda em produção.
export function promptMaia(lead, ajustes, angulo) {
  return {
    sistema: `Você escreve a primeira mensagem de WhatsApp de ${ajustes.remetente_nome}, que ${ajustes.remetente_oferta}, para um negócio local.
Regras: português do Brasil, tom humano e direto, de 2 a 4 frases curtas, no máximo 1 emoji, sem links.
Comece cumprimentando e se apresentando como ${ajustes.remetente_nome}. Cite o nome do negócio.
Use a OBSERVAÇÃO dada e nenhum outro fato. Não invente números, notas, prazos, problemas ou trabalhos já feitos.
Termine com uma pergunta simples, sem pressão. Não escreva assinatura nem aspas.`,
    usuario: `NEGÓCIO: ${lead.nome} (${lead.categoria || NICHOS[lead.nicho]?.rotulo}, ${lead.cidade})\nOBSERVAÇÃO: ${observacao(lead, angulo)}\n\nEscreva só a mensagem.`,
  };
}

async function redigir(db, job, ctx) {
  // fronteira de memória: a Maia vê só o que o domínio Escrita pode ver (sem HTML/tecnologias)
  const lead = visao(db.prepare('SELECT * FROM leads WHERE id = ?').get(job.ref), 'escrita');
  if (!lead || lead.etapa !== 'qualificado') return;
  ctx.tarefa('maia', `Escrevendo para ${lead.nome}`);
  const ajustes = lerAjustes(db);
  const decisao = parse(lead.decisao);
  const angulo = decisao?.answers?.abordagem?.choice || 'ser_encontrado';
  let texto, origem;
  try {
    ctx.usar?.('gerar_texto');
    const bruto = await gerarTexto(promptMaia(lead, ajustes, angulo));
    ctx.usar?.('checar_contradicao');
    const v = validarMensagem(bruto, ajustes);
    const problemas = [...v.problemas, ...contradicoes(v.texto, lead, ajustes)];
    if (!carregaObservacao(v.texto, angulo)) problemas.push('não traz a observação concreta');
    if (problemas.length) throw new Error(`texto do modelo recusado: ${problemas.join(', ')}`);
    const port = ajustes.remetente_portfolio && !v.texto.includes(ajustes.remetente_portfolio)
      ? v.texto.replace(/\n\nSe não quiser/, `\nMeus trabalhos: ${ajustes.remetente_portfolio}\n\nSe não quiser`) : v.texto;
    texto = port; origem = 'modelo';
  } catch (e) {
    ctx.usar?.('texto_fixo');
    texto = mensagemFallback(lead, ajustes, angulo);
    origem = 'modelo_recusado';
    registrar(db, 'maia', 'aviso', `${lead.nome}: usei o texto fixo (${e.message.slice(0, 140)})`, { lead_id: lead.id });
  }
  db.prepare("UPDATE leads SET mensagem = ?, mensagem_origem = ?, etapa = 'mensagem', atualizado_em = ? WHERE id = ?").run(texto, origem, agora(), lead.id);
  registrar(db, 'maia', 'mensagem', `Mensagem pronta para ${lead.nome} (${origem === 'modelo' ? 'escrita pelo modelo' : 'modelo fixo'})`, { lead_id: lead.id });
  if (!ajustes.envio.exigir_aprovacao) {
    try { aprovarEnvio(db, lead.id, texto, 'auto'); } catch (e) { registrar(db, 'leo', 'aviso', `${lead.nome}: não entrou na fila (${e.message})`, { lead_id: lead.id }); }
  }
}

// ------------------------------------------------------------------ Leo

export function aprovarEnvio(db, leadId, texto, quem = 'operador') {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) throw new Error('lead não encontrado');
  if (!lead.telefone) throw new Error('lead sem telefone');
  if (lead.etapa === 'nao_contatar') throw new Error('este contato pediu para não receber mensagens');
  const ajustes = lerAjustes(db);
  if (ajustes.envio.so_celular && lead.telefone_tipo !== 'celular') throw new Error('telefone fixo: desligue "só celular" nos ajustes para enviar');
  const ja = db.prepare("SELECT id FROM envios WHERE telefone = ? AND status IN ('aprovado', 'enviado')").get(lead.telefone);
  if (ja) throw new Error('já existe envio para este telefone');
  const msg = validarMensagem(texto || lead.mensagem, ajustes).texto;
  db.prepare("INSERT INTO envios (lead_id, telefone, texto, status, criado_em) VALUES (?, ?, ?, 'aprovado', ?)").run(lead.id, lead.telefone, msg, agora());
  db.prepare("UPDATE leads SET etapa = 'aprovado', mensagem = ?, atualizado_em = ? WHERE id = ?").run(msg, agora(), lead.id);
  registrar(db, 'leo', 'aprovado', `${lead.nome} entrou na fila de envio (${quem})`, { lead_id: lead.id });
  // só a aprovação humana ensina o gosto do operador; a automática não é sinal
  if (quem === 'operador' && lead.decisao) {
    const a = aprender(db, 'aprovacao', lead, 1);
    registrar(db, 'nova', 'aprendizado', `Aprendi com sua aprovação de ${lead.nome} (previa ${Math.round(a.p_antes * 100)}% · ${a.n} exemplos)`, { lead_id: lead.id });
  }
}

export function enviadosHoje(db) {
  return db.prepare("SELECT COUNT(*) n FROM envios WHERE status = 'enviado' AND enviado_em >= ?").get(inicioDoDia(new Date()).toISOString()).n;
}

export function situacaoDoEnvio(db) {
  const ajustes = lerAjustes(db);
  const prox = lerFlag(db, 'proximo_envio_em', null);
  const aval = avaliarEnvio({ agora: new Date(), enviadosHoje: enviadosHoje(db), proximoPermitido: prox ? new Date(prox) : null, cfg: ajustes.envio, aleatorio: () => 0 });
  return { ...aval, enviados_hoje: enviadosHoje(db), limite: ajustes.envio.limite_diario, openwa: openwaConfigurado(), na_fila: db.prepare("SELECT COUNT(*) n FROM envios WHERE status = 'aprovado'").get().n };
}

async function despachar(db, ctx) {
  const pendente = db.prepare("SELECT e.*, l.nome FROM envios e JOIN leads l ON l.id = e.lead_id WHERE e.status = 'aprovado' ORDER BY e.id LIMIT 1").get();
  if (!pendente || !openwaConfigurado()) return false;
  // sessão desconectada não pode virar "erro" no envio: espera o WhatsApp voltar
  if (!(await saudeOpenwa()).ok) return false;
  const ajustes = lerAjustes(db);
  const prox = lerFlag(db, 'proximo_envio_em', null);
  const aval = avaliarEnvio({ agora: new Date(), enviadosHoje: enviadosHoje(db), proximoPermitido: prox ? new Date(prox) : null, cfg: ajustes.envio });
  if (!aval.pode) {
    db.prepare('UPDATE envios SET agendado_para = ? WHERE id = ?').run(aval.proximo.toISOString(), pendente.id);
    return false;
  }
  ctx.tarefa('leo', `Enviando para ${pendente.nome}`);
  try {
    const resp = await enviarTexto(pendente.telefone, pendente.texto);
    db.prepare("UPDATE envios SET status = 'enviado', enviado_em = ?, resposta = ? WHERE id = ?").run(agora(), json(resp), pendente.id);
    db.prepare("UPDATE leads SET etapa = 'enviado', atualizado_em = ? WHERE id = ?").run(agora(), pendente.lead_id);
    registrar(db, 'leo', 'enviado', `Mensagem enviada para ${pendente.nome} (${formatarTelefone(pendente.telefone)})`, { lead_id: pendente.lead_id });
  } catch (e) {
    db.prepare("UPDATE envios SET status = 'erro', resposta = ? WHERE id = ?").run(json({ erro: e.message }), pendente.id);
    registrar(db, 'leo', 'erro', `Falha ao enviar para ${pendente.nome}: ${e.message}`, { lead_id: pendente.lead_id });
  }
  // a espera conta a partir da tentativa, com ou sem sucesso
  salvarFlag(db, 'proximo_envio_em', new Date(Date.now() + intervaloAleatorioMs(ajustes.envio)).toISOString());
  return true;
}

export function receberMensagem(db, { telefone, texto, deMim }) {
  if (!telefone || deMim) return null;
  const candidatos = [telefone, telefone.length === 12 ? `${telefone.slice(0, 4)}9${telefone.slice(4)}` : null].filter(Boolean);
  const lead = db.prepare(`SELECT * FROM leads WHERE telefone IN (${candidatos.map(() => '?').join(',')})`).get(...candidatos);
  if (!lead) return null;
  registrarReacao(db, lead, { texto, sair: PEDIU_PARA_SAIR.test(texto), origem: 'whatsapp' });
  return lead.id;
}

// Reação do lead ao envio, venha do webhook ou dos botões do Painel (você conversa na mão).
// Aprende só com a primeira reação (as mensagens seguintes da conversa não são novos exemplos).
export function registrarReacao(db, lead, { texto = '', sair = false, origem = 'whatsapp' }) {
  db.prepare('UPDATE leads SET etapa = ?, atualizado_em = ? WHERE id = ?').run(sair ? 'nao_contatar' : 'respondeu', agora(), lead.id);
  if (sair) db.prepare("UPDATE envios SET status = 'cancelado' WHERE lead_id = ? AND status = 'aprovado'").run(lead.id);
  const quem = origem === 'manual' ? ' (você marcou)' : '';
  registrar(db, 'leo', sair ? 'opt_out' : 'resposta', sair ? `${lead.nome} pediu para não receber mais mensagens${quem}` : `${lead.nome} respondeu${quem}${texto ? `: "${texto.slice(0, 120)}"` : ''}`, { lead_id: lead.id });
  if (lead.decisao && ['enviado', 'sem_resposta'].includes(lead.etapa)) {
    const a = aprender(db, 'resposta', lead, sair ? 0 : 1, sair ? 1.5 : 1);
    registrar(db, 'nova', 'aprendizado', `Aprendi com a ${sair ? 'recusa' : 'resposta'} de ${lead.nome} (previa ${Math.round(a.p_antes * 100)}% · ${a.n} exemplos)`, { lead_id: lead.id });
  }
}

const ETAPAS_DE_CONVERSA = ['enviado', 'sem_resposta', 'respondeu'];
function leadEmConversa(db, id) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!lead) throw Object.assign(new Error('lead não encontrado'), { status: 404 });
  if (!ETAPAS_DE_CONVERSA.includes(lead.etapa)) throw Object.assign(new Error(`só vale depois do envio (este lead está em "${lead.etapa}"): marque "Já enviei à mão" primeiro`), { status: 409 });
  return lead;
}

// "Respondeu" (ou "pediu para sair"): você viu a resposta no WhatsApp e avisa o sistema.
export function marcarRespondeu(db, id, { sair = false } = {}) {
  const lead = leadEmConversa(db, id);
  if (lead.etapa === 'respondeu' && !sair) return lead;
  registrarReacao(db, lead, { sair, origem: 'manual' });
  return lead;
}

// "Fechou por R$ X": o único dado que o sistema não consegue ver sozinho.
export function fecharNegocio(db, id, { valor, servico = null }) {
  const v = Number(valor);
  if (!Number.isFinite(v) || v < 0 || v > 10_000_000) throw Object.assign(new Error('valor inválido (use um número em reais, de 0 a 10 milhões)'), { status: 400 });
  const lead = leadEmConversa(db, id);
  if (lead.etapa !== 'respondeu') registrarReacao(db, lead, { origem: 'manual' }); // fechar implica que respondeu
  const svc = servico ? String(servico).slice(0, 120) : null;
  db.prepare("INSERT INTO negocios (lead_id, valor, servico, fechado_em) VALUES (?, ?, ?, ?) ON CONFLICT(lead_id) DO UPDATE SET valor = excluded.valor, servico = excluded.servico")
    .run(lead.id, v, svc, agora());
  db.prepare("UPDATE leads SET etapa = 'fechado', atualizado_em = ? WHERE id = ?").run(agora(), lead.id);
  registrar(db, 'leo', 'fechado', `${lead.nome}: FECHADO por R$ ${v.toLocaleString('pt-BR')}${svc ? ` (${svc})` : ''}`, { lead_id: lead.id, dados: { valor: v, servico: svc } });
  return { lead, valor: v };
}

// "Não fechou": a conversa acabou sem negócio. Conta como resposta, mas não como venda.
export function marcarPerdido(db, id, { motivo = null } = {}) {
  const lead = leadEmConversa(db, id);
  if (lead.etapa !== 'respondeu') registrarReacao(db, lead, { origem: 'manual' });
  db.prepare("UPDATE leads SET etapa = 'perdido', atualizado_em = ? WHERE id = ?").run(agora(), lead.id);
  registrar(db, 'leo', 'perdido', `${lead.nome}: conversa encerrada sem fechar${motivo ? ` (${String(motivo).slice(0, 80)})` : ''}`, { lead_id: lead.id });
  return lead;
}

// ------------------------------------------------------------------ Alva

// Silêncio também é sinal: 72 h depois do envio sem resposta, vira exemplo negativo.
export function verificarSemResposta(db, horas = 72) {
  const limite = new Date(Date.now() - horas * 3600_000).toISOString();
  const calados = db.prepare(`SELECT l.* FROM leads l JOIN envios e ON e.lead_id = l.id
    WHERE l.etapa = 'enviado' AND e.status = 'enviado' AND e.enviado_em < ?`).all(limite);
  for (const l of calados) {
    db.prepare("UPDATE leads SET etapa = 'sem_resposta', atualizado_em = ? WHERE id = ?").run(agora(), l.id);
    if (l.decisao) aprender(db, 'resposta', l, 0);
  }
  if (calados.length) registrar(db, 'nova', 'aprendizado', `${calados.length} lead(s) sem resposta em ${horas} h viraram exemplo negativo`);
  return calados.length;
}

export function abrirExpediente(db) {
  verificarSemResposta(db);
  const ajustes = lerAjustes(db);
  const limite = new Date(Date.now() - ajustes.varredura.refazer_apos_h * 3600_000).toISOString();
  const vencidas = db.prepare('SELECT * FROM varreduras WHERE ativa = 1 AND (ultima_execucao IS NULL OR ultima_execucao < ?)').all(limite);
  for (const v of vencidas) enfileirar(db, 'varrer', String(v.id));
  // leads que ficaram pela metade em uma execução anterior voltam para a etapa certa
  // (o Controle pode reabrir qualquer nó; leads presos ficam de fora até alguém reprocessar)
  for (const [etapa, job] of [['descoberto', 'auditar'], ['auditado', 'qualificar'], ['qualificado', 'redigir']]) {
    for (const l of db.prepare('SELECT * FROM leads WHERE etapa = ?').all(etapa)) {
      if (estaPreso(db, l.id)) continue;
      semearDoLead(db, l); // lead de antes da crença: o portão precisa dos fatos que a linha já tem
      passar(db, 'controle', job, l.id);
    }
  }
  const b = briefing(db);
  registrar(db, 'alva', 'briefing', `Expediente aberto: ${vencidas.length} varredura(s) reaberta(s) · ${b.para_aprovar} mensagem(ns) esperando sua aprovação · ${b.enviados_hoje}/${b.limite} envios hoje`, { dados: b });
}

export function briefing(db) {
  const c = (etapa) => db.prepare('SELECT COUNT(*) n FROM leads WHERE etapa = ?').get(etapa).n;
  const s = situacaoDoEnvio(db);
  return {
    leads: db.prepare('SELECT COUNT(*) n FROM leads').get().n,
    para_aprovar: c('mensagem'),
    responderam: c('respondeu') + c('fechado') + c('perdido'),
    fechados: c('fechado'),
    receita: db.prepare('SELECT COALESCE(SUM(valor), 0) v FROM negocios').get().v,
    enviados_hoje: s.enviados_hoje,
    limite: s.limite,
    na_fila: s.na_fila,
  };
}

// ------------------------------------------------------------------ orquestrador

export function criarOrquestrador(db) {
  // uma tarefa por laço (o Atlas tem dois: varrer e auditar), para um não apagar o status do outro
  const tarefas = {};
  let pausado = lerFlag(db, 'pausado', false);
  let parar = false;
  const controlador = criarControlador(db);
  const ctxDo = (laco) => ({ tarefa(_agente, texto) { tarefas[laco] = { texto, desde: agora() }; }, usar: null });
  const livre = (laco) => { delete tarefas[laco]; };

  const handlers = { varrer: ['atlas', varrer], auditar: ['atlas', auditar], qualificar: ['nova', qualificar], redigir: ['maia', redigir] };
  const lacosDo = { alva: [], atlas: ['varrer', 'auditar'], nova: ['qualificar'], maia: ['redigir'], leo: ['despachar'] };

  async function laco(tipo) {
    const [agente, fn] = handlers[tipo];
    const ctx = ctxDo(tipo);
    while (!parar) {
      if (pausado) { await esperar(2000); continue; }
      if (CONTROLADOS.has(tipo) && !controlador.permite(tipo)) { await esperar(5000); continue; }
      const job = pegarJob(db, tipo);
      if (!job) { await esperar(1500); continue; }
      const leadId = tipo === 'varrer' ? null : job.ref;
      if (leadId && estaPreso(db, leadId)) { concluirJob(db, job.id); continue; }
      if (leadId) semearDoLead(db, db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId));
      const versaoAntes = leadId ? versaoDe(db, leadId) : 0;
      let falhou = false;
      const plano = abrirPlano(tipo, job.id);
      ctx.usar = plano.usar;
      try {
        await fn(db, job, ctx);
        concluirJob(db, job.id);
      } catch (e) {
        falhou = true;
        const volta = falharJob(db, job, e);
        registrar(db, agente, 'erro', `${tipo} ${job.ref}: ${e.message}${volta ? ' (vai tentar de novo)' : ' (desistiu após 3 tentativas)'}`, { lead_id: leadId });
      } finally {
        livre(tipo);
        fecharJob(tipo, agente, falhou ? null : leadId, versaoAntes, plano.fechar());
      }
    }
  }

  // fim de cada job: placar de fidelidade e progresso da crença do lead.
  // Job que falhou não conta ciclo: falha de infraestrutura (Ollama, rede) já tem o limite de 3 tentativas.
  function fecharJob(tipo, agente, leadId, versaoAntes, fid) {
    registrarFidelidade(db, fid);
    if (!fid.preservou) registrar(db, agente, 'fidelidade', `${tipo}: ${fid.desvios.join('; ')}`, { lead_id: leadId, dados: fid });
    if (!leadId) return;
    const etapa = db.prepare('SELECT etapa FROM leads WHERE id = ?').get(leadId)?.etapa;
    const c = fecharCiclo(db, leadId, versaoAntes, etapa);
    if (c.preso && c.padrao) {
      const d = lerCrenca(db, leadId, etapa).progresso.diagnostico;
      registrar(db, 'alva', 'preso', `Tirei da fila (${d.padrao}): ${c.motivo}. ${d.recuperacao}.`, { lead_id: leadId, dados: d });
    }
  }

  async function lacoLeo() {
    const ctx = ctxDo('despachar');
    while (!parar) {
      if (!pausado) {
        try { await despachar(db, ctx); } catch (e) { registrar(db, 'leo', 'erro', e.message); } finally { livre('despachar'); }
      }
      await esperar(15_000);
    }
  }

  function estado() {
    const pendentes = Object.fromEntries(db.prepare("SELECT tipo, COUNT(*) n FROM jobs WHERE status = 'pendente' GROUP BY tipo").all().map((r) => [r.tipo, r.n]));
    return Object.fromEntries(Object.entries(lacosDo).map(([ag, lacos]) => {
      const ativas = lacos.map((l) => tarefas[l]).filter(Boolean);
      const fila = lacos.reduce((a, l) => a + (pendentes[l] || 0), 0);
      return [ag, { status: ativas.length ? 'trabalhando' : pausado ? 'pausado' : 'ocioso', tarefas: ativas, fila }];
    }));
  }

  return {
    iniciar() {
      abrirExpediente(db);
      Object.keys(handlers).forEach((t) => laco(t));
      lacoLeo();
      setInterval(() => { if (!pausado) registrar(db, 'alva', 'briefing', resumoBriefing(briefing(db)), { dados: briefing(db) }); }, 6 * 3600_000).unref();
      setInterval(() => verificarSemResposta(db), 3600_000).unref();
    },
    parar() { parar = true; },
    pausar(v) { pausado = v; salvarFlag(db, 'pausado', v); },
    get pausado() { return pausado; },
    estado,
    controlador,
  };
}

const resumoBriefing = (b) => `Resumo: ${b.leads} leads · ${b.para_aprovar} para aprovar · ${b.responderam} responderam · ${b.enviados_hoje}/${b.limite} envios hoje`;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
