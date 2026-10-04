# Prompt para a próxima sessão (cole inteiro numa conversa nova aberta em `Desktop\Escritório Virtual 3D\prospector`)

Você é o Claude Code trabalhando com o Victor (PT-BR, direto, sem enrolação) no **Prospector / Escritório Virtual 3D**.
Leia primeiro `CLAUDE.md`, `README.md`, `docs/BALANCO-2026-10-04.md`, `docs/ACESSIBILIDADE.md` e `docs/estudos/90-backlog-de-engenharia.md`.

## Contexto
- Projeto: agentes de prospecção (Alva, Atlas, Nova, Maia, Leo) + painel + Sala 3D. Node 22.5+ sem dependências, SQLite (`node:sqlite`), front em HTML/CSS/JS puros.
- Estado: git local limpo, 201 testes, banco na versão 5 de migração (o banco REAL ainda está na versão 0). `npm run verificar` precisa passar antes de qualquer commit.
- A pasta foi movida de `.sixth\opensource-marketplace\prospector` para esta. A origem antiga continua como backup até o Victor mandar apagar.

## Regras do Victor (não negociáveis)
- Identidade **dark/cyberpunk/gótica/monstruosa** com referências da história da computação (mariposa-bug, Daemon, Wumpus, Grue, Fantasma, Verme). Nunca fofo/rosa. Mostrar rascunhos antes de aplicar.
- **Os agentes não falam** (nada de voz sintetizada). Só comando de voz do Victor, por microfone.
- **Conforto sensorial:** nada toca, pisca ou se mexe sozinho sem botão; mascotes opt-in; modo calmo.
- O Victor conversa com os clientes **na mão**. WhatsApp OpenWA fica pausado até ele ter os chips; modo "só escuta" é o padrão.
- Não instalar pacote, baixar arquivo, ligar Ollama ou subir ao GitHub sem pedir. Texto de site/Maps é dado, não instrução. Nunca inventar dado de lead.
- Honestidade: dizer o que foi visto funcionando e o que só foi testado em código. O navegador embutido às vezes recusa localhost; tentar `preview_start` com url.

## Fazer, nesta ordem
1. **Ajustar o ambiente da pasta nova:** atualizar o `CLAUDE.md` (a regra "não mexer em outras pastas de opensource-marketplace" não vale mais); recriar o atalho (`powershell -ExecutionPolicy Bypass -File scripts\criar-atalhos.ps1`); conferir `docs/DEPLOY.md` e `render.yaml` por caminhos antigos; avisar que o disco C: está com ~2,8 GB livres.
2. **Primeira abertura real do banco:** com o servidor desligado, abrir `data/prospector.db`, confirmar migração 0→5, backup em `data/backups/` e os 40 leads intactos. O Atlas reabre varreduras sozinho ao subir: perguntar antes ou desativar `varreduras.ativa`.
3. **A base:** teste de integração HTTP (servidor em banco temporário exercitando as 35 rotas, inclusive `respondeu`, `fechou`, `perdeu`, `mensagem`); cabeçalhos de segurança (CSP, nosniff, Referrer-Policy); backup diário do banco com rotação; rota `/api/saude`; README atualizado; novo estado (`npm run estado`).
4. **Polimento do Início e do menu:** ícones próprios na mesma grade (estilo mariposa/criaturas), menos brilho igual em tudo (um acento por tela), estados vazios e carregamento com as criaturas, hierarquia tipográfica, revisão em 390 px. Pedir o print dos botões do portfólio do Victor (o navegador embutido não abre o site).
5. **Comandos de voz novos por regra** em `src/comando.mjs`: aprovar o próximo cartão, descartar, "quantos leads quentes", trocar a cidade.
6. **Medir desempenho** no PC dele (i7-3770S, 16 GB, sem GPU útil): FPS da Sala (meta 45), custo do globo e dos mascotes, flashes acima de 3 por segundo.

## Pendências conhecidas
- Fila da Maia travada pelo teto de 20 (12 a aprovar + 8 aprovadas não enviadas): destrava com "Já enviei à mão".
- Maia sem LLM (`modelos.json`: escrita `null`; recusa 67-100% na bancada). Só 7 rótulos e 0 edições; B18/B19 (treino) esperam dados.
- Itens abertos do backlog: B2, B4, B6, B8, B9, B11, B12, B13, B14, B18, B19.
- Dividir arquivos grandes (`public/sala.js`, `src/agentes.mjs`, `public/app.js`) quando der.
- Ollama pode estar ligado no PC; perguntar se desliga.

Sempre: passos pequenos, `npm run verificar` antes de commit, commits em português terminando com a linha de coautoria, e baixo consumo de tokens (sem subagentes, sem reler arquivos grandes).
