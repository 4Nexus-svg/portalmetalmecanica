# Detecta a regiao de rosto/pessoa numa foto e devolve o ponto focal para
# enquadramento (object-position do CSS), em JSON no stdout.
#
# Motivo: as artes de Instagram cortam a foto (landscape) para 4:5 e 9:16 com
# object-fit: cover. Com object-position: center, foto cujo rosto nao esta no
# centro geometrico sai cortada na testa/queixo. Aqui achamos onde o rosto esta.
#
# Sem OpenCV no ambiente (so Pillow + numpy), entao a deteccao e por tom de pele
# em YCbCr + HSV, com rotulacao de blobs e um filtro que separa ROSTO de MAO:
# maos costumam ser blobs menores e mais baixos que os rostos na mesma foto.
#
# Uso: python detectar-rosto.py <imagem> [--debug <saida.png>]
# Saida: {"ok":true,"focoX":0.52,"focoY":0.31,"blobs":N,"metodo":"pele"}
import json
import sys

try:
    import numpy as np
    from PIL import Image
except Exception as e:  # pragma: no cover
    print(json.dumps({"ok": False, "erro": f"dependencia ausente: {e}"}))
    sys.exit(0)

LARGURA_ANALISE = 320
AREA_MIN_REL = 0.0018   # blob menor que isso e ruido
AREA_MAX_REL = 0.45     # blob maior que isso costuma ser fundo/parede cor de pele

# Textura minima dentro do blob (gradiente medio de luminancia).
# Rosto tem detalhe interno (olhos, boca, sombra do nariz); ceu de fim de tarde,
# parede lisa e pele de madeira nao tem. Sem esse filtro, foto de fachada ao
# por do sol era classificada como rosto — o rosado do ceu passa na mascara de
# tom de pele. Medido no acervo do Portal Metalmecanica (28 fotos reais):
#   ceu de por do sol (falso positivo) -> 1.7
#   menor blob de rosto verdadeiro     -> 6.05
#   rostos tipicos                     -> 20 a 32
# Corte em 5.0 fica com folga dos dois lados.
GRAD_MIN = 5.0


def mascara_pele(rgb):
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)

    # YCbCr (faixa classica de pele)
    y = (0.299 * r + 0.587 * g + 0.114 * b)
    cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    m_ycc = (cb >= 77) & (cb <= 127) & (cr >= 133) & (cr <= 173) & (y > 40)

    # regra RGB de Kovac: reforca e corta falso positivo de vegetacao/ceu
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    m_rgb = (r > 95) & (g > 40) & (b > 20) & ((mx - mn) > 15) & (np.abs(r - g) > 15) & (r > g) & (r > b)

    return m_ycc & m_rgb


def erode(m):
    # erosao 4-vizinhos: tira pixels soltos sem precisar de scipy
    out = m.copy()
    out[1:, :] &= m[:-1, :]
    out[:-1, :] &= m[1:, :]
    out[:, 1:] &= m[:, :-1]
    out[:, :-1] &= m[:, 1:]
    return out


def rotular(m):
    """Rotula componentes conectados (4-vizinhos) por BFS iterativo."""
    h, w = m.shape
    labels = np.zeros((h, w), dtype=np.int32)
    blobs = []
    atual = 0
    visit = m.copy()
    idxs = np.argwhere(visit)
    for y0, x0 in idxs:
        if labels[y0, x0] != 0:
            continue
        atual += 1
        pilha = [(int(y0), int(x0))]
        labels[y0, x0] = atual
        minx = maxx = int(x0)
        miny = maxy = int(y0)
        area = 0
        soma_x = 0
        soma_y = 0
        while pilha:
            y, x = pilha.pop()
            area += 1
            soma_x += x
            soma_y += y
            if x < minx: minx = x
            if x > maxx: maxx = x
            if y < miny: miny = y
            if y > maxy: maxy = y
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and visit[ny, nx] and labels[ny, nx] == 0:
                    labels[ny, nx] = atual
                    pilha.append((ny, nx))
        blobs.append({
            "area": area, "minx": minx, "maxx": maxx, "miny": miny, "maxy": maxy,
            "cx": soma_x / area, "cy": soma_y / area,
        })
    return blobs


def main():
    caminho = sys.argv[1]
    im = Image.open(caminho).convert("RGB")
    w0, h0 = im.size
    escala = LARGURA_ANALISE / float(w0)
    im_p = im.resize((LARGURA_ANALISE, max(1, int(h0 * escala))), Image.BILINEAR)
    arr = np.asarray(im_p)
    h, w = arr.shape[0], arr.shape[1]
    total = h * w

    m = mascara_pele(arr)
    m = erode(m)
    blobs = rotular(m)

    # mapa de textura: soma dos gradientes horizontal e vertical da luminancia
    lum = (0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2])
    grad = (np.abs(np.diff(lum, axis=1, prepend=lum[:, :1]))
            + np.abs(np.diff(lum, axis=0, prepend=lum[:1, :])))

    validos = []
    for b in blobs:
        rel = b["area"] / total
        if rel < AREA_MIN_REL or rel > AREA_MAX_REL:
            continue
        bw = b["maxx"] - b["minx"] + 1
        bh = b["maxy"] - b["miny"] + 1
        if bw < 6 or bh < 6:
            continue
        prop = bw / float(bh)
        # rosto/cabeca tende a ser mais alto que largo ou quase quadrado
        if prop < 0.35 or prop > 2.2:
            continue
        # densidade: blob muito esparso costuma ser fundo
        if b["area"] / float(bw * bh) < 0.35:
            continue
        # textura: descarta superficie lisa (ceu, parede) que passou no tom de pele
        if float(grad[b["miny"]:b["maxy"] + 1, b["minx"]:b["maxx"] + 1].mean()) < GRAD_MIN:
            continue
        b["rel"] = rel
        validos.append(b)

    if not validos:
        print(json.dumps({"ok": False, "motivo": "nenhuma regiao de pele confiavel", "metodo": "pele"}))
        return

    # Separar ROSTO de MAO.
    # Score misto (area + altura) NAO funciona: numa foto de "joinha" a mao pode
    # ter area MAIOR que a cabeca (medido: mao 1243px vs rosto 1089px) e puxava
    # o foco para baixo/lado. O que separa de verdade e a POSICAO VERTICAL —
    # rostos ficam alinhados numa faixa; maos aparecem bem abaixo dela.
    maior = max(b["area"] for b in validos)
    significativos = [b for b in validos if b["area"] >= maior * 0.35]

    # o blob significativo mais ALTO ancora a linha dos rostos
    ancora = min(significativos, key=lambda b: b["cy"])
    faixa = 0.22 * h  # tolerancia vertical: rostos de pessoas lado a lado
    grupo = [b for b in significativos if abs(b["cy"] - ancora["cy"]) <= faixa]

    peso = sum(b["area"] for b in grupo)
    foco_x = sum(b["cx"] * b["area"] for b in grupo) / peso / w
    foco_y = sum(b["cy"] * b["area"] for b in grupo) / peso / h

    # O centroide da mancha de pele cai no meio do rosto/pescoco; sobe um pouco
    # em direcao ao topo da cabeca para enquadrar a linha dos OLHOS, que e o
    # ponto de leitura natural do retrato. Peso 0.75/0.25 medido na foto de
    # referencia: com 0.55/0.45 o foco subia demais e caia acima da cabeca.
    topo_grupo = min(b["miny"] for b in grupo) / h
    foco_y = foco_y * 0.75 + topo_grupo * 0.25

    print(json.dumps({
        "ok": True,
        "focoX": round(float(min(max(foco_x, 0.0), 1.0)), 4),
        "focoY": round(float(min(max(foco_y, 0.0), 1.0)), 4),
        "blobs": len(grupo),
        "candidatos": len(validos),
        "metodo": "pele",
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # nunca derruba o pipeline por causa do enquadramento
        print(json.dumps({"ok": False, "erro": str(e)[:200]}))
