// Configurador de agentes por conversa: uma entrevista guiada e determinística que monta a
// ficha do agente (identidade, regras, ferramentas, aprendizado) no padrão do AGENT_FOUNDRY_GEN01.
// Não depende de modelo de linguagem: cada etapa valida a resposta e só avança com ela certa.

export const FERRAMENTAS = {
  varrer_maps: 'Varrer empresas no Google Maps / OpenStreetMap',
  auditar_site: 'Auditar o site de uma empresa (fatos medidos)',
  decidir: 'Motor de decisão com probabilidades (estilo Jev)',
  escrever_mensagem: 'Escrever mensagem a partir de fatos',
  enviar_whatsapp: 'Enviar WhatsApp (sempre com sua aprovação)',
  base_conhecimento: 'Consultar a base de conhecimento (anexos)',
};

export const REGRAS_PADRAO = [
  'Não inventar dados, números, fontes ou leis; dizer "não sei" quando não souber',
  'Separar fato, inferência, hipótese e recomendação',
  'Pedir aprovação antes de qualquer ação externa (mensagem, envio, publicação)',
  'Nunca expor dados pessoais nem segredos',
];

const MODOS = ['Consultivo', 'Operacional', 'Pesquisa', 'Atendimento', 'Revisão'];
const TONS = ['Sênior, direto e técnico', 'Próximo e acolhedor', 'Formal e cuidadoso'];
const APRENDIZADO = ['A cada interação (feedback na hora)', 'Revisão diária', 'Revisão semanal'];
export const CORES = ['#e8590c', '#0ca678', '#d6336c', '#1971c2', '#f59f00', '#7048e8', '#2b8a3e', '#c2255c'];

export const ETAPAS = ['nome', 'papel', 'modos', 'identidade', 'regras', 'ferramentas', 'aprendizado', 'revisao'];

const lista = (t) => String(t).split(/[,;\n]|\s+e\s+/).map((s) => s.trim()).filter(Boolean);
const sem = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
// Para cada parte da resposta: igual exato, depois prefixo, depois trecho — e só se for inequívoco.
function casa(texto, opcoes) {
  const achadas = [];
  for (const p of lista(texto).map(sem)) {
    const exata = opcoes.find((o) => sem(o) === p);
    const candidatas = exata ? [exata] : opcoes.filter((o) => sem(o).startsWith(p) || (p.length >= 4 && sem(o).includes(p)));
    if (candidatas.length === 1 && !achadas.includes(candidatas[0])) achadas.push(candidatas[0]);
  }
  return achadas;
}

export function pergunta(etapa, ficha) {
  const n = ficha.nome || 'o agente';
  switch (etapa) {
    case 'nome': return { texto: 'Vamos montar um agente novo. Como ele vai se chamar?' };
    case 'papel': return { texto: `Qual é a especialidade do ${n}? Ex.: consultor tributário sênior, pesquisador de leads, redator de propostas.` };
    case 'modos': return { texto: `Como o ${n} atua? Escolha um ou mais modos (ou escreva os seus, separados por vírgula).`, opcoes: MODOS, multipla: true };
    case 'identidade': return { texto: `Como o ${n} fala e se comporta? Tom, postura e nível de experiência.`, opcoes: TONS };
    case 'regras': return { texto: `Quais limites o ${n} nunca pode passar? Já incluo estas regras de base:\n• ${REGRAS_PADRAO.join('\n• ')}\nEscreva outras (uma por linha) ou siga só com as de base.`, opcoes: ['Só as regras de base'] };
    case 'ferramentas': return { texto: `Quais ferramentas do sistema o ${n} pode usar? Ele só age por elas — nada fora da lista.`, opcoes: [...Object.values(FERRAMENTAS), 'Nenhuma'], multipla: true };
    case 'aprendizado': return { texto: `Como o ${n} aprende? Ele registra o raciocínio de cada tarefa e o seu feedback ajusta as instruções.`, opcoes: APRENDIZADO };
    case 'revisao': return { texto: `Pronto. Confira a ficha do ${n} abaixo. Quer ativar ou corrigir algo?`, opcoes: ['Ativar agente', 'Corrigir nome', 'Corrigir papel', 'Corrigir modos', 'Corrigir identidade', 'Corrigir regras', 'Corrigir ferramentas', 'Corrigir aprendizado'] };
    default: return { texto: '' };
  }
}

// Recebe a resposta do operador na etapa atual e devolve a nova ficha, a próxima etapa e
// (se a resposta não serviu) o motivo, sem avançar.
export function responder({ etapa, ficha, voltarPara }, textoBruto) {
  const texto = String(textoBruto || '').trim();
  const f = { ...ficha };
  const proxima = () => voltarPara || ETAPAS[ETAPAS.indexOf(etapa) + 1];
  const erro = (motivo) => ({ etapa, ficha, voltarPara, erro: motivo });
  if (!texto) return erro('Escreva uma resposta ou escolha uma opção.');

  switch (etapa) {
    case 'nome': {
      const nome = texto.replace(/^(o |a )?(nome (dele|dela|é)|chama(-se)?|se chama)\s*/i, '').replace(/[."!]+$/, '').trim();
      if (nome.length < 2 || nome.length > 40) return erro('O nome precisa ter de 2 a 40 caracteres.');
      f.nome = nome.charAt(0).toUpperCase() + nome.slice(1);
      break;
    }
    case 'papel':
      if (texto.length < 4) return erro('Descreva a especialidade com um pouco mais de detalhe.');
      f.papel = texto.slice(0, 160);
      break;
    case 'modos': {
      const escolhidos = casa(texto, MODOS);
      f.modos = escolhidos.length ? escolhidos : lista(texto).slice(0, 5).map((s) => s.slice(0, 40));
      break;
    }
    case 'identidade':
      f.identidade = texto.slice(0, 240);
      break;
    case 'regras': {
      const extras = /^só as regras de base$/i.test(texto) ? [] : texto.split(/\n|;/).map((s) => s.replace(/^[•\-*\s]+/, '').trim()).filter((s) => s.length > 3);
      f.regras = [...REGRAS_PADRAO, ...extras.slice(0, 10)];
      break;
    }
    case 'ferramentas': {
      if (/^nenhuma$/i.test(texto)) { f.ferramentas = []; break; }
      const rotulos = casa(texto, Object.values(FERRAMENTAS));
      const porRotulo = Object.entries(FERRAMENTAS).filter(([k, rotulo]) => rotulos.includes(rotulo) || lista(texto).includes(k));
      if (!porRotulo.length) return erro(`Não reconheci nenhuma ferramenta. Opções: ${Object.values(FERRAMENTAS).join('; ')}.`);
      f.ferramentas = porRotulo.map(([k]) => k);
      break;
    }
    case 'aprendizado': {
      const [a] = casa(texto, APRENDIZADO);
      f.aprendizado = a || texto.slice(0, 80);
      break;
    }
    case 'revisao': {
      if (/^ativar/i.test(texto)) return { etapa: 'revisao', ficha: f, ativar: true };
      const m = texto.match(/^corrigir\s+(\w+)/i);
      const alvo = m && ETAPAS.find((e) => e === m[1].toLowerCase());
      if (!alvo || alvo === 'revisao') return erro('Escolha "Ativar agente" ou "Corrigir …".');
      return { etapa: alvo, ficha: f, voltarPara: 'revisao' };
    }
    default: return erro('Etapa desconhecida.');
  }
  const prox = proxima();
  return { etapa: prox, ficha: f, voltarPara: prox === 'revisao' ? null : voltarPara };
}

// Prompt de sistema gerado da ficha, no formato dos 03_SYSTEM_PROMPT.md do AGENT_FOUNDRY.
export function promptDeSistema(f) {
  const ferr = (f.ferramentas || []).map((k) => `- ${k}: ${FERRAMENTAS[k]}`).join('\n') || '- nenhuma (só conversa)';
  return `Você é ${f.nome}, ${f.papel}.
Modos de atuação: ${(f.modos || []).join(', ')}.
Identidade: ${f.identidade}.

Regras inegociáveis:
${(f.regras || REGRAS_PADRAO).map((r) => `- ${r}`).join('\n')}

Ferramentas permitidas (você não age fora delas):
${ferr}

Aprendizado: ${f.aprendizado}. Registre o raciocínio de cada tarefa; o feedback do operador ajusta estas instruções.
Diga sempre que você é uma IA. Nunca afirme que fez algo que a ferramenta não confirmou.`;
}
