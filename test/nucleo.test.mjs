import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificarUrl, normalizarTelefone, sinaisDeAtraso } from '../src/regras.mjs';
import { lerProbabilidades, montarResposta, validarPerguntas } from '../src/decide/index.mjs';
import { analisarHtml, ipBloqueado } from '../src/auditoria.mjs';
import { avaliarEnvio, intervaloAleatorioMs } from '../src/envio/politica.mjs';
import { extrairLiterais } from '../src/comando.mjs';
import { lerMensagemRecebida, PEDIU_PARA_SAIR } from '../src/envio/openwa.mjs';

test('classifica o endereço do site sem rede', () => {
  assert.equal(classificarUrl(null), 'sem_site');
  assert.equal(classificarUrl(''), 'sem_site');
  assert.equal(classificarUrl('https://instagram.com/barbearia'), 'so_rede_social');
  assert.equal(classificarUrl('linktr.ee/ze'), 'so_rede_social');
  assert.equal(classificarUrl('https://www.goomer.app/esfihazza'), 'so_cardapio');
  assert.equal(classificarUrl('https://sites.appbarber.com.br/housebarbearia-gqci'), 'so_agendamento');
  assert.equal(classificarUrl('https://booksy.com/pt-br/instant-experiences/widget/291048'), 'so_agendamento');
  assert.equal(classificarUrl('https://ze.wixsite.com/barbearia'), 'site_gratuito');
  assert.equal(classificarUrl('https://www.barbaeciafranca.com.br/'), 'site_proprio');
  // domínio parecido não pode cair na lista
  assert.equal(classificarUrl('https://naoinstagram.com.br'), 'site_proprio');
});

test('telefone: normaliza e nunca inventa', () => {
  assert.deepEqual(normalizarTelefone('(16) 99385-0531'), { telefone: '5516993850531', tipo: 'celular' });
  assert.deepEqual(normalizarTelefone('+55 16 3722-1000'), { telefone: '551637221000', tipo: 'fixo' });
  assert.deepEqual(normalizarTelefone('0800 123 4567'), { telefone: null, tipo: null });
  assert.deepEqual(normalizarTelefone(''), { telefone: null, tipo: null });
  assert.deepEqual(normalizarTelefone(null), { telefone: null, tipo: null });
  assert.deepEqual(normalizarTelefone('123'), { telefone: null, tipo: null });
});

test('probabilidades vêm só dos identificadores válidos e são normalizadas', () => {
  const top = [{ token: '4', logprob: Math.log(0.6) }, { token: '2', logprob: Math.log(0.2) }, { token: '</think>', logprob: Math.log(0.1) }, { token: '9', logprob: Math.log(0.05) }];
  const { probs, cobertura } = lerProbabilidades(top, 4);
  assert.ok(Math.abs(probs.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(Math.abs(probs[3] - 0.75) < 1e-9);
  assert.equal(probs[0], 0);
  assert.ok(Math.abs(cobertura - 0.8) < 1e-9); // o "9" fica fora (só há 4 opções)
  const vazio = lerProbabilidades([{ token: 'Okay', logprob: -0.1 }], 3);
  assert.equal(vazio.cobertura, 0);
});

test('respostas no formato do Jev (choice, score, noul)', () => {
  const choice = montarResposta({ type: 'choice', criteria: { a: 'A', b: 'B' } }, [0.3, 0.7], 0.9);
  assert.equal(choice.choice, 'b');
  assert.equal(choice.probabilities.b, 0.7);
  const score = montarResposta({ type: 'score', criteria: ['0', '1', '2'] }, [0, 0.5, 0.5], 1);
  assert.equal(score.score, 0.75);
  const noul = montarResposta({ type: 'noul', criteria: { true: 's', false: 'n' } }, [0.8, 0.2], 1);
  assert.equal(noul.noul, 0.8);
  assert.match(validarPerguntas({ x: { type: 'choice', instructions: 'q', criteria: Object.fromEntries([...Array(10)].map((_, i) => [i, i])) } }), /2 a 9/);
  assert.equal(validarPerguntas({ x: { type: 'noul', instructions: 'q', criteria: { true: 's', false: 'n' } } }), null);
});

test('auditoria extrai fatos do HTML', () => {
  const html = `<html><head><title>Barbearia do Zé</title><meta name="generator" content="WordPress 4.9">
    <script src="/js/jquery-1.11.3.min.js"></script></head><body><form></form>
    <a href="https://wa.me/5516999999999">zap</a><footer>© 2019 Barbearia do Zé</footer><p>${'texto '.repeat(100)}</p></body></html>`;
  const a = analisarHtml(html, 2026);
  assert.equal(a.titulo, 'Barbearia do Zé');
  assert.equal(a.viewport, false);
  assert.equal(a.ano_copyright, 2019);
  assert.equal(a.jquery, '1.11.3');
  assert.equal(a.gerador, 'WordPress 4.9');
  assert.equal(a.link_whatsapp, true);
  const sinais = sinaisDeAtraso({ ...a, https: false, tempo_ms: 800 }, 2026);
  assert.ok(sinais.some((s) => s.includes('HTTPS')));
  assert.ok(sinais.some((s) => s.includes('© 2019')));
  assert.ok(sinais.some((s) => s.includes('celular')));
  assert.equal(analisarHtml('<footer>© 2015 - 2026</footer>', 2026).ano_copyright, 2026);
});

test('SSRF: faixas internas recusadas', () => {
  for (const ip of ['127.0.0.1', '10.2.3.4', '192.168.0.10', '169.254.169.254', '172.20.1.1', '::1', '::ffff:127.0.0.1', 'fd00::1', '0.0.0.0'])
    assert.equal(ipBloqueado(ip), true, ip);
  for (const ip of ['8.8.8.8', '200.147.67.142', '2804:14c::1']) assert.equal(ipBloqueado(ip), false, ip);
});

const CFG = { limite_diario: 10, intervalo_min_s: 360, intervalo_max_s: 900, janela_inicio_h: 9, janela_fim_h: 18, dias_semana: [1, 2, 3, 4, 5] };
const quinta = (h, m = 0) => new Date(2026, 9, 1, h, m); // 1/out/2026 é quinta-feira

test('ritmo de envio: teto, janela e intervalo', () => {
  assert.equal(avaliarEnvio({ agora: quinta(10), enviadosHoje: 0, proximoPermitido: null, cfg: CFG }).pode, true);
  const cedo = avaliarEnvio({ agora: quinta(7), enviadosHoje: 0, proximoPermitido: null, cfg: CFG, aleatorio: () => 0 });
  assert.equal(cedo.pode, false);
  assert.equal(cedo.proximo.getHours(), 9);
  assert.equal(cedo.proximo.getDate(), 1);
  const cheio = avaliarEnvio({ agora: quinta(11), enviadosHoje: 10, proximoPermitido: null, cfg: CFG, aleatorio: () => 0 });
  assert.equal(cheio.pode, false);
  assert.equal(cheio.proximo.getDate(), 2); // sexta 9h
  const sexta20h = avaliarEnvio({ agora: new Date(2026, 9, 2, 20), enviadosHoje: 3, proximoPermitido: null, cfg: CFG, aleatorio: () => 0 });
  assert.equal(sexta20h.proximo.getDay(), 1); // pula o fim de semana
  const espera = avaliarEnvio({ agora: quinta(10), enviadosHoje: 1, proximoPermitido: quinta(10, 7), cfg: CFG });
  assert.equal(espera.pode, false);
  assert.equal(espera.proximo.getMinutes(), 7);
  const ms = intervaloAleatorioMs(CFG, () => 0.5);
  assert.equal(ms, 630_000);
});

test('comando: literais saem do código', () => {
  assert.deepEqual(extrairLiterais('varre barbearias em Franca SP'), { nicho: 'barbearia', cidade: 'Franca', uf: 'SP', fonte: 'maps' });
  assert.deepEqual(extrairLiterais('procura dentista em ribeirão preto'), { nicho: 'odontologia', cidade: 'Ribeirão Preto', uf: null, fonte: 'maps' });
  assert.equal(extrairLiterais('busca pet shop em São José do Rio Preto - SP no openstreetmap').fonte, 'osm');
  assert.equal(extrairLiterais('resumo do dia').nicho, null);
});

test('webhook: leitura defensiva e opt-out', () => {
  assert.deepEqual(lerMensagemRecebida({ event: 'message.received', data: { from: '5516993850531@c.us', body: 'Quero saber mais', fromMe: false } }),
    { evento: 'message.received', telefone: '5516993850531', texto: 'Quero saber mais', deMim: false });
  assert.ok(PEDIU_PARA_SAIR.test('SAIR'));
  assert.ok(PEDIU_PARA_SAIR.test('não tenho interesse, obrigado'));
  assert.ok(!PEDIU_PARA_SAIR.test('Quero saber o preço'));
});

test('rotação cíclica cancela o viés de posição (AnyJev L0)', async () => {
  const { combinarRotacoes } = await import('../src/decide/index.mjs');
  // modelo enviesado: sempre 100% na posição exibida 1, não importa o conteúdo
  const enviesado = [{ rot: 0, probs: [1, 0], cobertura: 1 }, { rot: 1, probs: [1, 0], cobertura: 1 }];
  assert.deepEqual(combinarRotacoes(enviesado, 2).probs, [0.5, 0.5]);
  // modelo que reconhece o conteúdo: a opção original 2 vence nas duas ordens
  const correto = [{ rot: 0, probs: [0.1, 0.9], cobertura: 1 }, { rot: 1, probs: [0.9, 0.1], cobertura: 0.8 }];
  const r = combinarRotacoes(correto, 2);
  assert.ok(Math.abs(r.probs[1] - 0.9) < 1e-9);
  assert.ok(Math.abs(r.cobertura - 0.9) < 1e-9);
});
