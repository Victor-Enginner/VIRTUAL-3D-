# Restaurar o Escritório Virtual 3D depois de formatar (backup de 08/10/2026)

## Onde está cada coisa
| O quê | Onde | Observação |
|---|---|---|
| Código e documentação do Prospector | GitHub `Victor-Enginner/VIRTUAL-3D-` (branch `main`, commit `09d5a79` ou mais novo) | tudo o que está no git |
| **Tudo o que NÃO está no git** | `D:\BACKUP-ESCRITORIO-VIRTUAL-3D-2026-10-08\` → copiar para Google Drive / Terabox | ver os 3 zips abaixo |
| `01-escritorio-virtual-3d.zip` | a pasta `Desktop\Escritório Virtual 3D` inteira, sem `node_modules` | inclui `prospector/.env`, `prospector/data/` (banco com 130 leads), `.ferramentas/` (OpenWA), mídias pessoais, modelos 3D, `etbaal-mixamo/`, outros projetos da pasta e o histórico do git |
| `02-agentes-money.zip` | `Desktop\Agentes Money` inteiro, sem `node_modules` e `.next` | **não tem GitHub**: este zip é a única cópia (55 arquivos sem commit no dia do backup) |
| `03-memoria-claude.zip` | `C:\Users\Victor Ads\.claude\projects\C--Users-Victor-Ads-Desktop-Escrit-rio-Virtual-3D\` | memória e conversas do Claude Code deste projeto |

**O `.env` tem senhas e chaves.** No Google Drive/Terabox ele fica privado, mas não compartilhe o zip `01` com ninguém.

## Passo a passo no PC novo
1. Instalar: **Node.js 22.5+** (nodejs.org), **Git**, **Python 3** (marcar "Add to PATH"), **Google Chrome**.
   Opcionais: **Ollama** (ollama.com) e **Blender** (para mexer em modelos 3D).
2. Baixar os zips do Google Drive/Terabox e extrair:
   - `01-escritorio-virtual-3d.zip` → `C:\Users\<você>\Desktop\` (cria `Escritório Virtual 3D\`)
   - `02-agentes-money.zip` → `Desktop\` (cria `Agentes Money\`)
   - `03-memoria-claude.zip` → `C:\Users\<você>\.claude\projects\` (o Claude Code volta a lembrar de tudo)
3. Conferir o código com o GitHub (pega qualquer commit mais novo que o zip):
   ```bash
   cd "Desktop/Escritório Virtual 3D/prospector"
   git pull
   ```
4. Dependências:
   ```bash
   pip install playwright && python -m playwright install chromium   # coletor do Maps e testes visuais
   cd "Desktop/Escritório Virtual 3D/prospector/.ferramentas/OpenWA" && npm install   # WhatsApp (se for usar)
   cd "Desktop/Agentes Money" && corepack enable && corepack pnpm install
   ```
5. Ollama (modelo do "xodó"): `ollama pull goekdenizguelmez/JOSIEFIED-Qwen3:1.7b-q4_0`
6. Subir e conferir:
   ```bash
   cd "Desktop/Escritório Virtual 3D/prospector"
   npm run verificar      # tem que dar VERIFICAÇÃO OK
   npm start              # http://127.0.0.1:4300
   ```
   `GET /api/saude` deve mostrar `"banco":12` e `"leads":130`.
7. TV ao vivo: `python scripts/teste-tv.py sala` (abre o Chrome e confirma a imagem mudando).

## Se algo der errado
- Banco: há uma cópia íntegra em `prospector/data/backups/antes-de-formatar-2026-10-08.db` (dentro do zip `01`).
- O Prospector roda sem `data/` (cria um banco novo vazio) — então, se o zip `01` se perder, o código ainda volta pelo GitHub, mas os leads não. **Guarde o zip `01` em dois lugares.**
