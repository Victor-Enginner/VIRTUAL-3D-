// Modo DEMONSTRAÇÃO (DEMO=1): a versão pública para mostrar o Prospector a amigos (Render + Netlify).
// - Banco em memória com empresas FICTÍCIAS (todas marcadas "(exemplo)"); nada dos leads reais sai do PC.
// - Simulador no lugar dos agentes reais: sem Maps, sem Ollama, sem WhatsApp. Ele move leads pelo
//   pipeline num ritmo calmo para a Sala 3D, o Painel e o Engine ficarem vivos.
// - Toda reinicialização recomeça do zero (o Render gratuito reinicia quando fica parado).
import { agora, enfileirar, json, lerAjustes, salvarAjustes } from './db.mjs';
import { registrar } from './eventos.mjs';
import { NICHOS } from './nichos.mjs';
import { mensagemFallback, nivelOportunidade, angulosPermitidos, ROTULO_ABORDAGEM } from './agentes.mjs';
import { registrarFatos } from './tocomas/crenca.mjs';

// nomes genéricos e claramente fictícios — não imitam empresas reais
const MODELOS = [
  ['barbearia', 'Barbearia Navalha (exemplo)'], ['barbearia', 'Barbearia Dom Bigode (exemplo)'], ['barbearia', 'Studio do Corte (exemplo)'],
  ['estetica', 'Clínica Pele Leve (exemplo)'], ['estetica', 'Espaço Bem-Estar (exemplo)'], ['estetica', 'Estética Aurora (exemplo)'],
  ['energia_solar', 'Sol Forte Energia (exemplo)'], ['energia_solar', 'Painel Verde Solar (exemplo)'], ['energia_solar', 'Luz do Campo Solar (exemplo)'],
  ['academia', 'Academia Impulso (exemplo)'], ['academia', 'Box Força Total (exemplo)'],
  ['pet_shop', 'Pet Amigo (exemplo)'], ['pet_shop', 'Banho & Tosa Patinhas (exemplo)'],
  ['padaria', 'Padaria Pão Quente (exemplo)'], ['padaria', 'Confeitaria Doce Hora (exemplo)'],
  ['oficina', 'Auto Center Pistão (exemplo)'], ['oficina', 'Oficina Roda Livre (exemplo)'],
  ['odontologia', 'Sorriso Claro Odonto (exemplo)'], ['odontologia', 'Clínica Dente Feliz (exemplo)'],
  ['restaurante', 'Cantina da Praça (exemplo)'], ['restaurante', 'Sabor Caseiro (exemplo)'],
  ['imobiliaria', 'Imóveis Chave Certa (exemplo)'], ['advocacia', 'Escritório Lima & Souza (exemplo)'],
  ['salao_unhas', 'Esmalteria Brilho (exemplo)'],
];
const CIDADES = [['Franca', 'SP'], ['Ribeirão Preto', 'SP'], ['Uberaba', 'MG']];
const SITUACOES_DEMO = ['sem_site', 'sem_site', 'so_rede_social', 'so_agendamento', 'site_gratuito', 'site_fora_do_ar', 'site_proprio'];
const SINAIS = { site_gratuito: ['sem domínio próprio', 'não adaptado ao celular'], site_fora_do_ar: ['endereço não abre'], site_proprio: [] };

let semente = 20261004;
const acaso = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;
const escolher = (lista) => lista[Math.floor(acaso() * lista.length)];

let contador = 0;
function novoLead(db, etapa) {
  const [nicho, nomeBase] = MODELOS[contador % MODELOS.length];
  const [cidade, uf] = CIDADES[Math.floor(contador / MODELOS.length) % CIDADES.length];
  contador++;
  const id = `demo-${contador}`;
  const situacao = escolher(SITUACOES_DEMO);
  const celular = acaso() > 0.2;
  const tel = `55${uf === 'MG' ? '34' : '16'}${celular ? '9' : '3'}0000${String(contador).padStart(4, '0')}`; // fictício
  const t = agora();
  db.prepare(`INSERT INTO leads (id, nome, categoria, nicho, cidade, uf, telefone, telefone_tipo, site, rating, avaliacoes, fonte, etapa, situacao_site, auditoria, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'maps', ?, ?, ?, ?, ?)`).run(id, nomeBase, NICHOS[nicho]?.rotulo || nicho, nicho, cidade, uf, tel, celular ? 'celular' : 'fixo',
    situacao === 'site_proprio' || situacao === 'site_gratuito' || situacao === 'site_fora_do_ar' ? 'https://exemplo.invalid' : null,
    Math.round((3.8 + acaso() * 1.2) * 10) / 10, Math.floor(8 + acaso() * 300), etapa,
    etapa === 'descoberto' ? null : situacao, etapa === 'descoberto' ? null : json({ sinais: SINAIS[situacao] || [] }), t, t);
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

// decisão "da Nova" no formato real, mas por regra (o demo não tem modelo de decisão)
function qualificar(db, l) {
  const sinais = SINAIS[l.situacao_site] || [];
  const nivel = nivelOportunidade(l.situacao_site, sinais);
  const angulos = angulosPermitidos(l, sinais);
  if (!nivel || !angulos.length) {
    db.prepare("UPDATE leads SET etapa = 'descartado', score = 0, motivo = 'site próprio sem problemas medidos', atualizado_em = ? WHERE id = ?").run(agora(), l.id);
    return 'descartado';
  }
  const angulo = angulos[0];
  const score = Math.round(55 + nivel * 8 + acaso() * 10);
  const decisao = { answers: { oportunidade: { type: 'score', origem: 'regra', probabilities: { [nivel]: 1 }, confidence: 1, level: nivel },
    abordagem: { type: 'choice', origem: 'regra', probabilities: { [angulo]: 1 }, choice: angulo, confidence: 1 } },
    backend: 'demonstracao', model: null, latency_ms: 0, score_regra: score, zona: { zona: 'sem_calibracao', p: 0.5, n: 0, faltam: 30, ece: null } };
  const etapa = l.telefone ? 'qualificado' : 'sem_contato';
  db.prepare('UPDATE leads SET decisao = ?, score = ?, motivo = ?, etapa = ?, atualizado_em = ? WHERE id = ?')
    .run(json(decisao), score, ROTULO_ABORDAGEM[angulo] ? `${l.situacao_site.replace(/_/g, ' ')}` : '', etapa, agora(), l.id);
  registrarFatos(db, l.id, [{ chave: 'angulo', valor: angulo, fonte: 'regra' }, { chave: 'nivel_oportunidade', valor: nivel, fonte: 'regra' }]);
  return etapa;
}

function escrever(db, l) {
  const d = JSON.parse(l.decisao || '{}');
  const texto = mensagemFallback(l, lerAjustes(db), d.answers?.abordagem?.choice || 'ser_encontrado');
  db.prepare("UPDATE leads SET mensagem = ?, mensagem_origem = 'modelo_recusado', etapa = 'mensagem', atualizado_em = ? WHERE id = ?").run(texto, agora(), l.id);
}

export function semearDemo(db) {
  const a = lerAjustes(db);
  salvarAjustes(db, { ...a, remetente_nome: 'Victor', remetente_oferta: 'crio sites e landing pages modernas para negócios locais' });
  for (const [nicho, cidade, uf] of [['barbearia', 'Franca', 'SP'], ['estetica', 'Ribeirão Preto', 'SP'], ['energia_solar', 'Uberaba', 'MG']])
    db.prepare("INSERT INTO varreduras (cidade, uf, nicho, fonte, limite, ativa, ultima_execucao, criado_em) VALUES (?, ?, ?, 'maps', 20, 1, ?, ?)").run(cidade, uf, nicho, agora(), agora());
  // um retrato do pipeline em andamento
  const plano = [['descoberto', 4], ['auditado', 3], ['qualificado', 3], ['mensagem', 6], ['aprovado', 2], ['enviado', 3], ['respondeu', 1]];
  for (const [etapa, n] of plano) for (let i = 0; i < n; i++) {
    let l = novoLead(db, etapa === 'descoberto' ? 'descoberto' : 'auditado');
    registrarFatos(db, l.id, [{ chave: 'telefone', valor: l.telefone, fonte: 'maps' }, ...(l.situacao_site ? [{ chave: 'situacao_site', valor: l.situacao_site, fonte: 'auditoria' }] : [])]);
    if (etapa === 'descoberto' || etapa === 'auditado') continue;
    if (qualificar(db, l) !== 'qualificado') continue;
    l = db.prepare('SELECT * FROM leads WHERE id = ?').get(l.id);
    if (etapa === 'qualificado') continue;
    escrever(db, l);
    if (etapa === 'mensagem') continue;
    db.prepare("UPDATE leads SET etapa = ? WHERE id = ?").run(etapa, l.id);
    db.prepare('INSERT INTO envios (lead_id, telefone, texto, status, enviado_em, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
      .run(l.id, l.telefone, 'mensagem de exemplo', etapa === 'aprovado' ? 'aprovado' : 'enviado', etapa === 'aprovado' ? null : agora(), agora());
  }
  registrar(db, 'alva', 'briefing', 'Modo demonstração: empresas fictícias, nada é enviado. A equipe trabalha sozinha; aprove ou descarte à vontade.');
}

// Simulador: um passo a cada poucos segundos, um agente por vez, com "tarefa" visível na Sala.
export function criarSimulador(db) {
  const tarefas = {};
  let pausado = false, timer = null, parar = false;
  const decisoes = {};
  const trabalhar = (ag, texto, ms, fazer) => new Promise((ok) => {
    tarefas[ag] = { texto, desde: agora() };
    setTimeout(() => { try { fazer(); } finally { delete tarefas[ag]; ok(); } }, ms);
  });
  const um = (etapa) => db.prepare('SELECT * FROM leads WHERE etapa = ? ORDER BY atualizado_em LIMIT 1').get(etapa);

  async function passo() {
    if (pausado || parar) return;
    const r = acaso();
    const total = db.prepare('SELECT COUNT(*) n FROM leads').get().n;
    if (r < 0.2 && total < 70) {
      await trabalhar('atlas', 'Varrendo o mapa (demonstração)', 7000, () => {
        const l = novoLead(db, 'descoberto');
        registrar(db, 'atlas', 'varredura_fim', `Encontrei ${l.nome} em ${l.cidade}-${l.uf}`, { lead_id: l.id });
      });
    } else if (r < 0.4 && um('descoberto')) {
      const l = um('descoberto');
      await trabalhar('atlas', `Auditando ${l.nome}`, 6000, () => {
        const s = escolher(SITUACOES_DEMO);
        db.prepare("UPDATE leads SET etapa = 'auditado', situacao_site = ?, auditoria = ?, atualizado_em = ? WHERE id = ?").run(s, json({ sinais: SINAIS[s] || [] }), agora(), l.id);
        registrarFatos(db, l.id, [{ chave: 'telefone', valor: l.telefone, fonte: 'maps' }, { chave: 'situacao_site', valor: s, fonte: 'auditoria' }]);
        registrar(db, 'atlas', 'auditoria', `${l.nome}: ${s.replace(/_/g, ' ')}`, { lead_id: l.id });
      });
    } else if (r < 0.6 && um('auditado')) {
      const l = um('auditado');
      await trabalhar('nova', `Decidindo sobre ${l.nome}`, 5000, () => {
        const etapa = qualificar(db, db.prepare('SELECT * FROM leads WHERE id = ?').get(l.id));
        registrar(db, 'nova', 'decisao', `${l.nome}: ${etapa === 'qualificado' ? 'vale a abordagem' : etapa === 'descartado' ? 'descartado (site bom)' : 'sem telefone'}`, { lead_id: l.id });
      });
    } else if (r < 0.75 && um('qualificado') && db.prepare("SELECT COUNT(*) n FROM leads WHERE etapa = 'mensagem'").get().n < 12) {
      const l = um('qualificado');
      await trabalhar('maia', `Escrevendo para ${l.nome}`, 8000, () => {
        escrever(db, l);
        registrar(db, 'maia', 'mensagem', `Mensagem pronta para ${l.nome} (texto de exemplo)`, { lead_id: l.id });
      });
    } else if (r < 0.88 && um('aprovado')) {
      const l = um('aprovado');
      await trabalhar('leo', `Enviando para ${l.nome} (simulado)`, 5000, () => {
        db.prepare("UPDATE leads SET etapa = 'enviado', atualizado_em = ? WHERE id = ?").run(agora(), l.id);
        db.prepare("UPDATE envios SET status = 'enviado', enviado_em = ? WHERE lead_id = ? AND status = 'aprovado'").run(agora(), l.id);
        registrar(db, 'leo', 'enviado', `Enviado para ${l.nome} (simulado: nada sai de verdade)`, { lead_id: l.id });
      });
    } else if (r < 0.94 && um('enviado')) {
      const l = um('enviado');
      db.prepare("UPDATE leads SET etapa = 'respondeu', atualizado_em = ? WHERE id = ?").run(agora(), l.id);
      registrar(db, 'leo', 'resposta', `${l.nome} respondeu: "Oi! Quero saber mais." (exemplo)`, { lead_id: l.id });
    } else {
      const b = { para: db.prepare("SELECT COUNT(*) n FROM leads WHERE etapa = 'mensagem'").get().n };
      await trabalhar('alva', 'Resumindo o dia', 4000, () => registrar(db, 'alva', 'briefing', `Resumo: ${b.para} mensagem(ns) esperando aprovação · demonstração com dados fictícios`));
    }
    // limpeza: o banco da demo não cresce para sempre
    db.prepare("DELETE FROM leads WHERE etapa = 'descartado' AND id NOT IN (SELECT id FROM leads WHERE etapa = 'descartado' ORDER BY atualizado_em DESC LIMIT 8) AND id NOT IN (SELECT lead_id FROM envios)").run();
  }

  async function laco() {
    while (!parar) {
      try { await passo(); } catch (e) { console.error('[demo]', e.message); }
      await new Promise((ok) => { timer = setTimeout(ok, 3500 + acaso() * 4000); });
    }
  }

  return {
    iniciar() { laco(); },
    parar() { parar = true; clearTimeout(timer); },
    get pausado() { return pausado; },
    pausar(v) { pausado = v; },
    estado() {
      return Object.fromEntries(['alva', 'atlas', 'nova', 'maia', 'leo'].map((ag) => [ag, { status: tarefas[ag] ? 'trabalhando' : pausado ? 'pausado' : 'ocioso', tarefas: tarefas[ag] ? [tarefas[ag]] : [], fila: 0 }]));
    },
    controlador: { ultimas: () => decisoes },
  };
}

// rotas que mudam algo fora da sandbox (varrer de verdade, comando com modelo, WhatsApp, ajustes…)
export const BLOQUEADAS_NA_DEMO = [
  /^\/api\/varreduras/, /^\/api\/comando$/, /^\/api\/ajustes$/, /^\/api\/whatsapp/, /^\/api\/config-agentes/, /^\/api\/anexos/,
  /^\/api\/leads\/[^/]+\/(reprocessar|enviado-manual)$/, /^\/api\/envios\//, /^\/api\/agentes\/(pausar|retomar)$/, /^\/webhooks\//,
];
