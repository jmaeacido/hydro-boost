# Hydro Boost

A single-page marketing site for **Hydro Boost** — electrolyte gummies built for athletes who want rapid hydration without mixing powders or carrying bottles.

**Live repo:** [github.com/jmaeacido/hydro-boost](https://github.com/jmaeacido/hydro-boost)

## Features

- Hero section with animated product showcase and scroll-driven stats
- Use-case cards for gym, running, and cycling (Font Awesome + Lottie animations)
- Product comparison, benefits, and interactive formula breakdown
- Hydration calculator with animated gauge and gummy serving suggestions
- Auto-rotating customer review carousel
- Subscribe & save pricing tiers and FAQ accordion
- Magnetic CTA buttons, scroll reveals, and reduced-motion support

## Tech Stack

- **HTML5** — semantic, accessible markup
- **CSS3** — custom properties, grid/flex layouts, scroll animations
- **Vanilla JavaScript** — no build step or framework
- [Lottie Web](https://github.com/airbnb/lottie-web) — animated sport icons
- [Font Awesome](https://fontawesome.com/) — iconography
- [Google Fonts](https://fonts.google.com/) — Barlow & Bebas Neue

## Project Structure

```
hydro-boost/
├── index.html          # Main landing page
├── styles.css          # Global styles and animations
├── app.js              # Interactions (calculator, reviews, Lottie, etc.)
├── assets/             # Images, Lottie JSON, SVG assets
└── scripts/            # PowerShell helpers for asset discovery
```

## Getting Started

No install or build step required. Open the page in a browser:

```powershell
# Option 1: open directly
start index.html

# Option 2: serve locally (if you have Python)
python -m http.server 8080
# then visit http://localhost:8080
```

With [Laragon](https://laragon.org/), the site is typically available at:

```
http://localhost/hydro-boost/
```

## Development Scripts

The `scripts/` folder contains PowerShell utilities for scanning and testing Lottie/Lordicon assets during development:

| Script | Purpose |
|--------|---------|
| `scan-sport.ps1` | Scan sport-related Lottie assets |
| `scan-lordicon.ps1` | Scan Lordicon animation files |
| `find-lordicon.ps1` | Locate Lordicon assets |
| `503-run.html` | Local test page for run animation |

## Browser Support

Works in all modern browsers that support CSS custom properties, `IntersectionObserver`, and ES6+ JavaScript.

---

© 2026 Native Ceuticals
