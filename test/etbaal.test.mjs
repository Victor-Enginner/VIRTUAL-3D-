// Avaliação obrigatória do Etbaal (declarada em agentes/etbaal.json): sem rede, com servidor e DNS falsos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditar } from '../src/etbaal/auditoria.mjs';
import { autorizar, carregarAgentes, validar } from '../src/especificacao.mjs';

const { validos, invalidos } = carregarAgentes();
const ETBAAL = validos.find((a) => a.id === 'etbaal');

const resposta = (status, headers = {}, corpo = '') => ({ status, headers: new Headers(headers), text: async () => corpo });
function falso({ http, https, txt = {}, cert = { valido: true, erro: null, expira: '2027-01-01T00:00:00.000Z' }, existe = { ok: true } }) {
  const chamadas = [];
  return {
    chamadas,
    fetch: async (url) => { chamadas.push(url); return url.startsWith('http://') ? http : https; },
    resolverTxt: async (nome) => { chamadas.push(`dns:${nome}`); return txt[nome] || []; },
    certificado: async () => cert,
    existe: async () => existe,
  };
}
const AGORA = new Date('2026-10-08T12:00:00Z');

test('etbaal: a especificação é válida e entra no ar', () => {
  assert.deepEqual(invalidos, []);
  assert.ok(ETBAAL);
  assert.equal(ETBAAL.identidade.fala, 'texto');
});

test('especificação: recusa agente sem teste, com voz, ou que escreve sem aprovação', () => {
  const base = JSON.parse(JSON.stringify(ETBAAL));
  assert.match(validar({ ...base, avaliacao: {} }).join(), /sem teste não entra/);
  assert.match(validar({ ...base, identidade: { ...base.identidade, fala: 'voz' } }).join(), /não falam/);
  const escreve = { ...base, habilidades: [{ id: 'mandar', efeito: 'envio' }] };
  assert.match(validar(escreve).join(), /precisa estar em permissoes.precisa_aprovacao/);
});

test('especificação: ferramenta proibida ou fora da lista é recusada antes de rodar', () => {
  assert.throws(() => autorizar(ETBAAL, 'varredura_de_portas'), /proibido/);
  assert.throws(() => autorizar(ETBAAL, 'ssh'), /não está nas ferramentas/);
  assert.equal(autorizar(ETBAAL, 'dns_txt'), true);
});

test('etbaal: site mal configurado gera achados com evidência e norma', async () => {
  const dep = falso({
    http: resposta(200),
    https: resposta(200, { server: 'Apache/2.4.29 (Ubuntu)' }, '<meta name="generator" content="WordPress 5.2.1"><img src="http://cdn.x/a.png">'),
    txt: { 'barbeariax.com.br': ['google-site-verification=abc'] },
  });
  const r = await auditar(ETBAAL, 'https://www.barbeariax.com.br', dep, AGORA);
  const ids = r.achados.map((a) => a.id);
  for (const id of ['sem_redirecionamento_https', 'sem_hsts', 'sem_csp', 'versao_exposta_server', 'versao_cms_exposta', 'conteudo_misto', 'sem_spf', 'sem_dmarc']) assert.ok(ids.includes(id), id);
  for (const a of r.achados) { assert.ok(a.evidencia.length > 3, a.id); assert.ok(a.norma, a.id); }
  assert.equal(r.dominio, 'barbeariax.com.br'); // SPF/DMARC no domínio, sem o www
  assert.equal(r.achados[0].severidade, 'alta'); // mais grave primeiro
  assert.ok(r.nota < 50);
});

test('etbaal: site bem configurado não ganha achado inventado', async () => {
  const dep = falso({
    http: resposta(301, { location: 'https://boa.com.br/' }),
    https: resposta(200, { 'strict-transport-security': 'max-age=31536000', 'content-security-policy': "default-src 'self'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff', server: 'nginx' }, '<html></html>'),
    txt: { 'boa.com.br': ['v=spf1 include:_spf.google.com -all'], '_dmarc.boa.com.br': ['v=DMARC1; p=reject'] },
  });
  const r = await auditar(ETBAAL, 'boa.com.br', dep, AGORA);
  assert.deepEqual(r.achados, []);
  assert.equal(r.nota, 100);
});

test('etbaal: certificado inválido é alta; DMARC p=none e SPF +all são apontados', async () => {
  const dep = falso({
    http: resposta(301, { location: 'https://x.com.br/' }), https: resposta(200),
    cert: { valido: false, erro: 'CERT_HAS_EXPIRED', expira: null },
    txt: { 'x.com.br': ['v=spf1 +all'], '_dmarc.x.com.br': ['v=DMARC1; p=none'] },
  });
  const ids = (await auditar(ETBAAL, 'x.com.br', dep, AGORA)).achados.map((a) => a.id);
  assert.ok(ids.includes('certificado_invalido') && ids.includes('spf_permissivo') && ids.includes('dmarc_so_monitora'));
  assert.ok(!ids.includes('sem_hsts')); // sem certificado válido não lê cabeçalho: não acusa o que não viu
});

test('etbaal: rede social, agregador e site gratuito nunca são auditados (nem uma requisição)', async () => {
  for (const site of ['https://instagram.com/barbearia', 'https://loja.wixsite.com/x', '', 'https://belarmino.resurva.com', 'https://www.fresha.com/pt/a/x', 'https://giuseppe.lecard.app', 'https://x.localo.site']) {
    const dep = falso({ http: resposta(200), https: resposta(200) });
    const r = await auditar(ETBAAL, site, dep, AGORA);
    assert.equal(r.auditado, false, site);
    assert.equal(dep.chamadas.length, 0, site);
  }
});

// falso positivo real de 08/10: domínio inexistente e falha passageira viravam "certificado inválido" + "sem SPF"
test('etbaal: domínio inexistente não é falha de segurança; falha passageira não é acusada', async () => {
  const sumiu = falso({ http: resposta(200), https: resposta(200), existe: { ok: false, erro: 'ENOTFOUND' } });
  const a = await auditar(ETBAAL, 'sumiu.com.br', sumiu, AGORA);
  assert.equal(a.auditado, false); assert.match(a.motivo, /não existe/); assert.deepEqual(a.achados, []);
  const lento = falso({ http: resposta(200), https: resposta(200), existe: { ok: false, erro: 'EAI_AGAIN' } });
  const b = await auditar(ETBAAL, 'lento.com.br', lento, AGORA);
  assert.equal(b.transitorio, true); assert.deepEqual(b.achados, []);
  const recusa = falso({ http: resposta(200), https: resposta(200), cert: { valido: false, erro: 'ECONNREFUSED', expira: null } });
  const c = await auditar(ETBAAL, 'semtls.com.br', recusa, AGORA);
  assert.ok(c.achados.some((x) => x.id === 'sem_https') && !c.achados.some((x) => x.id === 'certificado_invalido'));
  const cadeia = falso({ http: resposta(200), https: resposta(200), cert: { valido: false, erro: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', expira: null } });
  assert.equal((await auditar(ETBAAL, 'cadeia.com.br', cadeia, AGORA)).achados.find((x) => x.id === 'cadeia_incompleta').severidade, 'media');
});
