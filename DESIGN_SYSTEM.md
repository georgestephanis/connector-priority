# Connector Priority — Design System

This document is the source of truth for visual decisions in the Connector
Priority plugin. It's written to be picked up by both humans and other agents
without losing fidelity. Every color, size, and rule below has a single
canonical form — use it verbatim.

> **Foundation.** Connector Priority lives inside the WordPress 7.0 admin.
> Wherever possible it inherits from WordPress core admin styles. The plugin
> owns exactly one thing: the rank-ordered list metaphor. Everything else
> should look like it was always part of the admin.

---

## 1 · Brand mark

**Concept.** Three stacked priority rows. The top row is the active
connector — filled with the accent, badged "1". Rows 2 and 3 are queued —
neutral surface, rank badge, mid-length faux content bar.

**Why this works at small sizes.** The accented top row gives the icon a
strong horizontal hit even at 64×64 (the in-admin render size). The grip
dots and rank bubble are decorative at small sizes but read as "list" at
larger ones, which is exactly the plugin's metaphor.

**Files.**

| File                          | Size       | Use |
|-------------------------------|------------|-----|
| `icon.svg`                    | viewBox 256 | Master · edit this when refining |
| `icon-256x256.png`            | 256×256    | `assets/icon-256x256.png` for the WP plugin directory |
| `icon-128x128.png`            | 128×128    | `assets/icon-128x128.png` fallback |
| `banner.svg`                  | viewBox 772×250 | Master · edit this when refining |
| `banner-772x250.png`          | 772×250    | `assets/banner-772x250.png` for the WP plugin directory |
| `banner-1544x500.png`         | 1544×500   | `assets/banner-1544x500.png` retina |

**Corner radius.** A `46px` (≈18% of 256) radius is baked into `icon.svg`'s
plate. Don't add a CSS corner mask on top — it'll fight the platform mask
and make the icon look mushy on tinted backgrounds.

---

## 2 · Color tokens

All colors are sourced from WordPress core admin. Use WP core CSS variables
directly at point of use — there is no plugin-level token layer.

**Accent (use `--wp-admin-theme-color*` — these automatically follow the
active admin color scheme):**

| Purpose       | Property to use                              | Default fallback |
|---------------|----------------------------------------------|-----------------|
| Accent        | `var(--wp-admin-theme-color, #2271b1)`        | `#2271b1`       |
| Accent hover  | `var(--wp-admin-theme-color-darker-10, #135e96)` | `#135e96`    |
| Accent dark   | `var(--wp-admin-theme-color-darker-20, #0a4b78)` | `#0a4b78`    |

**All other values — no WP core CSS variable exists; use the raw hex
constant (these match WP admin's compiled Sass):**

| Purpose            | Value      |
|--------------------|------------|
| Primary text       | `#1d2327`  |
| Heading text       | `#2c3338`  |
| Muted / secondary  | `#50575e`  |
| Card / row surface | `#fff`     |
| Page canvas        | `#f0f0f1`  |
| Alt-row / inset    | `#f6f7f7`  |
| Input border       | `#c3c4c7`  |
| Inner separator    | `#dcdcde`  |
| Active             | `#00a32a`  |
| Rate-limited       | `#dba617`  |
| Offline / error    | `#d63638`  |

---

## 3 · Typography

Use the WordPress admin system stack — never load a webfont.

```css
--cp-font: -apple-system, BlinkMacSystemFont, "Segoe UI Adjusted",
           "Segoe UI", "Liberation Sans", sans-serif;
--cp-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo,
                Consolas, monospace;
```

### Scale

| Token          | Size / Weight | Line-height | Letter-spacing | Use |
|----------------|---------------|-------------|----------------|-----|
| `display`      | 44 / 700      | 1.05        | -0.02em        | Banner wordmark only |
| `page-title`   | 32 / 600      | 1.2         | -0.02em        | Plugin settings page H1 |
| `section`      | 21 / 600      | 1.3         | -0.01em        | Group headers within settings |
| `card-title`   | 16 / 600      | 1.4         | 0              | Each connector row |
| `body`         | 13 / 400      | 1.5         | 0              | Default copy |
| `caption`      | 12 / 400      | 1.45        | 0              | Status, helper text |
| `eyebrow`      | 11 / 700      | 1           | 0.16em uppercase | Section labels in docs |
| `code`         | 12 / 400      | 1.5         | 0              | `--cp-font-mono` |

---

## 4 · Spacing & geometry

| Token         | Value | Use |
|---------------|-------|-----|
| `--cp-space-1` | 4px  | Hairline gaps inside compact controls |
| `--cp-space-2` | 8px  | Default row gap in vertical stacks |
| `--cp-space-3` | 12px | Card internal gap |
| `--cp-space-4` | 16px | Padding inside cards/rows |
| `--cp-space-5` | 24px | Section break |
| `--cp-space-6` | 32px | Page-level rhythm |
| `--cp-radius-1` | 3px | Buttons, inputs (WP-core default) |
| `--cp-radius-2` | 4px | Cards |
| `--cp-radius-3` | 6px | Connector rows |
| `--cp-stroke`   | 1px | All borders. **Never** thicker. |
| `--cp-stroke-2` | 1.5px | Icon strokes only |

**Focus ring.** Match WP-core exactly:
`box-shadow: 0 0 0 1px #fff, 0 0 0 3px var(--wp-admin-theme-color, #2271b1);`
Never substitute a different ring style.

---

## 5 · Components

### 5.1 Connector row

The plugin's defining component. One row per registered connector,
draggable to reorder.

```
┌─────────────────────────────────────────────────────────┐
│ ⋮⋮  (1)  Claude · anthropic           [● Active]  [⚙]  │   ← active
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ ⋮⋮  (2)  GPT-4o · openai              [● Ready]   [⚙]  │
└─────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Height (default) | 56px |
| Padding | 12px 16px |
| Gap between rows | 8px |
| Radius | 6px |
| Border | `1px solid #dcdcde` |
| Active background | `var(--wp-admin-theme-color, #2271b1)` with `color: #fff` |
| Active border | `1px solid var(--wp-admin-theme-color-darker-20, #0a4b78)` |
| Active shadow | `0 6px 18px rgba(var(--wp-admin-theme-color--rgb), 0.22)` |
| Active lift | `transform: translateX(-6px)` |
| Hover (inactive) | `border-color: #c3c4c7` |
| Drag handle | `⋮⋮` glyph at 60% opacity |
| Rank badge | 22×22 circle, weight 700, size 12 |

### 5.2 Rank badge

- **Active row:** circle fill `rgba(255,255,255,0.18)`, stroke
  `rgba(255,255,255,0.5)`, text `#fff`.
- **Inactive row:** circle fill `#f0f0f1`, stroke `#c3c4c7`, text `#50575e`.

### 5.3 Buttons

Use WP-core primary/secondary patterns verbatim — don't restyle.
`.button-primary` for the only-one-on-screen action ("Save priority").
`.button` for everything else.

### 5.4 Status pill

For per-connector state. Always paired with a colored dot.

| State | Dot color | Label |
|-------|-----------|-------|
| Active | `#00a32a` | "Active" |
| Ready | `#50575e` | "Ready" |
| Rate-limited | `#dba617` | "Rate-limited" |
| Offline | `#d63638` | "Offline" |

Status colors **never** indicate priority — that's blue+number's job.

---

## 6 · Principles

These are the rules the design enforces. When in doubt, fall back to them.

1. **Native first.** The plugin should be indistinguishable from WP-core
   chrome at first glance. Borrow tokens, radii, and density. Only the
   icon and banner are allowed to feel a little more "branded."

2. **One accent.** Reserve `var(--wp-admin-theme-color)` for "the prioritized
   thing." Every other rank uses neutral surfaces. The whole UI should feel
   like a sorted list, not a rainbow.

3. **Rank, never score.** Show ordinal position (1 / 2 / 3) — never
   percentages, weights, or stars. The plugin manages an order, not a
   measurement.

4. **Type is the brand.** Beyond the chosen icon mark, there is no
   custom typography. Banner title set tight (-0.02em). All admin copy
   stays in the WP system stack at native admin sizes.

5. **Status, sparingly.** Green / orange / red mean *operational state*,
   not *priority*. Don't reach for them to indicate ordering.

6. **No emoji, no gradients, no shadows that aren't WP-core.** This is a
   WordPress admin plugin, not a SaaS marketing page.

---

## 7 · Asset spec sheet

| Asset | Dimensions | Format | Notes |
|-------|------------|--------|-------|
| Icon — directory | 256×256 | PNG (sRGB, 8-bit) | `assets/icon-256x256.png` |
| Icon — fallback  | 128×128 | PNG | `assets/icon-128x128.png` |
| Banner — low-res | 772×250 | PNG | `assets/banner-772x250.png` |
| Banner — high-res| 1544×500 | PNG | `assets/banner-1544x500.png` |
| Master icon      | viewBox 256 | SVG | `icon.svg` — single source |
| Master banner    | viewBox 772×250 | SVG | `banner.svg` — single source |

**Safe area on the banner:** keep all type ≥ 32px from the edges; the
WordPress plugin directory may crop responsively.

**Re-rasterizing.** If you edit the SVG masters, regenerate the PNGs by
loading the SVG into a 1:1 canvas and exporting (no upscaling — both
master SVGs are already at native resolution). For the retina banner,
use a 2× canvas.

---

## 8 · For future agents

If you're adding new UI:

- **Start in `icon.svg` / `banner.svg`** if the change is to the brand
  mark. Don't fork a new asset.
- **No plugin token layer.** Use `--wp-admin-theme-color*` for accent,
  raw hex for everything else. Values are in §2 / §4.
- **Use the connector row pattern (§5.1) for any sortable list.** Don't
  invent a second list visual.
- **Stay within the WordPress admin's information density.** If a new
  component feels roomier than WP-core defaults, it's wrong — tighten it.
- **Match `wp-admin/css/common.css`'s focus styles** rather than rolling
  your own.

When in doubt, open the WordPress admin in another tab and copy what's
already there.
