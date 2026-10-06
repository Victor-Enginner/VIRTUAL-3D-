// Máquina de estados dos agentes na sala, a partir do estado REAL vindo da API.
// Módulo puro: recebe o que o agente está fazendo e devolve para onde ele deve ir e o que fazer.
//
//   trabalhando  → tem tarefa em execução: vai para a mesa, senta e digita
//   pausa        → ocioso há mais que PAUSA_APOS_MS: levanta e vai à copa (café), janela ou biblioteca
//   conversando  → em pausa e outro agente em pausa no mesmo ponto: viram um para o outro
//   apresentando → acabou de fazer o briefing (Alva) ou relatório: fica em pé na TV da reunião
//   desligado    → agentes pausados pelo operador: ficam sentados na própria mesa (sem digitar)
//   na_mesa      → ocioso há pouco tempo, OU a equipe tem trabalho em andamento: fica sentado, sem digitar (pode vir tarefa já)
//   rotina       → o plano do dia (rotina.js) manda: café, almoço, pausa da tarde
//   reuniao      → reunião diária da Alva às 9h: senta à mesa de reunião (a Alva apresenta na TV)

export const PAUSA_APOS_MS = 120_000;     // um agente só vai passear depois de 2 min ocioso (a especificação fala em 15 min)
// Enquanto QUALQUER agente trabalhou há menos que isto, ninguém sai da mesa: levantar no meio de uma varredura parece defeito.
export const EQUIPE_OCUPADA_MS = 180_000;
export const APRESENTACAO_MS = 25_000;
export const TEMPO_NO_PONTO_MS = [18_000, 40_000]; // quanto tempo fica em um lugar da copa antes de trocar
export const CAFE_DURACAO_MS = [60_000, 120_000];      // um café dura 1–2 min
export const CAFE_INTERVALO_MS = [720_000, 1_200_000];  // e só volta depois de 12–20 min
export const CAFE_PRIMEIRO_MS = [300_000, 720_000];     // ao abrir a sala todos começam sentados: o 1º café só depois de 5–12 min

// Prioridades (de cima para baixo): pausado por você > trabalho real > briefing da Alva > você chamou
// a equipe > EQUIPE OCUPADA (alguém trabalhou há pouco: todos esperam na mesa) > ROTINA DO DIA (plano: café,
// reunião, almoço) > ficou ativo há pouco > pausa por ócio. A rotina e as pausas só valem com a equipe parada.
// `ag.bloco` = o que o plano do dia manda agora (rotina.js), ou null.
export function proximoEstado(ag, agora) {
  if (ag.pausadoGlobal) return { estado: 'desligado', destino: 'mesa' }; // pausado por você: fica sentado na própria mesa
  if (ag.trabalhando) return { estado: 'trabalhando', destino: 'mesa' };
  if (ag.apresentarAte && agora < ag.apresentarAte) return { estado: 'apresentando', destino: 'tv' };
  if (ag.chamadoAteMs && agora < ag.chamadoAteMs) return { estado: 'na_mesa', destino: 'mesa' };
  if (agora - (ag.ultimaAtividadeEquipe ?? -Infinity) < EQUIPE_OCUPADA_MS) return { estado: 'na_mesa', destino: 'mesa' };
  if (ag.bloco) return { estado: ag.bloco.atividade === 'reuniao' ? (ag.bloco.area === 'tv' ? 'apresentando' : 'reuniao') : 'rotina', destino: ag.bloco.area, rotulo: ag.bloco.rotulo };
  if (agora - (ag.ultimaAtividade ?? agora) < PAUSA_APOS_MS) return { estado: 'na_mesa', destino: 'mesa' };
  if (agora < (ag.cafeBloqueadoAte ?? 0)) return { estado: 'na_mesa', destino: 'mesa' }; // o café é raro: um de cada vez, com intervalo
  return { estado: 'pausa', destino: ag.pontoDePausa || 'copa' };
}

// Cada agente tem um "jeito": quem é sociável prefere a copa, quem é focado a biblioteca/janela.
export const PERSONALIDADE = {
  // só saem da mesa para o café (copa) e para as reuniões; o resto do tempo estão sentados
  alva: { pontos: ['copa'], ritmo: 1.0 },
  atlas: { pontos: ['copa'], ritmo: 1.15 },
  nova: { pontos: ['copa'], ritmo: 0.9 },
  maia: { pontos: ['copa'], ritmo: 1.05 },
  leo: { pontos: ['copa'], ritmo: 1.2 },
};

export function sortearPonto(id, aleatorio = Math.random) {
  const p = PERSONALIDADE[id]?.pontos || ['copa']; // agentes criados no Configurador também só saem para o café
  return p[Math.floor(aleatorio() * p.length)];
}

// Escolha da pausa por UTILIDADE (padrão de IA de jogos): cada área ganha uma nota e a maior vence.
// Gosto pessoal (personalidade) + gente conhecida lá (quem é sociável vai para a roda) − repetir o
// mesmo lugar − pouca vaga. Área sem lugar livre nunca é escolhida (ninguém empilha).
const SOCIAVEIS = new Set(['copa', 'lounge']);
export function escolherArea(id, { livres, presentes, ultima }, aleatorio = Math.random) {
  const gosto = PERSONALIDADE[id]?.pontos || ['copa'];
  const areas = ['copa'];
  let melhor = null, nota = -Infinity;
  for (const area of areas) {
    const vagas = livres(area);
    if (!vagas) continue;
    let n = gosto.filter((g) => g === area).length;                 // quantas vezes aparece no "jeito" dele
    if (SOCIAVEIS.has(area) && presentes(area)) n += 0.8;            // tem alguém lá: dá vontade de conversar
    if (area === ultima) n -= 1.5;                                   // acabou de vir de lá
    if (vagas === 1) n -= 0.3;                                       // última vaga: quase cheio
    n += aleatorio() * 0.6;                                          // um pouco de imprevisível
    if (n > nota) { nota = n; melhor = area; }
  }
  return melhor;
}
