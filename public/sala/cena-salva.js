// Retrato da Sala 3D entre páginas. Cada página do sistema é separada, então ao sair da Sala e voltar a cena era
// reconstruída do zero (agentes de volta às mesas, câmera no padrão, "tudo muda novamente"). Aqui guardamos onde cada
// agente estava e para onde a câmera olhava, na sessão da aba (sessionStorage), e a Sala continua de onde parou.
// Módulo puro (recebe o "armazenamento"): os testes provam validade, descarte de lixo e posições fora da sala.
export const CHAVE = 'prospector.sala.cena.v1';
export const VALIDADE_MS = 15 * 60_000;       // depois disso a cena recomeça do zero: a vida real da sala já seguiu em frente
const LIMITE = { x: 12.6, z: 8.6 };            // dentro das paredes (26 × 18 m)
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const trio = (v) => Array.isArray(v) && v.length === 3 && v.every(num);

export function lerCena(armazenamento, agora = Date.now()) {
  try {
    const c = JSON.parse(armazenamento?.getItem(CHAVE) || 'null');
    if (!c || !num(c.em) || agora - c.em > VALIDADE_MS || c.em - agora > 60_000) return null; // velha ou "do futuro"
    const ag = {};
    for (const [id, s] of Object.entries(c.ag || {})) {
      if (!s || !num(s.x) || !num(s.z) || Math.abs(s.x) > LIMITE.x || Math.abs(s.z) > LIMITE.z) continue; // posição inválida: o agente recomeça na mesa
      ag[id] = {
        x: s.x, z: s.z, rot: num(s.rot) ? s.rot : 0,
        pontoDePausa: typeof s.pontoDePausa === 'string' ? s.pontoDePausa : null,
        ultimaArea: typeof s.ultimaArea === 'string' ? s.ultimaArea : null,
        ultimaAtividade: num(s.ultimaAtividade) ? s.ultimaAtividade : null,
      };
    }
    // a câmera só volta se você a tinha mexido; senão a vista geral é recalculada para o tamanho da janela
    const cam = c.cam && c.cam.mexida && trio(c.cam.p) && trio(c.cam.t) ? { p: c.cam.p, t: c.cam.t } : null;
    return { em: c.em, ag, equipe: num(c.equipe) ? c.equipe : null, cam };
  } catch { return null; }
}

export function salvarCena(armazenamento, cena, agora = Date.now()) {
  try { armazenamento.setItem(CHAVE, JSON.stringify({ ...cena, em: agora })); return true; } catch { return false; }
}
