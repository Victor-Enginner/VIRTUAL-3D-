"""Gera os visuais do Prospector a partir de grafo-semantico.json (fonte única):

  Prospector-Workflow-de-Producao.pdf  — capa, workflow, arquitetura, grafo 3D, como evoluir, próximas 10
  prospector-hoje.drawio               — o mesmo diagrama de arquitetura, editável no draw.io / diagrams.net
  grafo-3d.html                        — grafo semântico 3D interativo (gira com o dedo/mouse)

Rodar:  python docs/producao/gerar.py
Precisa: matplotlib, networkx (já instalados). plotly é opcional (só o HTML 3D).
Mudou o sistema? Edite o JSON e rode de novo — nunca edite os arquivos gerados à mão.
"""
import json
import math
import subprocess
import textwrap
from pathlib import Path
from xml.sax.saxutils import escape

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

AQUI = Path(__file__).parent
RAIZ = AQUI.parent.parent
G = json.loads((AQUI / "grafo-semantico.json").read_text(encoding="utf-8"))
NOS = {n["id"]: n for n in G["nos"]}

# paleta do design system (public/ui/tokens.css): grafite quente + âmbar, em papel claro para imprimir
TINTA, SUAVE, PAPEL, AMBAR = "#2a2622", "#6f675d", "#faf7f2", "#e8892b"
STATUS = {"pronto": "#3f9b6b", "parcial": "#e0a03a", "planejado": "#9a9389"}
CAMADA_ROTULO = {
    "frontend": "Frontend (o que você vê)", "api": "API e acesso", "agentes": "Agentes",
    "tocomas": "TOCOMAS (controle)", "decisao": "Decisão e aprendizado", "dados": "Dados (SQLite)", "externo": "Mundo externo",
}
A4 = (11.69, 8.27)


def git(*a):
    try:
        return subprocess.run(["git", *a], cwd=RAIZ, capture_output=True, text=True, encoding="utf-8").stdout.strip()
    except OSError:
        return ""


def pagina(titulo, sub=""):
    fig = plt.figure(figsize=A4, facecolor=PAPEL)
    fig.text(0.04, 0.94, titulo, fontsize=20, weight="bold", color=TINTA)
    if sub:
        fig.text(0.04, 0.905, sub, fontsize=10.5, color=SUAVE)
    fig.add_artist(plt.Line2D([0.04, 0.96], [0.89, 0.89], color=AMBAR, lw=2))
    fig.text(0.96, 0.02, f"Prospector · {G['data']}", fontsize=8, color=SUAVE, ha="right")
    return fig


def caixa(ax, x, y, w, h, texto, cor, borda=TINTA, fs=8.5, peso="normal", tcor=TINTA, quebra=None):
    if quebra:  # quebra cada linha para caber na caixa (o wrap do matplotlib não respeita a caixa)
        texto = "\n".join(textwrap.fill(l, quebra) for l in texto.split("\n"))
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h, boxstyle="round,pad=0.008,rounding_size=0.012",
                                fc=cor, ec=borda, lw=1.1))
    ax.text(x, y, texto, ha="center", va="center", fontsize=fs, weight=peso, color=tcor, wrap=True)


def seta(ax, a, b, cor=SUAVE, rad=0.0, lw=1.1, alpha=1.0, estilo="-|>"):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle=estilo, mutation_scale=11, color=cor, lw=lw, alpha=alpha,
                                 connectionstyle=f"arc3,rad={rad}", shrinkA=4, shrinkB=4))


# ---------------------------------------------------------------- posições da arquitetura (2D e draw.io)
ORDEM = ["frontend", "api", "agentes", "tocomas", "decisao", "dados", "externo"]


def posicoes():
    pos = {}
    for i, cam in enumerate(ORDEM):
        nos = [n for n in G["nos"] if n["camada"] == cam]
        y = 1 - (i + 0.5) / len(ORDEM)
        for j, n in enumerate(nos):
            pos[n["id"]] = ((j + 1) / (len(nos) + 1), y)
    return pos


# ---------------------------------------------------------------- páginas
def capa(pdf):
    fig = plt.figure(figsize=A4, facecolor=TINTA)
    fig.text(0.07, 0.70, "Prospector", fontsize=46, weight="bold", color=PAPEL)
    fig.text(0.07, 0.62, "Workflow de produção · arquitetura · como evoluir sem quebrar", fontsize=16, color=AMBAR)
    prontos = sum(1 for n in G["nos"] if n["status"] == "pronto")
    parciais = [n["rotulo"] for n in G["nos"] if n["status"] == "parcial"]
    commit = git("rev-parse", "--short", "HEAD") or "—"
    ncommits = git("rev-list", "--count", "HEAD") or "—"
    linhas = [
        f"Data: {G['data']}   ·   commit {commit}   ·   {ncommits} commits",
        f"{len(G['nos'])} componentes mapeados: {prontos} prontos, {len(parciais)} parciais",
        "Parciais: " + ", ".join(parciais),
        "Pipeline: 8 tarefas (T1–T8), 5 agentes, aprovação humana obrigatória antes de qualquer envio",
        "Trava: npm run verificar antes de todo commit · estados salvos com npm run estado",
        "Fonte única deste documento: docs/producao/grafo-semantico.json (rode gerar.py de novo ao mudar)",
    ]
    for i, l in enumerate(linhas):
        fig.text(0.07, 0.48 - i * 0.05, l, fontsize=12, color="#d9d2c7")
    fig.add_artist(plt.Line2D([0.07, 0.5], [0.585, 0.585], color=AMBAR, lw=3))
    pdf.savefig(fig, facecolor=fig.get_facecolor())
    plt.close(fig)


def workflow(pdf):
    fig = pagina("Workflow de produção", "Cada lead percorre T1→T8. Abaixo de cada tarefa, o portão que precisa abrir para ela rodar.")
    ax = fig.add_axes([0.03, 0.06, 0.94, 0.8])
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
    etapas = G["pipeline"]
    xs = [0.07 + i * (0.86 / (len(etapas) - 1)) for i in range(len(etapas))]
    cor_dono = {"Atlas": "#cfe9ee", "Nova": "#d9e0fb", "Maia": "#e7dcfb", "Você": "#fde3c4", "Leo": "#d6efdc"}
    for i, (e, x) in enumerate(zip(etapas, xs)):
        humano = e["dono"] == "Você"
        caixa(ax, x, 0.70, 0.105, 0.16, f"{e['id']}\n{e['nome']}\n— {e['dono']} —", cor_dono.get(e["dono"], "#eee"),
              borda=AMBAR if humano else TINTA, fs=9.5, peso="bold")
        caixa(ax, x, 0.38, 0.105, 0.2, e["portao"].replace(" · ", "\n"), "#ffffff", borda="#c9c0b3", fs=7.4, quebra=17)
        seta(ax, (x, 0.62), (x, 0.48), cor="#c9c0b3", estilo="-")
        if i < len(etapas) - 1:
            seta(ax, (x + 0.053, 0.70), (xs[i + 1] - 0.053, 0.70), cor=TINTA, lw=1.6)
    # retornos que existem de verdade
    seta(ax, (xs[7], 0.79), (xs[2], 0.79), cor=AMBAR, rad=0.25, lw=1.3)
    ax.text((xs[7] + xs[2]) / 2, 0.93, "T8 → T3: seus Aprovar/Descartar ensinam a Nova (cabeças + regras aprendidas + calibração)",
            ha="center", fontsize=8.5, color=AMBAR)
    ax.text(0.5, 0.17, "Fora do caminho feliz (crença do lead, PoS):", ha="center", fontsize=10, weight="bold", color=TINTA)
    ax.text(0.5, 0.10,
            "portão recusa → pendência 'handoff_bloqueado' (sem job)   ·   3 sinais → preso: Parado / Ciclo / Deriva, cada um com sua recuperação\n"
            "zona baixa calibrada → Nova descarta sozinha (1 em 10 vem para você)   ·   Reprocessar zera conflitos, janela e diagnóstico",
            ha="center", fontsize=8.5, color=SUAVE)
    pdf.savefig(fig, facecolor=PAPEL)
    plt.close(fig)


def arquitetura(pdf):
    fig = pagina("O que já temos pronto hoje", "Estilo draw.io: uma faixa por camada. Verde = pronto · âmbar = parcial. Mesmo diagrama editável em prospector-hoje.drawio.")
    ax = fig.add_axes([0.02, 0.05, 0.96, 0.82])
    ax.set_xlim(-0.16, 1); ax.set_ylim(0, 1); ax.axis("off")
    pos = posicoes()
    for i, cam in enumerate(ORDEM):
        y = 1 - (i + 0.5) / len(ORDEM)
        ax.add_patch(FancyBboxPatch((-0.155, y - 0.06), 1.15, 0.12, boxstyle="round,pad=0,rounding_size=0.01",
                                    fc="#f1ece4" if i % 2 else "#f6f2ec", ec="none"))
        ax.text(-0.15, y, CAMADA_ROTULO[cam], fontsize=8.5, weight="bold", color=SUAVE, va="center")
    for a in G["arestas"]:
        (x1, y1), (x2, y2) = pos[a["de"]], pos[a["para"]]
        seta(ax, (x1, y1), (x2, y2), cor=SUAVE, rad=0.12 if abs(y1 - y2) < 0.01 else 0.05, lw=0.7, alpha=0.45)
    for n in G["nos"]:
        x, y = pos[n["id"]]
        k = sum(1 for m in G["nos"] if m["camada"] == n["camada"])
        w = min(0.105, 0.9 / (k + 1))  # caixas mais estreitas em faixa cheia (TOCOMAS tem 8)
        caixa(ax, x, y, w, 0.08, n["rotulo"], "#ffffff", borda=STATUS[n["status"]], fs=6.6, quebra=int(w * 190))
    pdf.savefig(fig, facecolor=PAPEL)
    plt.close(fig)


def grafo3d(pdf):
    fig = pagina("Grafo semântico 3D", "Altura = camada · cor = status · linhas = relações (chama, grava, handoff, valida…). Versão interativa: grafo-3d.html")
    ax = fig.add_axes([0.02, 0.03, 0.96, 0.85], projection="3d")
    ax.set_facecolor(PAPEL)
    pos3 = {}
    for cam in ORDEM:
        nos = [n for n in G["nos"] if n["camada"] == cam]
        z = len(ORDEM) - ORDEM.index(cam)
        for j, n in enumerate(nos):
            ang = 2 * math.pi * j / max(1, len(nos)) + ORDEM.index(cam) * 0.6
            r = 1.0 + 0.15 * len(nos)
            pos3[n["id"]] = (r * math.cos(ang), r * math.sin(ang), z)
    for a in G["arestas"]:
        p, q = pos3[a["de"]], pos3[a["para"]]
        ax.plot([p[0], q[0]], [p[1], q[1]], [p[2], q[2]], color=SUAVE, lw=0.6, alpha=0.4)
    for n in G["nos"]:
        x, y, z = pos3[n["id"]]
        ax.scatter([x], [y], [z], s=70, color=STATUS[n["status"]], edgecolor=TINTA, linewidth=0.5, depthshade=False)
        ax.text(x, y, z + 0.18, n["rotulo"], fontsize=5.8, color=TINTA, ha="center")
    ax.set_zticks(range(1, len(ORDEM) + 1))
    ax.set_zticklabels([CAMADA_ROTULO[c].split(" (")[0] for c in reversed(ORDEM)], fontsize=6.5)
    ax.set_xticks([]); ax.set_yticks([])
    ax.view_init(elev=18, azim=-60)
    pdf.savefig(fig, facecolor=PAPEL)
    plt.close(fig)


def evoluir(pdf):
    fig = pagina("Como evoluir sem quebrar", "Fluxo obrigatório para qualquer mudança. As setas âmbar são os pontos onde a trava barra.")
    ax = fig.add_axes([0.03, 0.05, 0.94, 0.82])
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
    passos = [
        (0.08, 0.75, "Ideia / paper\n(docs/estudos)"),
        (0.24, 0.75, "Item no backlog\nB1–B15 ou F#"),
        (0.40, 0.75, "Mudança pequena\n+ teste novo"),
        (0.56, 0.75, "npm run\nverificar"),
        (0.72, 0.75, "git commit\n(trava roda de novo)"),
        (0.88, 0.75, "Entrega fechada?"),
        (0.88, 0.40, "npm run estado\n-- \"descrição\""),
        (0.66, 0.40, "tag producao-…\n+ cópia do banco"),
        (0.44, 0.40, "docs/ESTADOS.md\n(registro)"),
        (0.22, 0.40, "Push para o\nrepo privado"),
    ]
    for x, y, t in passos:
        dec = t.endswith("?")
        caixa(ax, x, y, 0.13, 0.13, t, "#fde3c4" if dec else "#ffffff", borda=AMBAR if dec else TINTA, fs=8.5, peso="bold" if dec else "normal")
    for i in range(5):
        seta(ax, (passos[i][0] + 0.065, 0.75), (passos[i + 1][0] - 0.065, 0.75), cor=TINTA, lw=1.5)
    seta(ax, (0.88, 0.685), (0.88, 0.465), cor=TINTA, lw=1.5); ax.text(0.89, 0.57, "sim", fontsize=8.5, color=TINTA)
    for a, b in [(6, 7), (7, 8), (8, 9)]:
        seta(ax, (passos[a][0] - 0.065, 0.40), (passos[b][0] + 0.065, 0.40), cor=TINTA, lw=1.5)
    seta(ax, (0.86, 0.82), (0.42, 0.82), cor=SUAVE, rad=0.3); ax.text(0.64, 0.95, "não: próxima mudança pequena", fontsize=8, color=SUAVE, ha="center")
    seta(ax, (0.56, 0.685), (0.42, 0.685), cor=AMBAR, rad=-0.5, lw=1.4); ax.text(0.49, 0.56, "falhou: corrige", fontsize=8, color=AMBAR, ha="center")
    seta(ax, (0.72, 0.685), (0.42, 0.68), cor=AMBAR, rad=-0.6, lw=1.4); ax.text(0.6, 0.5, "commit bloqueado", fontsize=8, color=AMBAR, ha="center")
    regras = [
        "Nunca testar no banco real: cópia em pasta temporária + PORT=4301.",
        "Fato é regra (determinístico); julgamento é modelo, só entre opções fechadas.",
        "Mudança motivada por paper cita o id do arXiv no código e no commit.",
        "Voltar no tempo: git checkout producao-AAAA-MM-DD + copiar data/estados/<tag>.db.",
    ]
    for i, r in enumerate(regras):
        ax.text(0.04, 0.2 - i * 0.045, "•  " + r, fontsize=9.5, color=TINTA)
    pdf.savefig(fig, facecolor=PAPEL)
    plt.close(fig)


def proximas(pdf):
    fig = pagina("Próximas 10 evoluções de frontend", "Ordem recomendada. Cada uma usa algo que já existe no back (coluna 'base').")
    ax = fig.add_axes([0.03, 0.04, 0.94, 0.84])
    ax.axis("off")
    linhas = [[str(e["n"]), ("✓ " if e.get("status") == "feito" else "") + e["titulo"], e["porque"], e["como"], e["base"]] for e in G["evolucoes_frontend"]]
    linhas = [[c if i < 2 else "\n".join(textwrap.wrap(c, 38)) for i, c in enumerate(l)] for l in linhas]
    linhas = [[l[0], "\n".join(textwrap.wrap(l[1], 24)), *l[2:]] for l in linhas]
    t = ax.table(cellText=linhas, colLabels=["#", "Evolução", "Por quê", "Como", "Base que já existe"],
                 colWidths=[0.03, 0.17, 0.27, 0.29, 0.24], loc="upper center", cellLoc="left")
    t.auto_set_font_size(False); t.set_fontsize(7.4)
    for (r, c), cel in t.get_celld().items():
        cel.set_edgecolor("#ddd5c9")
        cel.set_height(0.088 if r else 0.04)
        if r == 0:
            cel.set_facecolor(TINTA); cel.get_text().set_color(PAPEL); cel.get_text().set_weight("bold")
        else:
            cel.set_facecolor("#ffffff" if r % 2 else "#f6f2ec")
    pdf.savefig(fig, facecolor=PAPEL)
    plt.close(fig)


def inventario(pdf):
    fig = pagina("Inventário dos componentes", "Cada nó do grafo com arquivo, status e paper de origem.")
    ax = fig.add_axes([0.03, 0.04, 0.94, 0.84]); ax.axis("off")
    linhas = [[CAMADA_ROTULO[n["camada"]].split(" (")[0], n["rotulo"], n["status"], n.get("paper", ""), n["arquivo"][:60]] for n in G["nos"]]
    t = ax.table(cellText=linhas, colLabels=["Camada", "Componente", "Status", "Paper", "Arquivo"],
                 colWidths=[0.13, 0.25, 0.07, 0.09, 0.46], loc="upper center", cellLoc="left")
    t.auto_set_font_size(False); t.set_fontsize(6.6)
    for (r, c), cel in t.get_celld().items():
        cel.set_edgecolor("#ddd5c9"); cel.set_height(0.0215)
        if r == 0:
            cel.set_facecolor(TINTA); cel.get_text().set_color(PAPEL)
        elif c == 2:
            cel.set_facecolor(STATUS[linhas[r - 1][2]] + "55")
    pdf.savefig(fig, facecolor=PAPEL)
    plt.close(fig)


# ---------------------------------------------------------------- draw.io
def drawio():
    pos = posicoes()
    L, A = 1600, 980
    cel = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    for i, cam in enumerate(ORDEM):
        y = int(A * i / len(ORDEM)) + 10
        cel.append(f'<mxCell id="faixa_{cam}" value="{escape(CAMADA_ROTULO[cam])}" '
                   f'style="swimlane;horizontal=0;startSize=150;fillColor={"#f1ece4" if i % 2 else "#f6f2ec"};strokeColor=#ddd5c9;fontStyle=1;fontColor=#6f675d;" '
                   f'vertex="1" parent="1"><mxGeometry x="10" y="{y}" width="{L + 160}" height="{int(A / len(ORDEM)) - 6}" as="geometry"/></mxCell>')
    for n in G["nos"]:
        x, y = pos[n["id"]]
        px, py = int(160 + x * L) - 80, int((1 - y) * A) - 22 + 10
        dica = escape(f'{n["arquivo"]}' + (f' · arXiv {n["paper"]}' if n.get("paper") else ""))
        cel.append(f'<mxCell id="{n["id"]}" value="{escape(n["rotulo"])}" tooltip="{dica}" '
                   f'style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor={STATUS[n["status"]]};strokeWidth=2;fontColor=#2a2622;" '
                   f'vertex="1" parent="1"><mxGeometry x="{px}" y="{py}" width="160" height="44" as="geometry"/></mxCell>')
    for i, a in enumerate(G["arestas"]):
        cel.append(f'<mxCell id="e{i}" value="{escape(a["rel"])}" style="endArrow=block;html=1;rounded=1;strokeColor=#9a9389;fontSize=9;fontColor=#6f675d;" '
                   f'edge="1" parent="1" source="{a["de"]}" target="{a["para"]}"><mxGeometry relative="1" as="geometry"/></mxCell>')
    xml = (f'<mxfile host="prospector-gerar.py"><diagram id="hoje" name="Prospector {G["data"]}">'
           f'<mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" page="1" pageWidth="{L + 200}" pageHeight="{A + 40}" background="#faf7f2">'
           f'<root>{"".join(cel)}</root></mxGraphModel></diagram></mxfile>')
    (AQUI / "prospector-hoje.drawio").write_text(xml, encoding="utf-8")


def html3d():
    try:
        import plotly.graph_objects as go
    except ImportError:
        print("plotly não instalado: grafo-3d.html não gerado")
        return
    import networkx as nx
    g = nx.DiGraph()
    for n in G["nos"]:
        g.add_node(n["id"])
    for a in G["arestas"]:
        g.add_edge(a["de"], a["para"])
    xy = nx.spring_layout(g.to_undirected(), seed=7, k=0.9)
    z = {n["id"]: len(ORDEM) - ORDEM.index(n["camada"]) for n in G["nos"]}
    ex, ey, ez = [], [], []
    for a in G["arestas"]:
        for k in (a["de"], a["para"]):
            ex.append(xy[k][0]); ey.append(xy[k][1]); ez.append(z[k])
        ex.append(None); ey.append(None); ez.append(None)
    fig = go.Figure([
        go.Scatter3d(x=ex, y=ey, z=ez, mode="lines", line=dict(color="#9a9389", width=2), hoverinfo="none"),
        go.Scatter3d(x=[xy[n["id"]][0] for n in G["nos"]], y=[xy[n["id"]][1] for n in G["nos"]], z=[z[n["id"]] for n in G["nos"]],
                     mode="markers+text", text=[n["rotulo"] for n in G["nos"]], textposition="top center",
                     marker=dict(size=7, color=[STATUS[n["status"]] for n in G["nos"]], line=dict(color=TINTA, width=1)),
                     hovertext=[f'{n["rotulo"]}<br>{CAMADA_ROTULO[n["camada"]]}<br>{n["status"]}<br>{n["arquivo"]}' for n in G["nos"]],
                     hoverinfo="text"),
    ])
    fig.update_layout(title=f'{G["titulo"]} · {G["data"]}', showlegend=False, paper_bgcolor=PAPEL,
                      scene=dict(zaxis=dict(tickvals=list(range(1, len(ORDEM) + 1)), ticktext=[CAMADA_ROTULO[c].split(" (")[0] for c in reversed(ORDEM)], title=""),
                                 xaxis=dict(visible=False), yaxis=dict(visible=False)))
    fig.write_html(AQUI / "grafo-3d.html", include_plotlyjs="cdn")


if __name__ == "__main__":
    ids = set(NOS)
    ruins = [a for a in G["arestas"] if a["de"] not in ids or a["para"] not in ids]
    assert not ruins, f"arestas apontando para nó inexistente: {ruins}"
    with PdfPages(AQUI / "Prospector-Workflow-de-Producao.pdf") as pdf:
        capa(pdf); workflow(pdf); arquitetura(pdf); grafo3d(pdf); evoluir(pdf); proximas(pdf); inventario(pdf)
        info = pdf.infodict(); info["Title"] = "Prospector — Workflow de produção"; info["Author"] = "Victor"
    drawio()
    html3d()
    print("ok: PDF (7 páginas), prospector-hoje.drawio, grafo-3d.html")
