import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const env = (k, d = '') => (process.env[k] ?? '').trim() || d;

// Modelo por papel. Ordem: variável de ambiente > modelos.json (versionado, viaja no zip) > padrão.
// "modelo": null em modelos.json DESLIGA o LLM daquele papel (a regra assume: Nova usa o primeiro ângulo válido,
// Maia usa o texto fixo, o comando do Painel continua por regra). Papéis: comando (Alva), decisao (Nova), escrita (Maia).
export const PADRAO_MODELO = 'qwen3:1.7b';
export function resolverModelos(papeisArquivo = {}, ambiente = process.env) {
  const e = (k) => (ambiente[k] ?? '').trim();
  const um = (nome, chaveEnv, herda) => {
    const a = papeisArquivo[nome] || {};
    const modelo = e(chaveEnv) || ('modelo' in a ? a.modelo : (herda ?? PADRAO_MODELO));
    return { modelo: modelo || null, template: e('DECIDE_TEMPLATE') || a.template || 'qwen3' };
  };
  const decisao = um('decisao', 'DECIDE_MODEL');
  return { decisao, escrita: um('escrita', 'WRITE_MODEL', decisao.modelo), comando: um('comando', 'COMANDO_MODEL', decisao.modelo) };
}
const lerPapeis = () => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'modelos.json'), 'utf8')).papeis ?? {}; } catch { return {}; } };
const MODELOS = resolverModelos(lerPapeis());

export const CONFIG = {
  port: Number(env('PORT', '4300')),
  // testes: o Atlas não abre navegador nem acessa a internet (a busca termina na hora, sem resultados)
  atlasDesligado: env('ATLAS_DESLIGADO') === '1',
  dataDir: path.resolve(ROOT, env('DATA_DIR', './data')),
  ollamaUrl: env('OLLAMA_URL', 'http://127.0.0.1:11434').replace(/\/$/, ''),
  decideBackend: env('DECIDE_BACKEND', 'local'),
  modelos: MODELOS,
  decideModel: MODELOS.decisao.modelo,
  decideTemplate: MODELOS.decisao.template,
  writeModel: MODELOS.escrita.modelo,
  openrouterKey: env('OPENROUTER_API_KEY'),
  openwa: {
    url: env('OPENWA_URL', 'http://127.0.0.1:2785').replace(/\/$/, ''),
    apiKey: env('OPENWA_API_KEY'),
    sessionId: env('OPENWA_SESSION_ID'),
  },
  webhookToken: env('WEBHOOK_TOKEN'),
  espectadorSenha: env('ESPECTADOR_SENHA'), // senha de quem só assiste pelo túnel (somente leitura, telefones mascarados)
  acessoSenha: env('ACESSO_SENHA'), // vazio = sem acesso remoto (só o próprio PC)
  python: env('PYTHON', 'python'),
  // DEMO=1: versão pública de demonstração (src/demo.mjs) — dados fictícios, simulador, sem senha
  demo: env('DEMO') === '1',
  // só a demo escuta fora do PC (o Render exige 0.0.0.0); o sistema real fica em 127.0.0.1
  host: env('HOST', env('DEMO') === '1' ? '0.0.0.0' : '127.0.0.1'),
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
    // Leo só OUVE: nunca envia sozinho, mesmo com o WhatsApp conectado. Você manda à mão e o sistema detecta.
    so_escuta: true,
  },
  varredura: { limite_por_execucao: 50, refazer_apos_h: 24 },
};
