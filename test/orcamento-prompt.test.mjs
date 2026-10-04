// B12 (2610.02001): o prompt da Maia não pode engordar sem alguém perceber. Modelo pequeno local perde qualidade com prompt longo.
// B2 (2609.37953): no máximo 3 fatos do lead entram no prompt (hoje é 1 observação).
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, lerAjustes } from '../src/db.mjs';
import { observacao, promptMaia } from '../src/agentes.mjs';

const ORCAMENTO_CHARS = 900; // ~225 tokens; hoje fica em ~690
const ANGULOS = ['ser_encontrado', 'independencia', 'modernizar', 'reputacao', 'recuperar'];
const ajustes = lerAjustes(abrirBanco(':memory:'));
const sinais = ['sem_https', 'sem_viewport', 'lento', 'tecnologia_antiga', 'sem_telefone_no_site', 'copyright_antigo', 'sem_meta', 'sem_h1'];
const lead = { nome: 'Barbearia do Zé', categoria: 'Barbearia', cidade: 'Franca', nicho: 'barbearia', rating: 4.5, avaliacoes: 80, situacao_site: 'site_proprio', auditoria: JSON.stringify({ sinais }) };

test('B12: prompt da Maia cabe no orçamento em todos os ângulos, mesmo com 8 sinais medidos', () => {
  for (const a of ANGULOS) {
    const p = promptMaia(lead, ajustes, a);
    assert.ok(p.sistema.length + p.usuario.length <= ORCAMENTO_CHARS, `${a}: ${p.sistema.length + p.usuario.length} caracteres`);
  }
});

test('B2: a observação não despeja os 8 sinais no prompt (no máximo 3 fatos)', () => {
  for (const a of ANGULOS) {
    const citados = sinais.filter((s) => observacao(lead, a).includes(s));
    assert.ok(citados.length <= 3, `${a} citou ${citados.length} sinais`);
  }
});
