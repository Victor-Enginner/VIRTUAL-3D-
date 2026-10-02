// Máquina de estados dos agentes na sala, a partir do estado REAL vindo da API.
// Módulo puro: recebe o que o agente está fazendo e devolve para onde ele deve ir e o que fazer.
//
//   trabalhando  → tem tarefa em execução: vai para a mesa, senta e digita
//   pausa        → ocioso há mais que PAUSA_APOS_MS: levanta e vai à copa (café), janela ou biblioteca
//   conversando  → em pausa e outro agente em pausa no mesmo ponto: viram um para o outro
//   apresentando → acabou de fazer o briefing (Alva) ou relatório: fica em pé na TV da reunião
//   desligado    → agentes pausados pelo operador: descansam no sofá do lounge
//   na_mesa      → ocioso há pouco tempo: continua sentado, sem digitar (pode vir tarefa já)

export const PAUSA_APOS_MS = 45_000;      // a especificação fala em 15 min; na demonstração ao vivo 45 s mostra a vida da sala
export const APRESENTACAO_MS = 25_000;
export const TEMPO_NO_PONTO_MS = [18_000, 40_000]; // quanto tempo fica na copa/janela antes de trocar de lugar

export function proximoEstado(ag, agora) {
  if (ag.pausadoGlobal) return { estado: 'desligado', destino: 'sofa' };
  if (ag.trabalhando) return { estado: 'trabalhando', destino: 'mesa' };
  if (ag.apresentarAte && agora < ag.apresentarAte) return { estado: 'apresentando', destino: 'tv' };
  if (ag.chamadoAteMs && agora < ag.chamadoAteMs) return { estado: 'na_mesa', destino: 'mesa' };
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
