"""Replace the dotted wordmark on the social card. Placement comes from the gold pixels, not a search."""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def trim(im, thresh=12):
    im = im.convert("RGBA")
    mask = im.getchannel("A").point(lambda v: 255 if v > thresh else 0)
    return im.crop(mask.getbbox())


def main():
    old = trim(Image.open(os.path.join(ROOT, "assets", "img", "brand", "heroone-logo.webp")))
    new = trim(Image.open(os.path.join(ROOT, "assets", "img", "brand", "heroone-wordmark.webp")))
    og_path = os.path.join(ROOT, "assets", "img", "og-image.jpg")
    og = Image.open(og_path).convert("RGB")
    arr = np.asarray(og)
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    gold = (r > 110) & (g > 60) & (r > b + 40) & (g > b) & ((r + g) > 220)
    gold[:110, :] = False
    gold[450:, :] = False
    gold[:, 510:] = False
    ys, xs = np.where(gold)
    top, bot, left, right = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    print("gold", left, top, right, bot)
    lh = bot - top + 1
    lw = round(old.width * (lh / old.height))
    print("place", lw, lh)
    placed_old = old.resize((lw, lh), Image.Resampling.LANCZOS)
    alpha = np.asarray(placed_old)[:, :, 3] > 16
    m = Image.fromarray((alpha.astype(np.uint8) * 255))
    for _ in range(2):
        m = m.filter(ImageFilter.MaxFilter(3))
    alpha = np.asarray(m) > 127
    x, y = left, top
    h, w = arr.shape[:2]
    # keep the mark on the card
    if y + lh > h:
        y = h - lh
    full = np.zeros((h, w), dtype=bool)
    full[y:y + lh, x:x + lw] = alpha

    src = arr.astype(np.float64)
    pad = 28
    y0, y1 = max(0, y - pad), min(h, y + lh + pad)
    x0, x1 = max(0, x - pad), min(w, x + lw + pad)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    local = full[y0:y1, x0:x1]
    known = ~local
    Xn = xx[known].astype(np.float64)
    Yn = yy[known].astype(np.float64)
    xc, yc = Xn.mean(), Yn.mean()
    Xn, Yn = (Xn - xc) / 100, (Yn - yc) / 100
    A = np.column_stack([np.ones(Xn.size), Xn, Yn, Xn * Yn, Xn ** 2, Yn ** 2])
    filled = src.copy()
    Xm = (xx[local].astype(np.float64) - xc) / 100
    Ym = (yy[local].astype(np.float64) - yc) / 100
    Am = np.column_stack([np.ones(Xm.size), Xm, Ym, Xm * Ym, Xm ** 2, Ym ** 2])
    for c in range(3):
        coef, *_ = np.linalg.lstsq(A, src[y0:y1, x0:x1, c][known], rcond=None)
        filled[y0:y1, x0:x1, c][local] = Am @ coef
    base = Image.fromarray(np.clip(filled, 0, 255).astype(np.uint8), "RGB")
    placed_new = new.resize((lw, lh), Image.Resampling.LANCZOS)
    base.paste(placed_new, (x, y), placed_new)
    prev = os.path.join(ROOT, "tools", "_preview")
    os.makedirs(prev, exist_ok=True)
    base.crop((x - 24, y - 24, x + lw + 36, y + lh + 70)).save(os.path.join(prev, "og-crop.png"), "PNG")
    base.resize((1000, 525), Image.Resampling.LANCZOS).save(os.path.join(prev, "og.png"), "PNG")
    base.save(og_path, "JPEG", quality=90, optimize=True, subsampling=1)
    print("saved")


if __name__ == "__main__":
    main()
