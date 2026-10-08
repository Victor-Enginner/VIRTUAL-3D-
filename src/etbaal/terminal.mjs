// Terminal do Etbaal (2º andar): o Victor digita, o Etbaal responde em TEXTO (agentes não falam por voz).
// Comandos por REGRA (fato é regra): cada resposta vem do banco (tabela seguranca) — nenhum número inventado.
import { resumo, rodarLote, pendentes } from './index.mjs';

const sem = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const AJUDA = [
  'comandos:',
  '  status            placar das auditorias',
  '  auditar [n]       audita os próximos n sites (1–30, padrão 10)',
  '  piores [n]        os sites mais vulneráveis',
  '  ver <nome>        auditoria completa de um lead',
  '  comuns            falhas mais frequentes',
  '  fila              quantos sites esperam auditoria',
  '  regras            o que o Etbaal pode e não pode fazer',
  '  limpar            limpa a tela',
];

export async function executar(db, especificacao, entrada) {
  const [cmd, ...resto] = sem(entrada).split(/\s+/);
  const arg = resto.join(' ');
  const r = resumo(db, true);
  const auditados = r.ultimas.filter((a) => a.auditado);
  switch (cmd) {
    case '': return [];
    case 'ajuda': case 'help': case '?': return AJUDA;
    case 'limpar': case 'clear': case 'cls': return { limpar: true };
    case 'status':
      return [`auditados: ${r.auditados} · nota média: ${r.nota_media ?? '—'}/100 · com falha grave: ${r.com_falha_grave} · na fila: ${r.pendentes}`];
    case 'fila': return [`${r.pendentes} site(s) próprio(s) esperando auditoria.`];
    case 'comuns':
      return r.mais_comuns.length ? r.mais_comuns.map((m) => `${String(m.n).padStart(3)}× ${m.id}`) : ['nenhuma auditoria ainda.'];
    case 'piores': {
      const n = Math.min(Math.max(Number(arg) || 5, 1), 20);
      return [...auditados].sort((a, b) => a.nota - b.nota).slice(0, n).map((a) => `${String(a.nota).padStart(3)}/100  ${a.nome}  (${a.host})`);
    }
    case 'ver': {
      if (!arg) return ['uso: ver <parte do nome>'];
      const a = r.ultimas.find((x) => sem(x.nome).includes(arg));
      if (!a) return [`nenhum lead auditado com "${arg}".`];
      if (!a.auditado) return [`${a.nome}: não auditado — ${a.motivo}`];
      return [`${a.nome} · ${a.host} · nota ${a.nota}/100 · ${new Date(a.em).toLocaleString('pt-BR')}`,
        ...a.achados.map((x) => `  [${x.severidade.toUpperCase()}] ${x.titulo}`), ...a.achados.map((x) => `    evidência: ${x.evidencia} (${x.norma})`)];
    }
    case 'regras':
      return [`pode usar: ${especificacao.permissoes.ferramentas.join(', ')}`, `proibido: ${especificacao.permissoes.proibido.join(', ')}`,
        `limite: ${especificacao.permissoes.por_dia} sites/dia · só domínio próprio: ${especificacao.limites.so_dominio_proprio ? 'sim' : 'não'}`];
    case 'auditar': {
      const n = Math.min(Math.max(Number(arg) || 10, 1), 30);
      if (!pendentes(db, 1, true).length) return ['fila vazia: nenhum site próprio sem auditoria.'];
      const { feitos, ja_rodando } = await rodarLote(db, { limite: n, todas: true });
      if (ja_rodando) return ['já estou auditando; espere terminar.'];
      return [`auditei ${feitos.length} site(s):`, ...feitos.map((f) => f.auditado ? `  ${String(f.nota).padStart(3)}/100  ${f.nome} — ${f.achados.length} achado(s)` : `  —  ${f.nome}: ${f.motivo}`)];
    }
    default: return [`comando desconhecido: "${cmd}". digite ajuda.`];
  }
}
