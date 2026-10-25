"""One-shot: publish the clean Hero One wordmark (no dots) and refresh icons + the social card."""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = os.path.join(ROOT, "assets", "img", "brand")
INK = (6, 8, 15)  # #06080f


def trim(im, thresh=12):
    im = im.convert("RGBA")
    mask = im.getchannel("A").point(lambda v: 255 if v > thresh else 0)
    box = mask.getbbox()
    return im.crop(box)


def fit(mark, size, margin):
    canvas = Image.new("RGB", (size, size), INK)
    inner = size - 2 * margin
    scale = min(inner / mark.width, inner / mark.height)
    nw, nh = max(1, round(mark.width * scale)), max(1, round(mark.height * scale))
    resized = mark.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def main():
    src = Image.open(os.path.join(BRAND, "HeroOne_AppleMusic_Logo_3000x1200.png"))
    word = trim(src)
    print("wordmark", word.size)
    out = os.path.join(BRAND, "heroone-wordmark.webp")
    word.save(out, "WEBP", quality=90, method=6)
    print("wrote", out, os.path.getsize(out))

    bolt = trim(Image.open(os.path.join(BRAND, "HeroOne_YouTube_Watermark_Bolt_800.png")))
    print("bolt", bolt.size)
    fit(bolt, 32, 2).save(os.path.join(BRAND, "favicon-32.png"), "PNG", optimize=True)
    # Larger icons carry the full wordmark, the same lockup as the header.
    fit(word, 180, 16).save(os.path.join(BRAND, "apple-touch-icon.png"), "PNG", optimize=True)
    fit(word, 192, 16).save(os.path.join(BRAND, "icon-192.png"), "PNG", optimize=True)
    fit(word, 512, 44).save(os.path.join(BRAND, "icon-512.png"), "PNG", optimize=True)

    # Social card: lift the dotted wordmark off the dark field, then place the clean one.
    og_path = os.path.join(ROOT, "assets", "img", "og-image.jpg")
    og = Image.open(og_path).convert("RGB")
    arr = np.asarray(og).astype(np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    gold = (r > 95) & (g > 50) & (r > (b * 1.35).astype(np.int16)) & (g > (b * 0.8).astype(np.int16)) & ((r + g) > 190)
    zone = np.zeros(gold.shape, dtype=bool)
    zone[115:455, 65:545] = True
    mask = gold & zone
    m = Image.fromarray((mask.astype(np.uint8) * 255))
    for _ in range(5):
        m = m.filter(ImageFilter.MaxFilter(3))
    mask = np.asarray(m) > 127
    ys, xs = np.where(mask)
    print("og mask", int(mask.sum()), "bbox", int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))

    filled = arr.copy()
    # Per-row fill from the dark field just outside the mark, so the gradient survives.
    h, w = mask.shape
    for y in range(h):
        cols = np.where(mask[y])[0]
        if cols.size == 0:
            continue
        left = max(0, cols[0] - 18)
        right = min(w - 1, cols[-1] + 18)
        # sample unmasked pixels in a short run outside each end
        def sample(x0, x1):
            sl = arr[y, x0:x1]
            keep = ~mask[y, x0:x1]
            if keep.any():
                return np.median(sl[keep], axis=0)
            return arr[y, x0]

        c0 = sample(max(0, left - 24), left)
        c1 = sample(right, min(w, right + 24))
        span = max(1, cols[-1] - cols[0])
        for x in cols:
            t = (x - cols[0]) / span
            filled[y, x] = (1 - t) * c0 + t * c1

    base = Image.fromarray(filled.astype(np.uint8), "RGB")
    # Soften only the repaired pixels so the fill doesn't read as stripes.
    blur = base.filter(ImageFilter.GaussianBlur(radius=1.2))
    soft = np.asarray(base).copy()
    bsoft = np.asarray(blur)
    # dilate mask one more pixel for the blend
    edge = Image.fromarray((mask.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(3))
    em = np.asarray(edge) > 127
    soft[em] = bsoft[em]
    base = Image.fromarray(soft, "RGB")

    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    bw, bh = box[2] - box[0], box[3] - box[1]
    scale = min(bw / word.width, bh / word.height) * 0.98
    nw, nh = round(word.width * scale), round(word.height * scale)
    placed = word.resize((nw, nh), Image.Resampling.LANCZOS)
    px = box[0] + (bw - nw) // 2
    py = box[1] + (bh - nh) // 2
    base.paste(placed, (px, py), placed)
    base.save(og_path, "JPEG", quality=88, optimize=True, subsampling=1)
    print("og placed", nw, nh, "at", px, py)

    # Previews for a visual check (not published).
    prev = os.path.join(ROOT, "tools", "_preview")
    os.makedirs(prev, exist_ok=True)
    def plate(im, color, name):
        p = Image.new("RGB", im.size, color)
        p.paste(im, (0, 0), im)
        p.thumbnail((900, 500), Image.Resampling.LANCZOS)
        p.save(os.path.join(prev, name), "PNG")
    plate(word, (6, 8, 15), "word-dark.png")
    plate(word, (251, 251, 250), "word-light.png")
    base.resize((900, 473), Image.Resampling.LANCZOS).save(os.path.join(prev, "og.png"), "PNG")
    fit(word, 512, 44).save(os.path.join(prev, "icon512.png"), "PNG")
    fit(bolt, 32, 2).resize((128, 128), Image.Resampling.NEAREST).save(os.path.join(prev, "favicon-zoom.png"), "PNG")


if __name__ == "__main__":
    main()
