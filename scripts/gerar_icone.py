"""Gera o ícone do Escritório Virtual (public/icone/prospector.ico e .png): a Alva como um bichinho liso e brilhante
(estilo ícone de aplicativo, sem pelo) num azulejo escuro com um fio de luz lima. Desenho próprio, sem copiar personagem alheio.
Uso:  python scripts/gerar_icone.py     (precisa do Pillow, que já vem com o matplotlib)"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

S = 1024  # desenha grande e reduz (bordas suaves)
SAIDA = Path(__file__).resolve().parent.parent / "public" / "icone"
SAIDA.mkdir(parents=True, exist_ok=True)

LIMA = (183, 255, 0)
ROSA_CLARO = (255, 150, 205)
ROSA_ESCURO = (186, 46, 118)


def vertical(tamanho, topo, base):
    """Degradê vertical de topo para base."""
    g = Image.linear_gradient("L").resize(tamanho)
    return Image.composite(Image.new("RGB", tamanho, base), Image.new("RGB", tamanho, topo), g)


def borrar(camada, r):
    return camada.filter(ImageFilter.GaussianBlur(r))


# ---- azulejo
azulejo_mascara = Image.new("L", (S, S), 0)
ImageDraw.Draw(azulejo_mascara).rounded_rectangle([0, 0, S - 1, S - 1], radius=226, fill=255)
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
img.paste(vertical((S, S), (34, 34, 46), (9, 9, 14)).convert("RGBA"), (0, 0), azulejo_mascara)
# brilho suave no topo e fio de luz lima na borda (assinatura da marca, sem aro berrante)
luz = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(luz).ellipse([140, -380, S - 140, 330], fill=(255, 255, 255, 26))
img = Image.alpha_composite(img, Image.composite(borrar(luz, 30), Image.new("RGBA", (S, S), (0, 0, 0, 0)), azulejo_mascara))
fio = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(fio).rounded_rectangle([5, 5, S - 6, S - 6], radius=222, outline=LIMA + (150,), width=8)
img = Image.alpha_composite(img, fio)

# ---- sombra no chão
sombra = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(sombra).ellipse([232, 800, 792, 886], fill=(0, 0, 0, 170))
img = Image.alpha_composite(img, borrar(sombra, 26))

# ---- corpo liso: elipse larga + duas orelhinhas
corpo_m = Image.new("L", (S, S), 0)
cm = ImageDraw.Draw(corpo_m)
cm.ellipse([166, 318, 858, 836], fill=255)
for ox in (306, 718):
    cm.ellipse([ox - 78, 270, ox + 78, 420], fill=255)
corpo_m = corpo_m.filter(ImageFilter.GaussianBlur(1.2))
corpo = vertical((S, S), ROSA_CLARO, ROSA_ESCURO).convert("RGBA")
# sombreado: canto inferior direito mais escuro, para dar volume
vol = Image.new("L", (S, S), 0)
ImageDraw.Draw(vol).ellipse([360, 420, 1000, 1000], fill=110)
corpo = Image.composite(Image.new("RGBA", (S, S), (90, 12, 60, 255)), corpo, ImageChops.multiply(borrar(vol, 90), corpo_m))
img.paste(corpo, (0, 0), corpo_m)
# reflexo brilhante no alto à esquerda
ref = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(ref).ellipse([262, 352, 520, 470], fill=(255, 255, 255, 95))
img = Image.alpha_composite(img, Image.composite(borrar(ref, 14), Image.new("RGBA", (S, S), (0, 0, 0, 0)), corpo_m))

# ---- rosto
rosto = Image.new("RGBA", (S, S), (0, 0, 0, 0))
rd = ImageDraw.Draw(rosto)
for ex in (404, 620):
    rd.ellipse([ex - 40, 548 - 54, ex + 40, 548 + 54], fill=(28, 14, 34, 255))
    rd.ellipse([ex - 22, 548 - 38, ex + 2, 548 - 14], fill=(255, 255, 255, 245))   # brilho grande
    rd.ellipse([ex + 8, 548 + 14, ex + 24, 548 + 30], fill=(255, 255, 255, 210))   # brilho pequeno
img = Image.alpha_composite(img, rosto)
rub = Image.new("RGBA", (S, S), (0, 0, 0, 0))
for bx in (300, 724):
    ImageDraw.Draw(rub).ellipse([bx - 52, 640 - 30, bx + 52, 640 + 30], fill=(255, 100, 150, 130))
img = Image.alpha_composite(img, borrar(rub, 9))
ImageDraw.Draw(img).arc([464, 596, 560, 676], 25, 155, fill=(70, 20, 60, 255), width=14)

# ---- antena com a bolinha lima
d = ImageDraw.Draw(img)
d.line([(512, 322), (512, 232)], fill=(150, 36, 98, 255), width=20)
halo = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(halo).ellipse([512 - 78, 190 - 78, 512 + 78, 190 + 78], fill=LIMA + (150,))
img = Image.alpha_composite(img, borrar(halo, 22))
d = ImageDraw.Draw(img)
d.ellipse([512 - 44, 190 - 44, 512 + 44, 190 + 44], fill=LIMA + (255,))
d.ellipse([512 - 20, 190 - 28, 512 + 2, 190 - 6], fill=(255, 255, 255, 230))

final = img.resize((512, 512), Image.LANCZOS)
final.save(SAIDA / "prospector.png")
final.save(SAIDA / "prospector.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("ícone gerado em", SAIDA)
