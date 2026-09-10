# La Dolce Vita — campaign sources

The public homepage follows the six DAMAI campaign boards supplied by the owner on 8–9 September 2026. The original files stay intact and scale proportionally. Board lettering stays in the artwork; section headings, navigation and the working registration form are HTML.

## Original DAMAI logo

`public/damai/logo-original.svg` is exported directly from **LLAA.pdf** supplied by the owner as the official DAMAI logo. The PDF title is `Logo_Damai New`; its artwork contains the circular symbol, DAMAI lettering and EVENT GARDEN descriptor, all as vector paths. Poppler converts those paths without redrawing them. Only the SVG viewport is tightened to `78 424 924 232`, retaining clear space around the complete mark and a transparent background. The original black is preserved.

The header and footer use this SVG at its intrinsic aspect ratio instead of typesetting DAMAI. The six campaign boards remain intact, including their embedded branding. Source PDF SHA-256: `7e3cb3c195161a5023f014cbd85b05cf3de8f692655aa69c50823f73b54d48ec`.

## Original La Dolce Vita logo

`public/damai/ldv/logo-original.svg` is a vector conversion of **Logo - LDV - Nero.pdf**, from the owner's Google Drive **LA DOLCE VITA** folder (file ID `16POcvDjWcdnz1OEicRNKS_d4e5Ws4oTD`). Poppler exported the original paths; only the SVG viewport was tightened around the artwork. This source and its blue CSS-mask treatment remain available. The current boards already contain the original logo, so no separate logo or recreated lettering is overlaid on them.

## Earlier source assets retained

| Website source | Owner's original file | Use |
| --- | --- | --- |
| `invitation-original.png` | Damai - LDV - 01.png | Full-bleed header poster: background, text and ornaments stay on one continuous image plane |
| `experience-original.png` | Damai - LDV - 02.png | Landscape on the left of the experience section |
| `dedicated-original.png` | Damai - LDV - 05.png | Coastal panorama below “Dedicato a te” |
| `up-frame.png` | Up Frame.png, LA DOLCE VITA on Drive | Blue and gold maiolica trim |
| `lemons-02.png` | Lemons02.png, LA DOLCE VITA on Drive | Lemon branches in the invitation corners |

The homepage serves all six complete JPEG boards in `public/damai/ldv/boards/` through Next Image. Their backgrounds, logos, text and ornaments stay on a single image plane. Registration is reached from the navigation and the dedicated live form below. The wider site background remains `#e7dcce`; the boards keep their original cream `#f8f0e3`.

## Chapter transitions

Each board is a complete invitation page. A 48–88 px paper interlude, with a short fine blue rule, separates adjacent artworks. The interlude is a normal-flow pseudo-element on the next section: there are no negative margins, image masks, fades, transforms, cropping or overlapping layers. Logos and ornamented edges remain fully visible. The closing board follows the form's existing bottom spacing without adding a second gap. Anchor scrolling remains smooth and respects reduced-motion preferences. This is deliberate editorial separation, not an attempt to splice different illustrations into one scene.

The first board has a centered “Registrati” link immediately below the intact artwork. It uses the existing blue and cream button treatment, serif lettering and a fine gold border, with a minimum 56 px touch target at the default font size. Its native `#registrazione-form` anchor works without JavaScript; the form wrapper accepts keyboard focus. This action replaces the first paper divider so spacing is not doubled. The other board transitions remain unchanged.

## Typography

Didot is the first choice in the display font stack. No installable Didot font was found among the supplied files or in the named Drive folder. On devices without Didot, the page uses the bundled, SIL OFL licensed **Bodoni Moda** as a Didone fallback, rather than relying on a device's default serif. Source: https://github.com/google/fonts/tree/main/ofl/bodonimoda. The original license accompanies the font. This fallback is not represented as an original Didot font.

The supplied Ballstomer font remains available for supporting script text. The “La Dolce Vita” brand stays as supplied in the original boards, not as retyped script text.

## Scope

The redesign is confined to the public homepage and its scoped stylesheet. Form additions associate labels with fields, link the privacy notice, announce errors and expose slot selection to assistive technology. Registration submission, capacity rules, the QR pass and staff routes keep their existing implementation.
