import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angulosPermitidos, carregaObservacao, contradicoes, idDoLead, mensagemFallback, nivelOportunidade, validarMensagem } from '../src/agentes.mjs';
import { AJUSTES_PADRAO } from '../src/config.mjs';

const lead = (o) => ({ nome: 'Barbearia Estilo A', cidade: 'Franca', uf: 'SP', categoria: 'Barbearia', rating: 4.6, avaliacoes: 12, auditoria: null, ...o });

test('nível de oportunidade é regra (casos que o modelo de 1.7B errou ao vivo)', () => {
  assert.equal(nivelOportunidade('so_rede_social'), 3); // o modelo dizia "Nada" com 100%
  assert.equal(nivelOportunidade('so_agendamento'), 3);
  assert.equal(nivelOportunidade('sem_site'), 4);
  assert.equal(nivelOportunidade('site_fora_do_ar'), 4);
  assert.equal(nivelOportunidade('site_proprio', []), 0);
  assert.equal(nivelOportunidade('site_proprio', ['sem HTTPS', 'rodapé © 2019']), 2);
});

test('espaço de ações: só ângulos verdadeiros para o lead', () => {
  assert.deepEqual(angulosPermitidos(lead({ situacao_site: 'so_rede_social' })), ['independencia']); // nunca "modernizar"
  assert.deepEqual(angulosPermitidos(lead({ situacao_site: 'sem_site', avaliacoes: 529, rating: 4.9 })), ['ser_encontrado', 'reputacao']);
  assert.deepEqual(angulosPermitidos(lead({ situacao_site: 'site_proprio' }), []), []);
  assert.deepEqual(angulosPermitidos(lead({ situacao_site: 'site_fora_do_ar', avaliacoes: 900, rating: 5 })), ['recuperar']);
});

test('checagem recusa a mensagem inventada vista ao vivo', () => {
  const ruim = 'O negócio está com o site desativado. Queremos ajudar a reativar o site.';
  const p = contradicoes(ruim, lead({ situacao_site: 'sem_site' }), AJUSTES_PADRAO);
  assert.ok(p.includes('diz que o site está fora do ar'));
  assert.ok(p.includes('não se apresenta'));
  const boa = 'Oi! Aqui é o Victor, crio sites para negócios locais. Vi que quem procura barbearia em Franca não encontra um site da Barbearia Estilo A. Posso te mostrar uma ideia?';
  assert.deepEqual(contradicoes(boa, lead({ situacao_site: 'sem_site' }), AJUSTES_PADRAO), []);
});

test('texto fixo é verdadeiro, tem opt-out e passa na checagem', () => {
  const l = lead({ situacao_site: 'sem_site' });
  const t = mensagemFallback(l, AJUSTES_PADRAO, 'ser_encontrado');
  assert.match(t, /responder SAIR/);
  assert.deepEqual(contradicoes(t, l, AJUSTES_PADRAO), []);
  assert.equal(validarMensagem('veja https://golpe.example/x agora', AJUSTES_PADRAO).texto.includes('golpe'), false);
});

test('id do lead ignora acento e caixa', () => {
  assert.equal(idDoLead('Barbearia D\'Santos', 'Franca', 'SP'), idDoLead('barbearia d santos', 'FRANCA', 'sp'));
});

test('mensagens reais do modelo de 1.7B que precisam ser recusadas', () => {
  const ajustes = AJUSTES_PADRAO;
  const casos = [
    [lead({ nome: 'Boareto barbershop', situacao_site: 'sem_site' }), 'Olá, sou Victor da Boareto Barbershop. Estou aqui para cuidar de seus cabelos com professionalismo e atenção. Qual é a sua preferência?', 'ser_encontrado'],
    [lead({ nome: 'Pavanelo Barbearia', situacao_site: 'so_rede_social' }), 'Olá, sou Victor da Pavanelo Barbearia. Estamos aqui para cuidar de sua imagem online com qualidade.', 'independencia'],
    [lead({ nome: 'Barbearia Mr.Jones', situacao_site: 'site_fora_do_ar' }), 'Olá, meu nome é Victor. Estou aqui para criar sites para negócios locais como a Barbearia Mr. Jones. Espero que possamos trabalhar juntos. O que você acha?', 'recuperar'],
  ];
  for (const [l, texto, angulo] of casos) {
    const recusada = contradicoes(texto, l, ajustes).length > 0 || !carregaObservacao(texto, angulo);
    assert.ok(recusada, texto);
  }
  // a do Dhannyllo era boa e deve passar
  const boa = 'Olá, tudo bem? Sou Victor, criador de sites para negócios locais. A Dhannyllo Cabelo e Barba está dependendo da presença na rede social para aparecer online. Qual é a sua opinião sobre isso?';
  const l = lead({ nome: 'Dhannyllo cabelo e barba', situacao_site: 'so_rede_social' });
  assert.deepEqual(contradicoes(boa, l, ajustes), []);
  assert.ok(carregaObservacao(boa, 'independencia'));
});

test('texto fixo varia entre leads e passa na própria checagem', () => {
  const textos = new Set();
  for (const nome of ['Barbearia Alfa', 'Barbearia Beta', 'Barbearia Gama', 'Barbearia Delta', 'Barbearia Épsilon', 'Barbearia Zeta']) {
    const l = lead({ id: idDoLead(nome, 'Franca', 'SP'), nome, situacao_site: 'so_rede_social' });
    const t = mensagemFallback(l, AJUSTES_PADRAO, 'independencia');
    assert.deepEqual(contradicoes(t, l, AJUSTES_PADRAO), [], t);
    assert.ok(carregaObservacao(t, 'independencia'));
    textos.add(t.split(' Vi que')[0]);
  }
  assert.ok(textos.size >= 2);
});
