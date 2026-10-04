"""Gera o ícone do Escritório Virtual (public/icone/prospector.ico e .png): a MARIPOSA-BUG, em neon.
Referência real da história da computação: em 1947 uma mariposa travou o relé do Harvard Mark II e virou o primeiro "bug".
Asas com trilhas de circuito, caveira no tronco (como a mariposa-caveira), olhos vermelhos, glitch cromático e cantos de HUD.
Estética dark/cyberpunk do Victor (preto + lima + sangue). Desenho próprio, determinístico.
Uso:  python scripts/gerar_icone.py     (precisa do Pillow, que já vem com o matplotlib)"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

S = 1024  # desenha grande e reduz (bordas suaves)
SAIDA = Path(__file__).resolve().parent.parent / "public" / "icone"
SAIDA.mkdir(parents=True, exist_ok=True)
LIMA, SANGUE, CIANO = (183, 255, 0), (255, 32, 64), (0, 237, 255)


def espelha(pts, cx=512):
    return [(2 * cx - x, y) for x, y in pts]


def tile(fundo_cor=(6, 6, 9)):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], radius=200, fill=255)
    base = Image.new("RGBA", (S, S), fundo_cor + (255,))
    d = ImageDraw.Draw(base)
    # chuva de glifos bem sutil (binário), como o Victor Hub AI OS
    rng = random.Random(3)
    for _ in range(260):
        x, y = rng.randrange(0, S, 26), rng.randrange(0, S, 30)
        d.text((x, y), rng.choice("01"), fill=(20, 60, 20, 255) if rng.random() < .8 else (70, 14, 24, 255))
    # vinheta + linhas de varredura
    vin = Image.new("L", (S, S), 0)
    ImageDraw.Draw(vin).ellipse([-200, -200, S + 200, S + 200], fill=255)
    escuro = Image.new("RGBA", (S, S), (0, 0, 0, 255))
    base = Image.composite(base, escuro, vin.filter(ImageFilter.GaussianBlur(160)))
    sc = ImageDraw.Draw(base)
    for y in range(0, S, 8):
        sc.line([(0, y), (S, y)], fill=(0, 0, 0, 70), width=3)
    img.paste(base, (0, 0), m)
    return img, m


def neon(camada, cor, brilho=16):
    """camada: RGBA só com traços brancos/opacos -> traço colorido com brilho."""
    alfa = camada.split()[3]
    cheio = Image.new("RGBA", (S, S), cor + (255,))
    nucleo = Image.composite(cheio, Image.new("RGBA", (S, S), (0, 0, 0, 0)), alfa)
    halo = nucleo.filter(ImageFilter.GaussianBlur(brilho))
    halo2 = nucleo.filter(ImageFilter.GaussianBlur(brilho / 3))
    return Image.alpha_composite(Image.alpha_composite(halo, halo2), nucleo)


def traco(desenhar, largura=12):
    c = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    desenhar(ImageDraw.Draw(c), largura)
    return c


def aberracao(img, camada, cor, desloc=7):
    """cópias deslocadas em ciano e sangue atrás do traço principal = glitch cromático."""
    a = neon(camada, SANGUE, 6).transform((S, S), Image.AFFINE, (1, 0, desloc, 0, 1, 0))
    b = neon(camada, CIANO, 6).transform((S, S), Image.AFFINE, (1, 0, -desloc, 0, 1, 0))
    a.putalpha(a.split()[3].point(lambda v: int(v * .55)))
    b.putalpha(b.split()[3].point(lambda v: int(v * .55)))
    return Image.alpha_composite(Image.alpha_composite(img, a), b)


def colchetes(img):
    """cantos de HUD (marcador de alvo), rótulo mono."""
    d = ImageDraw.Draw(img)
    for (x, y, sx, sy) in [(70, 70, 1, 1), (S - 70, 70, -1, 1), (70, S - 70, 1, -1), (S - 70, S - 70, -1, -1)]:
        d.line([(x, y + sy * 70), (x, y), (x + sx * 70, y)], fill=LIMA + (220,), width=7)
    return img


def circuito(d, w, linhas, nos=True, cor=None):
    for pts in linhas:
        d.line(pts, fill=(255, 255, 255, 255), width=w, joint="curve")
        if nos:
            x, y = pts[-1]
            d.ellipse([x - w, y - w, x + w, y + w], outline=(255, 255, 255, 255), width=max(3, w // 2))


# ---------------------------------------------------------------- C) MARIPOSA-CAVEIRA (o primeiro "bug", Harvard Mark II, 1947)
def mariposa(forte=False):
    """forte=True: versão para 16-32 px (traço grosso, sem trilhas, sem HUD). A normal é para 48 px ou mais."""
    img, m = tile()
    asa_alta = [(480, 430), (380, 330), (240, 280), (130, 330), (110, 450), (190, 560), (320, 585), (470, 540)]
    asa_baixa = [(476, 560), (360, 620), (290, 730), (350, 800), (450, 740), (486, 650)]
    cranio = [(512, 372), (462, 392), (452, 450), (476, 490), (484, 520), (540, 520), (548, 490), (572, 450), (562, 392), (512, 372)]

    def linhas(d, w):
        for asa in (asa_alta, asa_baixa):
            d.line(asa + [asa[0]], fill=(255, 255, 255, 255), width=w, joint="curve")
            d.line(espelha(asa) + [espelha(asa)[0]], fill=(255, 255, 255, 255), width=w, joint="curve")
        # trilhas de circuito dentro das asas (ângulos retos, com nós)
        if not forte:
            circuito(d, 7, [[(440, 480), (330, 480), (330, 400), (240, 400)], [(430, 520), (300, 520), (300, 470)], [(400, 560), (260, 560)],
                             [(410, 640), (360, 640), (360, 720)], [(150, 440), (210, 440), (210, 500)]])
            circuito(d, 7, [[(584, 480), (694, 480), (694, 400), (784, 400)], [(594, 520), (724, 520), (724, 470)], [(624, 560), (764, 560)],
                             [(614, 640), (664, 640), (664, 720)], [(874, 440), (814, 440), (814, 500)]])
        # tronco, abdômen segmentado e antenas
        d.line(cranio, fill=(255, 255, 255, 255), width=w - 2, joint="curve")
        d.ellipse([472, 436, 500, 464], outline=(255, 255, 255, 255), width=6)
        d.ellipse([524, 436, 552, 464], outline=(255, 255, 255, 255), width=6)
        d.line([(512, 470), (500, 490), (524, 490), (512, 470)], fill=(255, 255, 255, 255), width=5)
        d.line([(490, 520), (484, 600), (500, 720), (512, 810), (524, 720), (540, 600), (534, 520)], fill=(255, 255, 255, 255), width=w - 2, joint="curve")
        for y in range(560, 790, 38):
            d.line([(498, y), (526, y)], fill=(255, 255, 255, 255), width=5)
        d.line([(500, 372), (470, 300), (410, 250), (360, 150)], fill=(255, 255, 255, 255), width=8, joint="curve")
        d.line([(524, 372), (554, 300), (614, 250), (664, 150)], fill=(255, 255, 255, 255), width=8, joint="curve")

    cam = traco(linhas, 26 if forte else 11)
    if not forte:
        img = aberracao(img, cam, LIMA)
    img = Image.alpha_composite(img, neon(cam, LIMA, 15))
    olhos = traco(lambda d, w: (d.ellipse([478, 442, 494, 458], fill=(255, 255, 255, 255)), d.ellipse([530, 442, 546, 458], fill=(255, 255, 255, 255))), 4)
    img = Image.alpha_composite(img, neon(olhos, SANGUE, 14))
    return (img if forte else colchetes(img)), m



grande, _ = mariposa()
pequeno, _ = mariposa(forte=True)
final = grande.resize((512, 512), Image.LANCZOS)
final.save(SAIDA / "prospector.png")
# um quadro para cada tamanho: o Windows escolhe o que serve. 16-32 px usam a versão grossa, o resto a detalhada.
quadros = {t: (pequeno if t <= 32 else grande).resize((t, t), Image.LANCZOS) for t in (16, 24, 32, 48, 64, 128, 256)}
quadros[256].save(SAIDA / "prospector.ico", sizes=[(t, t) for t in quadros], append_images=[q for t, q in quadros.items() if t != 256])
print("ícone gerado em", SAIDA)
