/**
 * Vanilla DOM AdSense / Inkfinity Studio promo banner helper.
 * Renders an AdSense display unit if adSlotId is provided, otherwise a compact Inkfinity Studio promo bar.
 */

const PROMOS = {
  top: {
    badge: 'INKFINITY STUDIO',
    text: 'Turn photos into heirloom 8K 3D printed miniatures — free pan-India shipping',
    cta: 'Shop Now ↗',
    href: 'https://inkfinitystudio.store',
    bg: '#ffe0ea',
  },
  bottom: {
    badge: 'CUSTOM GIFTS',
    text: 'Anniversary couple figurines & pet miniatures with 5 digital sculpt revisions',
    cta: 'Explore ↗',
    href: 'https://inkfinitystudio.store/shop',
    bg: '#ffd875',
  },
};

export function createAdBanner(position = 'bottom', adSlotId = '') {
  const promo = PROMOS[position] ?? PROMOS.bottom;
  const aside = document.createElement('aside');
  aside.className = `dta-ad-banner dta-ad-${position}`;
  aside.setAttribute('aria-label', position === 'top' ? 'Top Banner' : 'Bottom Banner');
  aside.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'width:100%',
    'min-height:40px',
    'padding:4px 10px',
    `background:${promo.bg}`,
    'color:#1e1b18',
    'font-size:12px',
    'font-weight:700',
    'border-radius:10px',
    'margin-top:8px',
    'box-sizing:border-box',
  ].join(';');

  if (adSlotId) {
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.cssText = 'display:block;width:100%;max-width:728px;height:50px;';
    ins.dataset.adClient = 'ca-pub-9649669731732434';
    ins.dataset.adSlot = adSlotId;
    ins.dataset.adFormat = 'horizontal';
    ins.dataset.fullWidthResponsive = 'true';
    aside.appendChild(ins);
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // Ignore AdSense push errors when ad script is blocked.
    }
  } else {
    const link = document.createElement('a');
    link.href = promo.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;color:inherit;text-decoration:none;';
    link.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><strong>${promo.badge}</strong> · ${promo.text}</span><span style="flex-shrink:0;background:#fff;padding:2px 8px;border-radius:999px;font-size:10px;">${promo.cta}</span>`;
    aside.appendChild(link);
  }

  return aside;
}
