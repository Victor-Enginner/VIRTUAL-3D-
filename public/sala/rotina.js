// Rotina do dia de cada agente — a camada de "plano" dos Generative Agents (Park et al., arXiv 2304.03442):
// cada agente acorda com um plano do dia (café, reunião, almoço, café da tarde) e age por ele, mas
// REAGE ao mundo: trabalho real (um lead chegando) sempre passa na frente do plano.
// Sem LLM: o plano sai do jeito de cada agente + um sorteio estável por dia (muda de um dia para o
// outro, igual dentro do mesmo dia). Módulo puro (sem three.js), testado no Node.

// semente estável por (agente, dia) → números de 0 a 1 (mulberry32)
export function sorteio(id, dia) {
  let h = 2166136261;
  for (const ch of `${id}|${dia}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const min = (h, m = 0) => h * 60 + m;
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const diaDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// o "jeito" de cada um muda o plano: quem é sociável almoça no lounge, quem é focado toma café rápido
const JEITO = {
  // fora a reunião, o plano do dia só tira o agente da mesa para a copa (café, almoço, café da tarde)
  alva: { cafe: 'copa', almoco: 'copa', tarde: 'copa', madrugador: 0 },
  atlas: { cafe: 'copa', almoco: 'copa', tarde: 'copa', madrugador: -10 },
  nova: { cafe: 'copa', almoco: 'copa', tarde: 'copa', madrugador: 5 },
  maia: { cafe: 'copa', almoco: 'copa', tarde: 'copa', madrugador: 10 },
  leo: { cafe: 'copa', almoco: 'copa', tarde: 'copa', madrugador: -5 },
};
const PADRAO = { cafe: 'copa', almoco: 'copa', tarde: 'copa', madrugador: 0 };

// reunião diária da Alva (fixa: é compromisso, todos vão)
export const REUNIAO = { inicio: min(9, 0), fim: min(9, 15) };

// plano do dia: blocos {inicio, fim, atividade, area, rotulo} em minutos desde 00:00
export function planoDoDia(id, dia) {
  const r = sorteio(id, dia);
  const j = JEITO[id] || PADRAO;
  const var5 = (n) => Math.round((r() - 0.5) * 2 * n);
  const durCafe = 12 + var5(3);
  // o café da manhã sempre termina antes da reunião (com 3 min para chegar à sala)
  const cafe = Math.min(min(8, 40) + j.madrugador + var5(8), REUNIAO.inicio - durCafe - 3);
  const almoco = min(12, 0) + var5(20);
  const tarde = min(15, 30) + var5(25);
  const blocos = [
    { inicio: cafe, fim: cafe + durCafe, atividade: 'cafe', area: j.cafe, rotulo: 'Café da manhã' },
    { inicio: REUNIAO.inicio, fim: REUNIAO.fim, atividade: 'reuniao', area: id === 'alva' ? 'tv' : 'reuniao', rotulo: id === 'alva' ? 'Conduz a reunião diária' : 'Reunião diária com a Alva' },
    { inicio: almoco, fim: almoco + 45 + var5(10), atividade: 'almoco', area: j.almoco, rotulo: 'Almoço' },
    { inicio: tarde, fim: tarde + 10 + var5(3), atividade: 'cafe_tarde', area: j.tarde, rotulo: 'Café da tarde' },
  ];
  return blocos.sort((a, b) => a.inicio - b.inicio).map((b) => ({ ...b, das: hhmm(b.inicio), ate: hhmm(b.fim) }));
}

// o que o plano manda fazer agora (ou null); `data` é um Date
export function blocoAgora(plano, data) {
  const m = data.getHours() * 60 + data.getMinutes();
  return plano.find((b) => m >= b.inicio && m < b.fim) || null;
}

// o próximo compromisso (para mostrar "Próximo: almoço 12:05")
export function proximoBloco(plano, data) {
  const m = data.getHours() * 60 + data.getMinutes();
  return plano.find((b) => b.inicio > m) || null;
}
