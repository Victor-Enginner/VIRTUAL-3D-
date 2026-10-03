# Publicar a demonstração (Render + Netlify)

**No ar desde 04/10/2026:**
- Link para os amigos: **https://prospector-victor.netlify.app/inicio.html**
- Servidor: **https://prospector-demo.onrender.com** (Render, conta "Vitor's workspace", Blueprint `prospector-demo`, sem relação com o Repass)
- Republicar o site depois de mudar o front (a pasta está ligada ao `opensources-page`, por isso o `--site` explícito):
  ```bash
  netlify deploy --prod --dir public --site 5396338c-87fe-4c38-99a3-f1b51c9606d3
  ```
- O Render republica sozinho a cada push no `main` (`autoDeploy`).
- O fluxo ao vivo (SSE) não passa pelo proxy do Netlify; as telas usam atualização periódica (Sala 3 s, Painel 8 s).

A versão pública é a **demonstração** (`DEMO=1`, `src/demo.mjs`):
- **Dados:** empresas fictícias "(exemplo)", com telefone e site de mentira; os seus leads reais nunca saem do PC.
- **Agentes:** um simulador no lugar dos reais. Nada de Maps, Ollama ou WhatsApp, e nada é enviado.
- **Quem visita** pode aprovar, descartar e editar mensagens fictícias. Varrer, dar comando, mudar ajustes, conectar o WhatsApp e pausar os agentes ficam bloqueados (403).
- **O banco** recomeça do zero sempre que o servidor reinicia.

```
amigo → https://SEU-SITE.netlify.app  (páginas: public/)
                │  /api/*  (proxy do Netlify, netlify.toml)
                ▼
        https://prospector-demo.onrender.com  (Node, DEMO=1, render.yaml)
```

## 1. Render (servidor) — grátis
1. Entre em **render.com** com a sua conta GitHub.
2. Clique em **New → Blueprint** e escolha o repositório `Victor-Enginner/VIRTUAL-3D-`. Ele é privado: autorize o Render a ler esse repositório.
3. O Render lê o `render.yaml` e cria o serviço **prospector-demo** (Node 24, plano free, `DEMO=1`). Confirme com **Apply**.
4. Espere o deploy terminar e copie a URL do serviço (algo como `https://prospector-demo.onrender.com`).
5. Teste abrindo `https://…onrender.com/api/estado`: tem que aparecer `"demo":true`.

> Plano free: o serviço **dorme depois de ~15 min sem visita**, e a primeira visita depois disso leva ~1 min para acordar.

## 2. Netlify (link para os amigos) — grátis
1. Se a URL do Render for diferente de `prospector-demo.onrender.com`, troque no `netlify.toml` (linha `to = …`) e faça commit.
2. Entre em **app.netlify.com**, clique em **Add new site → Import an existing project → GitHub** e escolha o mesmo repositório.
3. O Netlify lê o `netlify.toml`: publica a pasta `public` e não tem comando de build. Clique em **Deploy**.
4. Em **Site configuration → Change site name** dá para escolher o endereço (ex.: `prospector-victor.netlify.app`).

## 3. Conferir
- `https://SEU-SITE.netlify.app/inicio.html` → a faixa verde "Demonstração" no topo, e os números aparecem.
- Sala 3D → os agentes trabalham sozinhos (o Atlas acha empresas, a Maia escreve, o Leo "envia").
- Se a primeira carga demorar, o Render estava dormindo: espere ~1 min e recarregue.

## O que NÃO vai para a demonstração
- `data/` (o banco real) e o `.env` estão no `.gitignore` e nunca são enviados.
- O sistema real continua só no seu PC (`npm start`, em `127.0.0.1:4300`, com senha para o túnel).

## Licenças dos modelos 3D
São 32 modelos, listados em `/creditos.html` (a faixa da demo tem o link):
- **CC-BY:** precisa de crédito, que a página já dá.
- **CC-BY-NC / NC-SA (os `-nc`):** podem ser mostrados sem fins comerciais. Nunca em material para cliente.
- **Kenney:** CC0.
- **Sketchfab Standard (1 cadeira):** permitida em apps.
