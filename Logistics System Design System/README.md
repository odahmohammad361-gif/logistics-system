# Logistics Design System

The visual language for a Jordan-based shipping platform that moves goods between China, Jordan, and Iraq.

**Browse:** open [`README.html`](./README.html) for the live index, or [`ui-kit/admin-dashboard.html`](./ui-kit/admin-dashboard.html) for a composed example.

---

## Quick start

Every product surface starts the same way:

```html
<link rel="stylesheet" href="/colors_and_type.css">
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
<body>
  <!-- ... -->
  <script>lucide.createIcons();</script>
</body>
```

That's it. All tokens (color, type, spacing, radii, shadows, motion) live in `colors_and_type.css`. Icons are Lucide. There is no Tailwind, no component framework — just tokens + CSS classes you copy from `ui-kit/`.

---

## Operating principle

> Backgrounds stay constant. Accents swap. Status earns its color. Everything else gets out of the way.

Shipping operators look at this product all day. The system favors deep navy backgrounds, three-tier dim text, and one bright accent — so the screen never shouts back.

---

## Foundations

### Color
- **Backgrounds (6-step navy ramp):** `--bg #030B18` → `--sidebar #040D1A` → `--surface #061220` → `--card #0A1929` → `--navy #1A2744` → `--navy-lt #243460`. These never change between accent themes.
- **Accent (default Indigo):** `--primary #6366F1`, `--primary-dark #4F46E5`, `--primary-light #818CF8`, plus `--primary-soft` (12% tint) and `--primary-glow` (35% halo). Override these five vars on `[data-accent="purple"|"emerald"|"rose"|"amber"|"cyan"|"blue"|"teal"]` to retheme the whole product.
- **Status:** success `#10B981` (paid/delivered) · info `#3B82F6` (sent/in_transit) · warning `#F59E0B` (booking) · purple `#8B5CF6` (arrived) · danger `#EF4444` (cancelled) · orange `#F97316` (expired).
- **Text:** `--fg-1 #F1F5F9` primary · `--fg-2 #94A3B8` secondary · `--fg-3 #64748B` labels.
- **Borders:** `--border #1E3A5F` resting · `--border-light #2A4F7A` hover.

### Typography
- **Inter** for Latin UI body. **Cairo** for Arabic + display. Both via Google Fonts in `colors_and_type.css`.
- Heavy weights (700/900) for headings, tight letter-spacing (-0.02em). Body 14/500. Eyebrows 10/600 uppercase wide-tracked. Stat numerals always `font-variant-numeric: tabular-nums`.
- Scale: Display 48 · H1 30 · H2 24 · Page-title 20 · Body 14 · Caption 12 · Eyebrow 10.

### Spacing & shape
- 4px-rooted scale: `--space-1` 4 → `--space-8` 32. Card padding default 20, panel 32, page horizontal 28.
- Radii: `--radius-sm` 6 (tiny pills) · `--radius-lg` 8 (buttons/inputs) · `--radius-xl` 12 (cards/badges) · `--radius-2xl` 16 (panels) · `--radius-full` (pills).
- Shadows always pair an outer drop with an inset 1px highlight (`inset 0 1px 0 rgba(255,255,255,.04)`) — that's what gives cards their crisp top-edge on dark.

---

## Components

| Component | Recipe |
|---|---|
| **Button** | `padding: 8px 16px; border-radius: 8px; font-weight: 500; font-size: 13px;` Primary = solid `--primary`. Secondary = `rgba(255,255,255,.05)` + `--border`. Danger = `rgba(239,68,68,.1)` + `rgba(239,68,68,.3)` border. |
| **Status pill** | `padding: 3px 9px; border-radius: 9999px; font-size: 11px; font-weight: 600;` Universal recipe: `background: rgba(STATUS,.15); color: STATUS-200; border: 1px solid rgba(STATUS,.25);` |
| **Input** | `background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px;` Focus → `border-color: var(--primary); box-shadow: var(--focus-ring);` |
| **Card** | `background: var(--card); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-card);` |
| **KPI tile** | Card + 40×40 tinted icon (status-colored, 12% bg, 16px glow) + 11/600 uppercase label + 30/900 tabular numeral + optional trend chip. |
| **Sidebar nav item** | `padding: 10px 14px; border-radius: 8px; font-size: 13px;` Active = `background: var(--primary-soft); color: #A5B4FC; box-shadow: inset 2px 0 0 var(--primary);` |
| **Table row** | 12px vertical pad, `border-bottom: 1px solid rgba(30,58,95,.5)`, hover `background: rgba(99,102,241,.04)`. Header row uses `--surface` bg + 10/600 uppercase column labels. |

---

## Iconography

**Lucide**, stroke 1.75, sized 14–22px:
- 14px inside button
- 16–18px in inputs and topbar
- 18px in sidebar nav
- 20–22px inside tinted KPI/feature card

For tinted icon cards, match the icon color to status semantics and apply both a 12% background tint and a `0 0 16px` outer glow at the same hue.

---

## Brand marks

Two SVG marks in `/assets`:
- `logo-admin.svg` — gradient "L" glyph for the admin product
- `logo-shop.svg` — shopping-bag glyph for the customer-facing shop

Both use the same `linear-gradient(135deg, #6366F1, #818CF8)` fill so they re-skin automatically when the accent theme changes.

---

## Voice & locale

- **Admin:** terse, present tense. "Container created." "12 clients selected." "Invoice not sent."
- **Shop:** warm, customer-facing, Arabic-first.
- Currency: `$4,820.00` / `3,418 JOD` — symbol-prefixed for USD, code-suffixed for JOD/IQD.
- Date: `24 Apr 2026`. Phone: `+962 79 XXX XXXX`.
- Tabular numerals everywhere a number sits in a column or stat.

---

## Files

```
colors_and_type.css         # All tokens — import this everywhere
README.html                 # Live design-system index (start here)
README.md                   # This file
SKILL.md                    # Instructions for AI agents using the system
assets/                     # SVG logos
preview/                    # Per-token preview cards (registered in asset review)
ui-kit/
  admin-dashboard.html      # Composed full-screen example
```
