// Máquina de estados dos agentes na sala, a partir do estado REAL vindo da API.
// Módulo puro: recebe o que o agente está fazendo e devolve para onde ele deve ir e o que fazer.
//
//   trabalhando  → tem tarefa em execução: vai para a mesa, senta e digita
//   pausa        → ocioso há mais que PAUSA_APOS_MS: levanta e vai à copa (café), janela ou biblioteca
//   conversando  → em pausa e outro agente em pausa no mesmo ponto: viram um para o outro
//   apresentando → acabou de fazer o briefing (Alva) ou relatório: fica em pé na TV da reunião
//   desligado    → agentes pausados pelo operador: descansam no sofá do lounge
//   na_mesa      → ocioso há pouco tempo: continua sentado, sem digitar (pode vir tarefa já)
//   rotina       → o plano do dia (rotina.js) manda: café, almoço, pausa da tarde
//   reuniao      → reunião diária da Alva às 9h: senta à mesa de reunião (a Alva apresenta na TV)

export const PAUSA_APOS_MS = 45_000;      // a especificação fala em 15 min; na demonstração ao vivo 45 s mostra a vida da sala
export const APRESENTACAO_MS = 25_000;
export const TEMPO_NO_PONTO_MS = [18_000, 40_000]; // quanto tempo fica na copa/janela antes de trocar de lugar

// Prioridades (de cima para baixo): pausado por você > trabalho real > briefing da Alva > você chamou
// a equipe > ROTINA DO DIA (plano: café, reunião, almoço) > ficou ativo há pouco > pausa por ócio.
// `ag.bloco` = o que o plano do dia manda agora (rotina.js), ou null.
export function proximoEstado(ag, agora) {
  if (ag.pausadoGlobal) return { estado: 'desligado', destino: 'sofa' };
  if (ag.trabalhando) return { estado: 'trabalhando', destino: 'mesa' };
  if (ag.apresentarAte && agora < ag.apresentarAte) return { estado: 'apresentando', destino: 'tv' };
  if (ag.chamadoAteMs && agora < ag.chamadoAteMs) return { estado: 'na_mesa', destino: 'mesa' };
  if (ag.bloco) return { estado: ag.bloco.atividade === 'reuniao' ? (ag.bloco.area === 'tv' ? 'apresentando' : 'reuniao') : 'rotina', destino: ag.bloco.area, rotulo: ag.bloco.rotulo };
  if (agora - (ag.ultimaAtividade ?? agora) < PAUSA_APOS_MS) return { estado: 'na_mesa', destino: 'mesa' };
  return { estado: 'pausa', destino: ag.pontoDePausa || 'copa' };
}

// Cada agente tem um "jeito": quem é sociável prefere a copa, quem é focado a biblioteca/janela.
export const PERSONALIDADE = {
  alva: { pontos: ['copa', 'janela', 'copa'], ritmo: 1.0 },
  atlas: { pontos: ['biblioteca', 'janela', 'copa'], ritmo: 1.15 },
  nova: { pontos: ['janela', 'biblioteca', 'copa'], ritmo: 0.9 },
  maia: { pontos: ['copa', 'copa', 'lounge'], ritmo: 1.05 },
  leo: { pontos: ['copa', 'lounge', 'janela'], ritmo: 1.2 },
};

export function sortearPonto(id, aleatorio = Math.random) {
  const p = PERSONALIDADE[id]?.pontos || ['copa', 'janela', 'lounge', 'biblioteca']; // agentes criados no Configurador
  return p[Math.floor(aleatorio() * p.length)];
}

// Escolha da pausa por UTILIDADE (padrão de IA de jogos): cada área ganha uma nota e a maior vence.
// Gosto pessoal (personalidade) + gente conhecida lá (quem é sociável vai para a roda) − repetir o
// mesmo lugar − pouca vaga. Área sem lugar livre nunca é escolhida (ninguém empilha).
const SOCIAVEIS = new Set(['copa', 'lounge']);
export function escolherArea(id, { livres, presentes, ultima }, aleatorio = Math.random) {
  const gosto = PERSONALIDADE[id]?.pontos || ['copa', 'janela', 'lounge', 'biblioteca'];
  const areas = ['copa', 'janela', 'biblioteca', 'lounge'];
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
