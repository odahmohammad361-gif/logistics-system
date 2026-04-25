# SKILL — Logistics Design System

Use this skill when designing any surface for the Logistics product family (admin, shop, or operator tools).

## Always do

1. **Import the tokens.** Every HTML file must start with:
   ```html
   <link rel="stylesheet" href="/colors_and_type.css">
   ```
   Use CSS variables (`var(--primary)`, `var(--card)`, `var(--fg-2)`, etc.) — never hard-code colors that exist as tokens.

2. **Stay dark.** Backgrounds are the 6-step navy ramp; do not introduce light surfaces. Page bg is always `var(--bg)`. The closest thing to a "light" surface is `var(--card) #0A1929`.

3. **Pair card shadows with an inset highlight.** Use `var(--shadow-card)` (= drop + `inset 0 1px 0 rgba(255,255,255,.04)`). The inset top-edge is what gives cards depth on dark.

4. **Tabular numerals on every number that sits in a column or stat.** `font-variant-numeric: tabular-nums;` or the `.tabular` utility.

5. **Status earns its color.** Use the status palette only for actual status (badges, KPI icons, table cells). Don't use `--success` as a generic "positive" decoration.

6. **Bilingual.** Latin uses Inter; Arabic uses Cairo. The `--font-ui` stack falls back automatically. For RTL blocks set `dir="rtl"` on the container — `html[dir="rtl"]` already swaps to Cairo.

7. **Lucide icons, 1.75 stroke.** Sizes: 14 in buttons, 16–18 in topbar/inputs, 18 in sidebar, 20–22 in tinted KPI cards.

## Component recipes (copy these, don't reinvent)

### Status pill (universal)
```css
background: rgba(STATUS, .15);
color: STATUS-300;     /* a 300-level tint of the same hue */
border: 1px solid rgba(STATUS, .25);
padding: 3px 9px; border-radius: 9999px;
font-size: 11px; font-weight: 600;
```

### KPI tile
```html
<div class="kpi">
  <div class="kpi-head">
    <div class="kpi-icon green"><i data-lucide="users"></i></div>
    <span class="trend up">+12%</span>
  </div>
  <p class="kpi-label">Active clients</p>
  <p class="kpi-value">2,847</p>
</div>
```
Tinted icon background = `rgba(STATUS,.12)` + `box-shadow: 0 0 16px rgba(STATUS,.18)`. Numeral is 30/900 tabular, label is 11/600 uppercase.

### Sidebar nav item (active state)
```css
background: var(--primary-soft);
color: #A5B4FC;
box-shadow: inset 2px 0 0 var(--primary);   /* ← left bar = active marker */
```

### Form input (focus)
```css
border-color: var(--primary);
box-shadow: var(--focus-ring);   /* 0 0 0 3px rgba(primary,.15) */
```

### Brand mark
```css
background: var(--brand-gradient);              /* indigo→indigo-light */
box-shadow: 0 0 16px var(--primary-glow);
```

## Theme switching

Set `data-accent` on `<html>` (or any container) to retheme:
```html
<html data-accent="emerald">
```
Available: `purple`, `emerald`, `rose`, `amber`, `cyan`, `blue`, `teal`. Default (no attribute) is indigo.

## Voice

- **Admin** copy: terse, present tense. No periods on UI labels. "Container created" not "The container was created successfully."
- **Shop** copy: warm, Arabic-first when speaking to end-customers.
- Currency: `$4,820.00` (symbol prefix for USD), `3,418 JOD` (code suffix for JOD/IQD).
- Never write filler. Empty states get one line + a single primary action — never lorem-ipsum body copy.

## Don't

- ❌ Don't use multiple accent colors in one screen — the product has **one** accent at a time.
- ❌ Don't use gradient backgrounds for content surfaces. The brand-mark is the only gradient surface; everything else is solid.
- ❌ Don't put status colors on chrome (buttons, borders, dividers) unless they are reporting status.
- ❌ Don't use Tailwind utility classes that conflict with these tokens — this system is hand-written CSS.
- ❌ Don't draw your own SVG illustrations. Use Lucide icons; if you need imagery, add a placeholder and ask.

## When in doubt

Open `ui-kit/admin-dashboard.html` and copy the pattern. It demonstrates the sidebar, topbar, KPI grid, FX widget, table, badges, and activity feed in a single canonical layout.
