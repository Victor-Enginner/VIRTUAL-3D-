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
