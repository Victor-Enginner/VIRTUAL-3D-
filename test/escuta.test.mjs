// WhatsApp "só escuta": só conversa 1 a 1 com número; o Leo nunca envia sozinho; envio feito por você é percebido.
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, lerAjustes, salvarAjustes } from '../src/db.mjs';
import { ehConversaIndividual, lerMensagemRecebida } from '../src/envio/openwa.mjs';
import { aprovarEnvio, despachar, receberMensagem, situacaoDoEnvio } from '../src/agentes.mjs';

const recebida = (data, event = 'message.received') => lerMensagemRecebida({ event, data });
const TEL = '5516993850531';

test('grupo, comunidade, canal, transmissão e status nunca viram telefone (por kind E por formato do id)', () => {
  const casos = [
    { from: `${TEL}@c.us`, isGroup: true, kind: 'group' },
    { from: `${TEL}@c.us`, kind: 'group' },
    { from: `${TEL}@c.us`, kind: 'channel' },
    { from: `${TEL}@c.us`, kind: 'status' },
    { from: `${TEL}@c.us`, kind: 'broadcast' },
    { from: `${TEL}@c.us`, isStatusBroadcast: true },
    // sem nenhum campo de tipo: o formato do id basta (comunidade e grupo são "@g.us")
    { from: '120363025246125486@g.us', senderPhone: TEL },
    { from: `${TEL}@c.us`, chatId: '120363025246125486@g.us' },
    { from: `${TEL}@c.us`, chatId: '120363025246125486@newsletter' },
    { from: `${TEL}@c.us`, chatId: '120363025246125486@broadcast' },
    { from: `${TEL}@c.us`, chatId: 'status@broadcast' },
    { fromMe: true, to: '120363025246125486@g.us', chatId: '120363025246125486@g.us' },
  ];
  for (const d of casos) {
    assert.equal(recebida({ ...d, body: 'oi' }).telefone, null, JSON.stringify(d));
    assert.equal(ehConversaIndividual(d), false);
  }
});

test('conversa 1 a 1 com número continua valendo (recebida e enviada)', () => {
  assert.equal(recebida({ from: `${TEL}@c.us`, chatId: `${TEL}@c.us`, kind: 'individual', body: 'oi' }).telefone, TEL);
  const minha = recebida({ from: '5511900000000@c.us', to: `${TEL}@c.us`, chatId: `${TEL}@c.us`, fromMe: true, kind: 'individual', body: 'Olá!' }, 'message.sent');
  assert.deepEqual([minha.telefone, minha.deMim], [TEL, true]); // o telefone é o do DESTINATÁRIO
});

function banco(etapa) {
  const db = abrirBanco(':memory:');
  db.prepare(`INSERT INTO leads (id, nome, fonte, etapa, criado_em, atualizado_em, cidade, uf, nicho, telefone, telefone_tipo, mensagem, decisao)
    VALUES ('L1','Barbearia Teste','maps',?,'t','t','Franca','SP','barbearia',?, 'celular','Olá, vi seu negócio','{"answers":{"abordagem":{"choice":"ser_encontrado"}}}')`).run(etapa, TEL);
  return db;
}
const etapaDe = (db) => db.prepare("SELECT etapa FROM leads WHERE id = 'L1'").get().etapa;

test('você mandou pelo WhatsApp: lead não contatado vira "enviado" e o aprendizado registra', () => {
  const db = banco('mensagem');
  const id = receberMensagem(db, { telefone: TEL, texto: 'Olá, vi seu negócio', deMim: true });
  assert.equal(id, 'L1');
  assert.equal(etapaDe(db), 'enviado');
  const e = db.prepare("SELECT status, texto FROM envios WHERE lead_id = 'L1'").get();
  assert.deepEqual([e.status, e.texto], ['enviado', 'Olá, vi seu negócio']);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM eventos WHERE tipo = 'aprendizado'").get().n, 1);
});

test('envio já aprovado na fila: o mesmo registro vira enviado (sem duplicar)', () => {
  const db = banco('mensagem');
  aprovarEnvio(db, 'L1', null);
  receberMensagem(db, { telefone: TEL, texto: 'x', deMim: true });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM envios WHERE lead_id = 'L1'").get().n, 1);
  assert.equal(etapaDe(db), 'enviado');
});

test('conversa em andamento ou número desconhecido: mensagem sua não muda nada', () => {
  const db = banco('respondeu');
  assert.equal(receberMensagem(db, { telefone: TEL, texto: 'ok', deMim: true }), null);
  assert.equal(etapaDe(db), 'respondeu');
  assert.equal(receberMensagem(db, { telefone: '5511911112222', texto: 'ok', deMim: true }), null);
});

test('só escuta é o padrão e bloqueia o envio: o Leo não chama o WhatsApp', async () => {
  const db = banco('mensagem');
  aprovarEnvio(db, 'L1', null);
  assert.equal(lerAjustes(db).envio.so_escuta, true);
  let chamadas = 0;
  const dep = { configurado: () => true, saude: async () => ({ ok: true }), enviar: async () => { chamadas++; return { ok: true }; } };
  assert.equal(await despachar(db, { tarefa() {} }, dep), false);
  assert.equal(chamadas, 0);
  const s = situacaoDoEnvio(db);
  assert.deepEqual([s.pode, s.so_escuta], [false, true]);
  assert.match(s.motivo, /só escuta/);
});

test('com a escuta desligada de propósito o Leo volta a poder enviar', async () => {
  const db = banco('mensagem');
  aprovarEnvio(db, 'L1', null);
  const a = lerAjustes(db);
  salvarAjustes(db, { ...a, envio: { ...a.envio, so_escuta: false, janela_inicio_h: 0, janela_fim_h: 24, dias_semana: [0, 1, 2, 3, 4, 5, 6], intervalo_min_s: 60, intervalo_max_s: 60 } });
  let chamadas = 0;
  const dep = { configurado: () => true, saude: async () => ({ ok: true }), enviar: async () => { chamadas++; return { ok: true }; } };
  await despachar(db, { tarefa() {} }, dep);
  assert.equal(chamadas, 1);
});
