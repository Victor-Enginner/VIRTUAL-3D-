// Proveniência de cada número da tela (evolução 1, "selo de verdade"; evidência primeiro: arXiv 2609.12360).
// Toda contagem que vai para a tela sai com uma FICHA: de que tabela, com que filtro (inclusive a sessão), por qual
// consulta e quando. Número sem ficha não dá para auditar — foi assim que o resumo mostrou "130 leads" numa sessão zerada.
import { sessaoAtiva } from './sessoes.mjs';

export function ficha(db, { tabela, filtro, sql, porSessao = true }) {
  const s = porSessao ? sessaoAtiva(db) : null;
  return {
    tabela,
    filtro: [filtro, s ? `sessão "${s.nome}" (#${s.id})` : 'todas as sessões'].filter(Boolean).join(' · '),
    consulta: sql.replace(/\s+/g, ' ').trim(),
    sessao: s ? { id: s.id, nome: s.nome } : null,
    em: new Date().toISOString(),
  };
}

// frase curta para o title/tooltip da tela
export const fraseDaFicha = (f) => `Origem: tabela ${f.tabela} · ${f.filtro} · ${new Date(f.em).toLocaleTimeString('pt-BR')}`;
