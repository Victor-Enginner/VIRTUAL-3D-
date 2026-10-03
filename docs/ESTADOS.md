# Estados de produção

Um **estado de produção** é um ponto do sistema que passou na verificação completa e pode ser restaurado inteiro:
código (tag git `producao-…`) + banco (cópia em `data/estados/<tag>.db`, só no PC).

## A trava (para não quebrar mais)

| Quando | O que roda | Se falhar |
|---|---|---|
| todo `git commit` (menos só-docs) | `scripts/hooks/pre-commit` → `npm run verificar` | o commit não entra |
| salvar estado | `npm run estado -- "descrição"` | o estado não é salvo |
| à mão, quando quiser | `npm run verificar` | mostra o que quebrou |

`npm run verificar` confere, nesta ordem:
1. todos os testes;
2. a sintaxe de todo JS (back e front);
3. se os contratos TOCOMAS carregam;
4. se cada página só aponta para arquivos que existem;
5. se o servidor sobe num banco vazio temporário e 12 rotas/páginas respondem 200;
6. se `.env`, `data/` e `.ferramentas/` ficam fora do git.

Depois de clonar ou formatar o PC, ligue a trava uma vez:
```bash
git config core.hooksPath scripts/hooks
```

## Regra de evolução
1. Mudança pequena → `npm run verificar` → commit (a trava roda de novo).
2. Fechou uma entrega (ex.: um item B do backlog) → `npm run estado -- "o que entrou"`.
3. Nunca editar o banco real para testar: cópia em pasta temporária e `PORT=4301`.

## Como voltar a um estado
```bash
git checkout producao-2026-10-03
```
Para o banco, com o servidor desligado, copie `data/estados/<tag>.db` por cima de `data/prospector.db`. Para voltar ao presente:
```bash
git checkout main
```

## Registro

| Tag | Commit | Data | Testes | Banco | O que tem |
|---|---|---|---|---|---|
| `producao-2026-10-03` | 0b5b244 | 2026-10-03 | 74 | data/estados/producao-2026-10-03.db | B1 portão, B7 preso 3 sinais, B10 calibração, B3 3 zonas, trava de verificação, PDF do workflow |
| `producao-2026-10-03-2` | 43cc60c | 2026-10-03 | 74 | data/estados/producao-2026-10-03-2.db | Frontend nº 1: aprovação em cartões com desfazer e gesto |
| `producao-2026-10-03-3` | 4c54660 | 2026-10-03 | 77 | data/estados/producao-2026-10-03-3.db | Visual Órbita: preto + neon, rede neural viva, fonte nativa; cartões de aprovação |
| `producao-2026-10-03-4` | 28d3044 | 2026-10-03 | 77 | data/estados/producao-2026-10-03-4.db | Workspace Órbita: Início, Produção, Agentes, Nichos, Engine |
| `producao-2026-10-03-5` | 9096527 | 2026-10-03 | 82 | data/estados/producao-2026-10-03-5.db | B16, linha do tempo, telão LED real, TV ao vivo 3D |
| `producao-2026-10-03-6` | 19e1cb2 | 2026-10-03 | 92 | data/estados/producao-2026-10-03-6.db | Movimento de multidão, rodas de conversa, TV nas duas telas |
