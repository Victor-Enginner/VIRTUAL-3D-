// Tudo que é TEXTO para o cliente, por idioma: a observação do ângulo, as aberturas e fechos do texto pronto, a linha de saída (SAIR),
// o que conta como "pare de me escrever" e as regras de conferência do texto do modelo.
//   pt-BR: Brasil (o que sempre existiu)  ·  pt-PT: Portugal (vocabulário e tratamento de Portugal)  ·  es-PY: Paraguai (espanhol, tratamento "usted")
// O idioma vem do país do lead (src/paises.mjs). A oferta ("crio sites…") do Brasil é a dos Ajustes; os outros idiomas têm a sua,
// que o Victor pode sobrescrever em ajustes.ofertas[idioma].
import { paisDe } from './paises.mjs';

const sem = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const PT_BR = {
  id: 'pt-BR',
  oferta: null, // usa ajustes.remetente_oferta
  sair: { linha: 'Se não quiser receber mensagens, é só responder SAIR.', ja: /responder SAIR/i,
    pedido: /\b(sair|parar|pare|remover|remova|descadastr|n[aã]o (tenho interesse|quero|me mande|mande)|stop)\b/i },
  portfolio: 'Meus trabalhos:',
  promessa: /preparamos|preparei|já fiz|já criei|prévia pronta/i,
  observacoes: {
    ser_encontrado: (l) => `quem procura ${l.categoria?.toLowerCase() || 'esse serviço'} em ${l.cidade} no Google não encontra um site da ${l.nome}`,
    modernizar: (l, s) => `o site da ${l.nome} tem alguns pontos que afastam cliente${s[0] ? ` (${s[0]})` : ''}`,
    independencia: (l, _s, sit) => `a ${l.nome} depende hoje de ${sit || 'plataformas de terceiros'} para aparecer online`,
    reputacao: (l) => `a ${l.nome} tem nota ${l.rating} no Google${l.avaliacoes ? ` com ${l.avaliacoes} avaliações` : ''}, mas não tem um site à altura`,
    recuperar: (l) => `o endereço do site da ${l.nome} não está abrindo`,
  },
  palavrasDoAngulo: {
    ser_encontrado: /google|encontr|procura|busca/, independencia: /depend|propri|rede social|instagram|plataforma|agendamento|cardapio/,
    modernizar: /celular|https|segur|atualiz|desatualiz|lent/, reputacao: /nota|avalia|estrela/, recuperar: /abr|funcion|endereco/,
  },
  aberturas: [
    (a, l) => `Olá! Aqui é o ${a.nome}, ${a.oferta} em ${l.cidade}.`,
    (a) => `Oi, tudo bem? Meu nome é ${a.nome}, ${a.oferta}.`,
    (a, l) => `Boa tarde! Sou o ${a.nome}, aqui de ${l.cidade}; ${a.oferta}.`,
  ],
  fechos: ['Posso te mostrar em 5 minutos como ficaria?', 'Faz sentido eu te mandar uma ideia de como ficaria?', 'Topa ver um exemplo rápido, sem compromisso?'],
  vi: 'Vi que',
  prompt: (a, l, obs) => ({
    sistema: `Você escreve a primeira mensagem de WhatsApp de ${a.nome}, que ${a.oferta}, para um negócio local.
Regras: português do Brasil, tom humano e direto, de 2 a 4 frases curtas, no máximo 1 emoji, sem links.
Comece cumprimentando e se apresentando como ${a.nome}. Cite o nome do negócio.
Use a OBSERVAÇÃO dada e nenhum outro fato. Não invente números, notas, prazos, problemas ou trabalhos já feitos.
Termine com uma pergunta simples, sem pressão. Não escreva assinatura nem aspas.`,
    usuario: `NEGÓCIO: ${l.nome} (${l.categoria}, ${l.cidade})\nOBSERVAÇÃO: ${obs}\n\nEscreva só a mensagem.`,
  }),
};

const PT_PT = {
  ...PT_BR,
  id: 'pt-PT',
  oferta: 'crio websites e landing pages modernos para negócios locais',
  sair: { linha: 'Se não pretender receber mensagens, basta responder SAIR.', ja: /responder SAIR/i,
    pedido: /\b(sair|parar|pare|remover|remova|n[aã]o (tenho interesse|pretendo|quero|me envie|envie)|stop)\b/i },
  portfolio: 'Os meus trabalhos:',
  observacoes: {
    ser_encontrado: (l) => `quem procura ${l.categoria?.toLowerCase() || 'este serviço'} em ${l.cidade} no Google não encontra um website da ${l.nome}`,
    modernizar: (l, s) => `o website da ${l.nome} tem alguns pontos que afastam clientes${s[0] ? ` (${s[0]})` : ''}`,
    independencia: (l, _s, sit) => `a ${l.nome} depende hoje de ${sit || 'plataformas de terceiros'} para aparecer online`,
    reputacao: (l) => `a ${l.nome} tem nota ${l.rating} no Google${l.avaliacoes ? ` com ${l.avaliacoes} avaliações` : ''}, mas não tem um website à altura`,
    recuperar: (l) => `o endereço do website da ${l.nome} não está a abrir`,
  },
  palavrasDoAngulo: {
    ser_encontrado: /google|encontr|procura|busca/, independencia: /depend|propri|rede social|instagram|plataforma|marcacao|ementa/,
    modernizar: /telemovel|https|segur|atualiz|desatualiz|lent/, reputacao: /nota|avalia|estrela/, recuperar: /abr|funcion|endereco/,
  },
  aberturas: [
    (a, l) => `Olá! Chamo-me ${a.nome}, ${a.oferta} em ${l.cidade}.`,
    (a) => `Bom dia, tudo bem? O meu nome é ${a.nome}, ${a.oferta}.`,
    (a, l) => `Boa tarde! Sou o ${a.nome}, de ${l.cidade}; ${a.oferta}.`,
  ],
  fechos: ['Posso mostrar-lhe em 5 minutos como ficaria?', 'Faz sentido enviar-lhe uma ideia de como ficaria?', 'Gostava de ver um exemplo rápido, sem compromisso?'],
  prompt: (a, l, obs) => ({
    sistema: `Escreves a primeira mensagem de WhatsApp de ${a.nome}, que ${a.oferta}, para um negócio local.
Regras: português de Portugal (nunca do Brasil), tom humano e direto, de 2 a 4 frases curtas, no máximo 1 emoji, sem links.
Começa por cumprimentar e apresentar-te como ${a.nome}. Cita o nome do negócio.
Usa a OBSERVAÇÃO dada e nenhum outro facto. Não inventes números, notas, prazos, problemas ou trabalhos já feitos.
Termina com uma pergunta simples, sem pressão. Não escrevas assinatura nem aspas.`,
    usuario: `NEGÓCIO: ${l.nome} (${l.categoria}, ${l.cidade})\nOBSERVAÇÃO: ${obs}\n\nEscreve só a mensagem.`,
  }),
};

const ES_PY = {
  id: 'es-PY',
  oferta: 'creo sitios web y landing pages modernas para negocios locales',
  sair: { linha: 'Si no desea recibir mensajes, solo responda SALIR.', ja: /responder SALIR|responda SALIR/i,
    pedido: /\b(salir|sacar|baja|dar de baja|parar|pare|detener|stop|no (me )?(escriban|escriba|molesten|molestar|envíen|envien|manden|quiero|interesa))\b/i },
  portfolio: 'Mis trabajos:',
  promessa: /preparamos|preparé|prepare ya|ya hice|ya creé|ya cree|vista previa lista/i,
  observacoes: {
    ser_encontrado: (l) => `quien busca ${l.categoria?.toLowerCase() || 'este servicio'} en ${l.cidade} en Google no encuentra un sitio web de ${l.nome}`,
    modernizar: (l, s) => `el sitio web de ${l.nome} tiene algunos puntos que alejan clientes${s[0] ? ` (${s[0]})` : ''}`,
    independencia: (l, _s, sit) => `${l.nome} depende hoy de ${sit || 'plataformas de terceros'} para aparecer en línea`,
    reputacao: (l) => `${l.nome} tiene nota ${l.rating} en Google${l.avaliacoes ? ` con ${l.avaliacoes} reseñas` : ''}, pero no tiene un sitio web a la altura`,
    recuperar: (l) => `la dirección del sitio web de ${l.nome} no está abriendo`,
  },
  palavrasDoAngulo: {
    ser_encontrado: /google|encuentr|busca/, independencia: /depend|propi|red(es)? social|instagram|plataforma|agenda|menu|carta/,
    modernizar: /celular|movil|https|segur|actualiz|desactualiz|lent/, reputacao: /nota|resena|calific|estrella|opinion/, recuperar: /abr|funcion|direccion/,
  },
  aberturas: [
    (a, l) => `¡Hola! Soy ${a.nome}, ${a.oferta} en ${l.cidade}.`,
    (a) => `Hola, ¿cómo está? Mi nombre es ${a.nome}, ${a.oferta}.`,
    (a, l) => `¡Buenas tardes! Soy ${a.nome}, de ${l.cidade}; ${a.oferta}.`,
  ],
  fechos: ['¿Puedo mostrarle en 5 minutos cómo quedaría?', '¿Tiene sentido que le envíe una idea de cómo quedaría?', '¿Le gustaría ver un ejemplo rápido, sin compromiso?'],
  vi: 'Vi que',
  prompt: (a, l, obs) => ({
    sistema: `Escribes el primer mensaje de WhatsApp de ${a.nome}, que ${a.oferta}, para un negocio local.
Reglas: español de Paraguay, tono humano y directo, trato de "usted", de 2 a 4 frases cortas, máximo 1 emoji, sin enlaces.
Empieza saludando y presentándote como ${a.nome}. Menciona el nombre del negocio.
Usa la OBSERVACIÓN dada y ningún otro hecho. No inventes números, notas, plazos, problemas ni trabajos ya hechos.
Termina con una pregunta simple, sin presión. No escribas firma ni comillas.`,
    usuario: `NEGOCIO: ${l.nome} (${l.categoria}, ${l.cidade})\nOBSERVACIÓN: ${obs}\n\nEscribe solo el mensaje.`,
  }),
  // conferência do texto do modelo em espanhol (o BR/PT usa a de agentes.mjs)
  contradicoes(texto, lead, ajustes) {
    const t = sem(texto), p = [];
    if (lead.situacao_site !== 'site_fora_do_ar' && /fuera de linea|no abre|no carga|no funciona|caido|desactivad/.test(t)) p.push('diz que o site está fora do ar');
    if (lead.situacao_site === 'sem_site' && /su sitio web actual|su sitio web|el sitio de usted|su pagina web/.test(t)) p.push('fala de um site que não existe');
    if (!lead.rating && /nota|estrellas|resena|calificacion/.test(t)) p.push('cita nota sem ter nota');
    const remetente = sem(ajustes.remetente_nome).split(' ')[0];
    const negocio = sem(lead.nome).split(' ').filter((w) => w.length > 3 && !['barberia', 'restaurante', 'clinica', 'estudio', 'gimnasio'].includes(w))[0] || sem(lead.nome);
    if (!t.includes(remetente)) p.push('não se apresenta');
    if (!t.includes(negocio)) p.push('não cita o nome do negócio');
    if (/nuestros clientes|nuestra zona/.test(t)) p.push('fala como se fosse o negócio');
    return p;
  },
};

export const IDIOMAS = { 'pt-BR': PT_BR, 'pt-PT': PT_PT, 'es-PY': ES_PY };
export const idiomaDoPais = (pais) => IDIOMAS[paisDe(pais).idioma] || PT_BR;
export const idiomaDoLead = (lead) => idiomaDoPais(lead?.pais);

// remetente com a oferta certa para o idioma (BR usa a dos Ajustes; os outros têm a sua, que ajustes.ofertas[idioma] sobrescreve)
export function remetenteDoIdioma(ajustes, idioma) {
  const oferta = ajustes?.ofertas?.[idioma.id] || idioma.oferta || ajustes?.remetente_oferta;
  return { nome: ajustes.remetente_nome, oferta, portfolio: ajustes.remetente_portfolio };
}
