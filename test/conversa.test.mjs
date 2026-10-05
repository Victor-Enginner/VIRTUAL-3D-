import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, lerAjustes, salvarAjustes } from '../src/db.mjs';
import { avancarEstado, conversaDoLead, emEnvio, envioPausadoPelaConexao, estadoDoRecibo, jaRegistrada, registrarConexao, registrarMensagem, resumoDeEntrega } from '../src/conversa.mjs';
import { lerEvento } from '../src/envio/canal.mjs';
import { despachar, receberMensagem } from '../src/agentes.mjs';

function banco(etapa = 'enviado') {
  const db = abrirBanco(':memory:');
  db.prepare("INSERT INTO leads (id, nome, fonte, etapa, telefone, telefone_tipo, criado_em, atualizado_em) VALUES ('L1', 'Barbearia Teste', 'maps', ?, '5516999990001', 'celular', 't', 't')").run(etapa);
  return db;
}
const saida = (db, waId, extra = {}) => registrarMensagem(db, { leadId: 'L1', telefone: '5516999990001', direcao: 'saida', origem: 'sistema', texto: 'Oi', waId, status: 'enviada', ...extra });
const liberarEnvio = (db) => salvarAjustes(db, { ...lerAjustes(db), envio: { ...lerAjustes(db).envio, so_escuta: false, janela_inicio_h: 0, janela_fim_h: 24, dias_semana: [0, 1, 2, 3, 4, 5, 6] } });
const enfileirar = (db) => db.prepare("INSERT INTO envios (lead_id, telefone, texto, status, criado_em) VALUES ('L1', '5516999990001', 'Olá!', 'aprovado', 't')").run();
const ctx = { tarefa() {}, usar() {} };

test('mensagem com o mesmo wa_id não duplica (webhook que repete)', () => {
  const db = banco();
  assert.equal(saida(db, 'W1').inserido, true);
  assert.equal(saida(db, 'W1').inserido, false);
  assert.equal(conversaDoLead(db, 'L1').length, 1);
  assert.equal(jaRegistrada(db, 'W1'), true);
});

test('estado de entrega só avança: enviada, entregue, lida; e não volta', () => {
  const db = banco();
  saida(db, 'W1');
  assert.equal(avancarEstado(db, 'W1', 'delivered'), 'avancou');
  assert.equal(avancarEstado(db, 'W1', 'sent'), 'ignorado'); // recibo antigo chegando tarde
  assert.equal(avancarEstado(db, 'W1', 'read'), 'avancou');
  assert.equal(avancarEstado(db, 'W1', 'delivered'), 'ignorado');
  assert.equal(conversaDoLead(db, 'L1')[0].status, 'lida');
  assert.equal(estadoDoRecibo('desconhecido'), null);
});

test('falha de entrega fica registrada com o motivo e não é desfeita por recibo atrasado', () => {
  const db = banco();
  saida(db, 'W2');
  assert.equal(avancarEstado(db, 'W2', 'failed', 'número não existe'), 'avancou');
  assert.equal(avancarEstado(db, 'W2', 'delivered'), 'ignorado');
  const m = conversaDoLead(db, 'L1')[0];
  assert.deepEqual([m.status, m.erro], ['falhou', 'número não existe']);
  assert.equal(resumoDeEntrega(db).falhou, 1);
});

test('recibo que chega antes do registro da mensagem é guardado e aplicado depois', () => {
  const db = banco();
  assert.equal(avancarEstado(db, 'W3', 'delivered'), 'guardado');
  saida(db, 'W3'); // o Leo só registra depois que o envio devolve
  assert.equal(conversaDoLead(db, 'L1')[0].status, 'entregue');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM acks_orfaos').get().n, 0);
});

test('resposta do lead: registra uma vez, reage uma vez, e o webhook repetido não reaprende', () => {
  const db = banco();
  const msg = { telefone: '5516999990001', texto: 'Oi, quanto custa?', deMim: false, waId: 'R1' };
  assert.equal(receberMensagem(db, msg), 'L1');
  assert.equal(receberMensagem(db, msg), null); // repetição
  assert.equal(db.prepare("SELECT COUNT(*) n FROM eventos WHERE tipo = 'resposta'").get().n, 1);
  const c = conversaDoLead(db, 'L1');
  assert.deepEqual([c.length, c[0].direcao, c[0].origem, c[0].texto], [1, 'entrada', 'lead', 'Oi, quanto custa?']);
  assert.equal(db.prepare("SELECT etapa FROM leads WHERE id = 'L1'").get().etapa, 'respondeu');
});

test('o eco do envio do próprio Leo não vira "você mandou pelo celular"', () => {
  const db = banco('aprovado');
  saida(db, 'W9'); // o Leo já registrou
  assert.equal(receberMensagem(db, { telefone: '5516999990001', texto: 'Oi', deMim: true, waId: 'W9' }), null);
  emEnvio.add('5516999990001'); // webhook que ganha a corrida do registro
  assert.equal(receberMensagem(db, { telefone: '5516999990001', texto: 'Oi', deMim: true, waId: 'W10' }), null);
  emEnvio.delete('5516999990001');
  assert.equal(db.prepare("SELECT etapa FROM leads WHERE id = 'L1'").get().etapa, 'aprovado');
});

test('mensagem que você manda pelo celular entra na conversa com origem "celular"', () => {
  const db = banco('mensagem');
  receberMensagem(db, { telefone: '5516999990001', texto: 'Oi, aqui é o Victor', deMim: true, waId: 'C1' });
  const c = conversaDoLead(db, 'L1');
  assert.deepEqual([c[0].direcao, c[0].origem], ['saida', 'celular']);
  assert.equal(db.prepare("SELECT etapa FROM leads WHERE id = 'L1'").get().etapa, 'enviado');
});

test('envio pelo Leo registra o id do WhatsApp; falha do provedor vira "falhou" na conversa', async () => {
  const db = banco('aprovado');
  liberarEnvio(db);
  enfileirar(db);
  const ok = { configurado: () => true, saude: async () => ({ ok: true }), enviar: async () => ({ messageId: 'WA-1' }) };
  assert.equal(await despachar(db, ctx, ok), true);
  const m = conversaDoLead(db, 'L1')[0];
  assert.deepEqual([m.origem, m.status], ['sistema', 'enviada']);
  assert.equal(db.prepare("SELECT wa_id FROM mensagens WHERE lead_id = 'L1'").get().wa_id, 'WA-1');
  assert.equal(emEnvio.size, 0);

  const db2 = banco('aprovado');
  liberarEnvio(db2);
  enfileirar(db2);
  const ruim = { configurado: () => true, saude: async () => ({ ok: true }), enviar: async () => { throw new Error('OpenWA 500'); } };
  await despachar(db2, ctx, ruim);
  assert.equal(conversaDoLead(db2, 'L1')[0].status, 'falhou');
  assert.equal(emEnvio.size, 0);
});

test('restrição da conta ou laço de reconexão pausam o envio; sessão pronta de novo libera o laço', async () => {
  const db = banco('aprovado');
  assert.equal(envioPausadoPelaConexao(db), null);
  registrarConexao(db, { restricao: 'spam' });
  assert.match(envioPausadoPelaConexao(db), /restrição/);
  registrarConexao(db, { restricao: false }); // restrição levantada
  assert.equal(envioPausadoPelaConexao(db), null);
  registrarConexao(db, { status: 'reconnect_loop' });
  assert.match(envioPausadoPelaConexao(db), /reconectar/);
  assert.equal(registrarConexao(db, { status: 'ready' }).mudou, true);
  assert.equal(envioPausadoPelaConexao(db), null);
  // com a conexão pausada, o despacho nem tenta enviar
  registrarConexao(db, { restricao: 'spam' });
  liberarEnvio(db);
  enfileirar(db);
  let chamou = false;
  const dep = { configurado: () => true, saude: async () => ({ ok: true }), enviar: async () => { chamou = true; return {}; } };
  assert.equal(await despachar(db, ctx, dep), false);
  assert.equal(chamou, false);
});

test('canal: traduz os eventos do OpenWA para eventos do sistema', () => {
  assert.deepEqual(lerEvento({ event: 'message.ack', data: { messageId: 'W1', status: 'read' } }), { tipo: 'recibo', evento: 'message.ack', waId: 'W1', recibo: 'read', erro: null });
  assert.equal(lerEvento({ event: 'message.failed', data: { messageId: 'W1' } }).recibo, 'failed');
  assert.equal(lerEvento({ event: 'session.disconnected', data: {} }).status, 'disconnected');
  assert.equal(lerEvento({ event: 'session.status', data: { status: 'ready' } }).status, 'ready');
  assert.equal(lerEvento({ event: 'session.restriction', data: { restriction: 'spam' } }).restricao, 'spam');
  assert.equal(lerEvento({ event: 'session.restriction', data: { restriction: null } }).restricao, false); // levantada
  const m = lerEvento({ event: 'message.received', data: { id: 'M1', from: '5516999990001@c.us', chatId: '5516999990001@c.us', body: 'oi', fromMe: false, kind: 'individual' } });
  assert.deepEqual([m.tipo, m.telefone, m.texto, m.deMim, m.waId], ['mensagem', '5516999990001', 'oi', false, 'M1']);
  assert.equal(lerEvento({ event: 'group.join', data: {} }).tipo, 'ignorado');
});
