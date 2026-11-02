#!/usr/bin/env python3
"""Generate 1200x630 Open Graph cards for awhind.com (run locally, commit the PNGs).

  python3 scripts/gen_og_cards.py           # default + any missing article/briefing cards
  python3 scripts/gen_og_cards.py --force   # regenerate everything

Outputs: images/og/default.png, images/og/articles/<slug>.png, images/og/briefing/<date>.png.
build-og.js falls back to default.png when a card is missing, so a new post is never
left without a preview; run this script when publishing to give it its own card.
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, 'scripts', 'fonts')
W, H = 1200, 630
BG, TEXT, MUTED, ACCENT, LINE = '#0B0F17', '#EEF0F4', '#9AA3B4', '#DD4E1E', '#232838'

def serif(size, weight='SemiBold'):
    f = ImageFont.truetype(os.path.join(FONTS, 'Newsreader.ttf'), size)
    try: f.set_variation_by_name(weight)
    except Exception: pass
    return f

def mono(size):
    return ImageFont.truetype(os.path.join(FONTS, 'IBMPlexMono-Medium.ttf'), size)

def wrap(draw, text, font, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=font) <= width: cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

def base():
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 10], fill=ACCENT)
    d.ellipse([72, 70, 100, 98], fill=ACCENT)
    d.text((118, 84), 'AWHIND', font=mono(30), fill=TEXT, anchor='lm')
    d.text((W - 72, 84), 'awhind.com', font=mono(24), fill=MUTED, anchor='rm')
    d.line([72, H - 96, W - 72, H - 96], fill=LINE, width=2)
    return im, d

def card(title, label, out):
    im, d = base()
    d.text((72, 160), label.upper(), font=mono(24), fill=ACCENT)
    for size in (68, 60, 52, 46, 40):
        f = serif(size)
        lines = wrap(d, title, f, W - 144)
        if len(lines) <= 4: break
    lines = lines[:4]
    if len(wrap(d, title, f, W - 144)) > 4: lines[-1] = lines[-1].rstrip('.,;: ') + '…'
    y, lh = 210, int(size * 1.18)
    for ln in lines:
        d.text((72, y), ln, font=f, fill=TEXT); y += lh
    d.text((72, H - 52), 'AWH Industries · Practical AI and IT for small teams', font=mono(22), fill=MUTED, anchor='lm')
    save(im, out)

def default(out):
    im, d = base()
    d.text((72, 250), 'AWH Industries', font=serif(96), fill=TEXT)
    d.text((72, 370), 'Practical AI, IT security and daily briefings', font=serif(44, 'Medium'), fill=MUTED)
    d.text((72, H - 52), 'awhind.com', font=mono(22), fill=ACCENT, anchor='lm')
    save(im, out)

def save(im, out):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.quantize(colors=128, method=Image.Quantize.FASTOCTREE).save(out, 'PNG', optimize=True)

def main():
    force = '--force' in sys.argv
    og = os.path.join(ROOT, 'images', 'og')
    p = os.path.join(og, 'default.png')
    if force or not os.path.exists(p): default(p)
    for a in json.load(open(os.path.join(ROOT, 'content', 'articles.json'))):
        p = os.path.join(og, 'articles', a['slug'] + '.png')
        if force or not os.path.exists(p): card(a['title'], 'Article', p)
    for b in json.load(open(os.path.join(ROOT, 'posts.json'))):
        p = os.path.join(og, 'briefing', b['date'] + '.png')
        if force or not os.path.exists(p): card(b['title'], 'Briefing · ' + b['date'], p)

if __name__ == '__main__':
    main()
