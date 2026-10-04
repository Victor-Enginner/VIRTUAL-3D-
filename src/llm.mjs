// Geração de texto (só onde texto é o produto: a mensagem de abordagem).
import { CONFIG } from './config.mjs';

export async function gerarTexto({ sistema, usuario, maxTokens = 300, temperatura = 0.6, modelo = CONFIG.modelos.escrita.modelo }) {
  if (!modelo) throw new Error('o LLM da escrita está desligado em modelos.json');
  const r = await fetch(`${CONFIG.ollamaUrl}/api/chat`, {
    method: 'POST',
    signal: AbortSignal.timeout(180_000),
    body: JSON.stringify({
      model: modelo, stream: false, think: false,
      messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
      options: { num_predict: maxTokens, temperature: temperatura },
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Ollama: ${j.error || r.status}`);
  return String(j.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// /api/tags lista modelos cujos arquivos podem ter sumido do disco; /api/show lê o GGUF
// e falha nesses casos, então é ele que diz se o modelo está mesmo utilizável.
const cacheModelo = new Map();
async function modeloUtilizavel(nome) {
  const c = cacheModelo.get(nome);
  if (c && Date.now() - c.t < 60_000) return c.ok;
  const r = await fetch(`${CONFIG.ollamaUrl}/api/show`, { method: 'POST', body: JSON.stringify({ model: nome }), signal: AbortSignal.timeout(5000) }).catch(() => null);
  const ok = Boolean(r?.ok);
  cacheModelo.set(nome, { ok, t: Date.now() });
  return ok;
}

export async function saudeOllama() {
  try {
    await fetch(`${CONFIG.ollamaUrl}/api/version`, { signal: AbortSignal.timeout(3000) });
  } catch (e) {
    return { ok: false, erro: e.message };
  }
  const usa = (m) => (m ? modeloUtilizavel(m) : false); // papel desligado = não utilizável, de propósito
  const [decide, escrita, comando] = await Promise.all([usa(CONFIG.modelos.decisao.modelo), usa(CONFIG.modelos.escrita.modelo), usa(CONFIG.modelos.comando.modelo)]);
  return { ok: true, decide, escrita, comando };
}
