import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const env = (k, d = '') => (process.env[k] ?? '').trim() || d;

export const CONFIG = {
  port: Number(env('PORT', '4300')),
  dataDir: path.resolve(ROOT, env('DATA_DIR', './data')),
  ollamaUrl: env('OLLAMA_URL', 'http://127.0.0.1:11434').replace(/\/$/, ''),
  decideBackend: env('DECIDE_BACKEND', 'local'),
  decideModel: env('DECIDE_MODEL', 'qwen3:1.7b'),
  decideTemplate: env('DECIDE_TEMPLATE', 'qwen3'),
  writeModel: env('WRITE_MODEL', env('DECIDE_MODEL', 'qwen3:1.7b')),
  openrouterKey: env('OPENROUTER_API_KEY'),
  openwa: {
    url: env('OPENWA_URL', 'http://127.0.0.1:2785').replace(/\/$/, ''),
    apiKey: env('OPENWA_API_KEY'),
    sessionId: env('OPENWA_SESSION_ID'),
  },
  webhookToken: env('WEBHOOK_TOKEN'),
  python: env('PYTHON', 'python'),
};

// Ajustes que o operador muda pela tela; ficam no banco (tabela config).
export const AJUSTES_PADRAO = {
  remetente_nome: 'Victor',
  remetente_oferta: 'crio sites e landing pages modernas para negócios locais',
  remetente_portfolio: '',
  envio: {
    limite_diario: 10,
    intervalo_min_s: 360,
    intervalo_max_s: 900,
    janela_inicio_h: 9,
    janela_fim_h: 18,
    dias_semana: [1, 2, 3, 4, 5],
    exigir_aprovacao: true,
    so_celular: true,
  },
  varredura: { limite_por_execucao: 20, refazer_apos_h: 24 },
};
