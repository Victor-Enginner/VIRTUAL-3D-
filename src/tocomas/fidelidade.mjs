// Fidelidade ao plano (Planning-as-Routing, arXiv 2609.38108): cada job declara antes as ferramentas
// do seu nó; o executor anota o que usou; ferramenta fora da lista é desvio. O modo do plano é
// escolhido por regra — o paper mostra que o modelo escolhe mal o modo sozinho.
import { lerFlag, salvarFlag } from '../db.mjs';
import { exigir } from './contratos.mjs';
import { NOS, noDoJob } from './grafo.mjs';

const MODO = { varrer: 'busca' }; // o resto do pipeline é fixo

export function abrirPlano(tipo, id) {
  const no = noDoJob(tipo);
  if (!no) throw new Error(`job sem nó no grafo: ${tipo}`);
  const plano = exigir('plano', { id: `${tipo}-${id}`, modo: MODO[tipo] || 'predefinido', passos: [{ no, ferramentas: NOS[no].ferramentas }] });
  const usadas = [];
  return {
    plano,
    usar(ferramenta) { if (!usadas.includes(ferramenta)) usadas.push(ferramenta); },
    fechar() {
      const declaradas = plano.passos.flatMap((p) => p.ferramentas);
      const desvios = usadas.filter((f) => !declaradas.includes(f)).map((f) => `ferramenta não declarada: ${f}`);
      return exigir('fidelidade', { plano_id: plano.id, declaradas, usadas: [...usadas], preservou: !desvios.length, desvios });
    },
  };
}

// placar acumulado, para o Painel e a Base do Mestre
export function registrarFidelidade(db, rel) {
  const f = lerFlag(db, 'fidelidade', { total: 0, preservados: 0, ultimos_desvios: [] });
  f.total += 1;
  if (rel.preservou) f.preservados += 1;
  else f.ultimos_desvios = [{ plano: rel.plano_id, desvios: rel.desvios }, ...f.ultimos_desvios].slice(0, 10);
  salvarFlag(db, 'fidelidade', f);
  return f;
}
