# Restaurar o Prospector num PC novo

O git guarda o código, os modelos 3D e a documentação. **Não** guarda: `.env` (senhas e chaves), `data/`
(banco de leads) e `.ferramentas/` (OpenWA e cloudflared, que são baixados de novo).

## 1. Programas
- Node 24 (ou 22.5+), Git, GitHub CLI (`gh auth login`)
- Python 3 + Playwright, só para a busca no Google Maps: `pip install playwright` e `python -m playwright install chromium`
- Ollama é opcional (sem ele os agentes decidem por regra e usam o texto fixo)

## 2. Código
```bash
git clone https://github.com/Victor-Enginner/VIRTUAL-3D-.git prospector
cd prospector
npm test        # 50 testes, sem dependência npm
cp .env.example .env
npm start       # http://127.0.0.1:4300
```

## 3. `.env`
Gerar de novo (valores novos servem):
- `ACESSO_SENHA` — senha do acesso pelo celular (só se for usar o túnel)
- `WEBHOOK_TOKEN` — 16+ caracteres aleatórios: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
- `OPENWA_API_KEY` — sai do passo 4

## 4. WhatsApp (OpenWA 0.24) em `.ferramentas/OpenWA`
```bash
mkdir .ferramentas && cd .ferramentas
git clone --depth 1 https://github.com/rmyndharis/OpenWA.git && cd OpenWA
npm ci                                   # npm 12 bloqueia scripts: better-sqlite3 já vem pré-compilado
node node_modules/puppeteer/install.mjs  # baixa o Chrome testado pelo OpenWA (~170 MB)
```
- **Ajuste de segurança obrigatório:** em `src/main.ts`, trocar `await app.listen(port);` por
  `await app.listen(port, process.env.LISTEN_HOST || '127.0.0.1');` — sem isso ele abre a porta 2785 para a rede.
- `.env` do OpenWA: copiar `.env.minimal` e acrescentar `AUTO_START_SESSIONS=true`, `SSRF_ALLOWED_HOSTS=127.0.0.1`,
  `SEND_PACING_ENABLED=true`, `SIMULATE_TYPING=true`, `RESOLVE_LID_TO_PHONE=true`, `WWEBJS_WEB_VERSION=off`.
- `npm run build` e `node dist/main`. A chave fica em `data/.api-key` → copiar para `OPENWA_API_KEY` no `.env` do Prospector.
- No Painel: **Conectar WhatsApp** → escanear o QR.

**Situação em 02/10/2026:** o motor `whatsapp-web.js` falhava ao iniciar ("Execution context was destroyed") por uma
mudança recente do WhatsApp Web; havia correções abertas no projeto dele. Ver se já saiu versão nova antes de insistir.

## 5. Acesso pelo celular (opcional)
Túnel temporário: baixar `cloudflared-windows-amd64.exe` (github.com/cloudflare/cloudflared/releases) para
`.ferramentas/` e rodar `cloudflared tunnel --url http://127.0.0.1:4300`. Definitivo: Tailscale.

## Modelos 3D com restrição
Desde 04/10/2026 o repositório é **público** (o Render da demonstração lê dele). Por isso:
- `cadeira-branca.glb` (Sketchfab Standard) **continua** no frontend por decisão do Victor (04/10/2026). A licença
  Standard não permite deixar o arquivo baixável; com o repo público ele fica. Se isso virar problema: repo privado
  (e conectar o GitHub no Render/Netlify) ou tirar o arquivo do repositório.
- `*-nc.glb` (CC-BY-NC / NC-SA) podem ser compartilhados **sem fins comerciais e com crédito** (`/creditos.html`).
  Nunca usar em material de cliente.
- Nunca versionar `data/`, `.env` ou senhas (o `.gitignore` e a trava `npm run verificar` conferem).
