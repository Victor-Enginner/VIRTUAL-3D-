# web/ — ilhas React

Componentes de bibliotecas React (shadcn, Componentry, OriginKit) usados dentro do painel em JS puro.
O servidor e os testes do Prospector continuam **sem dependências**: só esta pasta tem `node_modules`, e o resultado compilado
(`public/ilhas/ilhas.js` e `ilhas.css`) vai para o git, então quem só roda o painel não precisa instalar nada.

```bash
cd web
pnpm install                                   # só quando for mexer nas ilhas
pnpm build                                     # gera ../public/ilhas
pnpm dlx shadcn@latest add @componentry/<nome> # registro do Componentry já está em components.json
pnpm dlx originkit@latest add <nome>           # exige login no OriginKit (originkit login)
```

Uso no painel: `window.Ilhas.montar("cartao-envios", elemento)`. Para criar uma ilha nova: arquivo em `src/ilhas/`, registrar em `src/ilhas.tsx`.

Regras: sem laço de animação infinito, sem áudio e sem voz (`test/conforto.test.mjs` confere o fonte); `MotionConfig` desliga o
movimento no modo calmo. O CSS do Tailwind entra **sem o reset** (preflight) para não mexer no resto do painel.
Componentes de terceiros: confira a licença de cada um antes de publicar (o Componentry avisa isso nas docs).
