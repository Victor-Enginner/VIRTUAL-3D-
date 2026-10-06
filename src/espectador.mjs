// Modo espectador: um amigo vê o sistema REAL ao vivo pelo túnel, só olhando.
// Entra com a senha de espectador (ESPECTADOR_SENHA no .env), só lê (GET) uma lista fechada de rotas e os
// telefones dos leads saem mascarados. O que ele não vê: ajustes, WhatsApp, QR, tokens, qualquer escrita.

// só estas rotas de leitura existem para o espectador (tudo o mais dá 403)
export const LEITURA = /^\/api\/(estado|leads|eventos|varreduras|nichos|cobertura|capacidade|grafo|saude|aprendizado|habilidades|rejeicoes|decide\/stats|catalogo|calibracao|stream)(\/[\w.-]*)?$/;

export const permitido = (metodo, caminho) => metodo === 'GET' && (!caminho.startsWith('/api/') || LEITURA.test(caminho));

// "5516991740262" -> "•••••••••••62": só os 2 últimos dígitos ficam
export const ocultarNumero = (v) => String(v).replace(/\d(?=(?:\D*\d){2})/g, '•');

const CAMPO_TELEFONE = /("(?:telefone|whatsapp|celular|phone|chat_id)[\w]*"\s*:\s*")([^"]*)(")/gi;
export const mascarar = (texto) => String(texto).replace(CAMPO_TELEFONE, (_m, a, v, c) => a + ocultarNumero(v) + c);
