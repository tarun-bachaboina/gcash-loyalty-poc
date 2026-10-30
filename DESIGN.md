---
name: GCash × Ayala Malls Loyalty
description: Mall loyalty on GCash. Navy hero zones lit by GCash's pay-wave arcs, calm slate working surfaces, and gold reserved for points.
colors:
  gcash-blue: "#005ce6"
  brand-strong: "#003c96"
  brand-soft: "#e5f1ff"
  on-brand: "#ffffff"
  accent-sky: "#00a3ff"
  accent-strong: "#0086d1"
  merchant-navy: "#0a192f"
  console-slate: "#1e293b"
  on-chrome-muted: "#b9c6d8"
  hero-navy: "#01245c"
  hero-deep: "#04142d"
  on-space: "#ffffff"
  on-space-muted: "#adbddc"
  wave-bright: "#007cff"
  wave-light: "#6fbefb"
  on-space-success: "#6ee7b7"
  on-space-danger: "#ffa8a8"
  cream: "#fcf6eb"
  ice: "#e7f6fe"
  gold-100: "#fff4d6"
  gold-300: "#ffd56b"
  gold-500: "#f2b21b"
  gold-600: "#b88200"
  gold-700: "#8a5d00"
  success-100: "#d1fae5"
  success-500: "#10b981"
  success-600: "#059669"
  success-700: "#047857"
  danger-100: "#f8e6e6"
  danger-500: "#d61b2c"
  danger-700: "#b50707"
  promo-100: "#fff0e5"
  promo-500: "#ff6b00"
  promo-700: "#aa3e09"
  surface-0: "#f4f7fa"
  surface-1: "#ffffff"
  surface-2: "#eef2f9"
  text-1: "#0a2757"
  text-2: "#445c85"
  line: "#d7e0ef"
typography:
  display:
    fontFamily: "Manrope Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(2.25rem, 11vw, 3rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Manrope Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Manrope Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.45
  label:
    fontFamily: "Manrope Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.3
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 600
    letterSpacing: "0.05em"
rounded:
  chip: "8px"
  card: "12px"
  hero: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.gcash-blue}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.brand-strong}"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.gcash-blue}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.brand-soft}"
  button-ghost:
    textColor: "{colors.gcash-blue}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  button-inverse:
    textColor: "{colors.on-space}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  tabs:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.pill}"
    padding: "4px"
  tab-selected:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.gcash-blue}"
    rounded: "{rounded.pill}"
    height: "40px"
  input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text-1}"
    rounded: "{rounded.chip}"
    padding: "0 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.card}"
    padding: "16px"
  hero-panel:
    backgroundColor: "{colors.hero-navy}"
    textColor: "{colors.on-space}"
    rounded: "{rounded.hero}"
    padding: "20px"
  badge-ready:
    backgroundColor: "{colors.gold-500}"
    textColor: "{colors.hero-deep}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
  promo-badge:
    backgroundColor: "{colors.promo-100}"
    textColor: "{colors.promo-700}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
---

# Design System: GCash × Ayala Malls Loyalty

## Overview

**Creative North Star: "Pay-wave light"**

Every screen has one hero zone: a GCash navy panel that deepens from `hero-navy` to `hero-deep`. Its only light
source is the pay-wave arcs from the GCash logo, three concentric strokes on the right edge. That panel holds
the thing the person came for: a points balance, a membership card, a reward on display, a receipt total.
Everything around it is a calm working surface in GCash's blue-tinted slates, where lists, forms, tables and the
member QR stay quiet and fast to scan. The futuristic feel comes from precision rather than decoration: crisp
layered blues, exact tabular numbers, flat brand-blue controls, and motion that happens once, for a reason.

Gold is earned. It appears only on points and rewards: the GCash coin, progress toward a reward, the "Ready to
claim" badge, and the reward moment. Components are confident and tactile: flat GCash-blue pill buttons press
in on tap, and cards lift slightly on hover. Celebration scales by surface: high on the customer app (one pay-wave
ripple per flow, light confetti in GCash colours), medium for cashiers (a single check pop), and none on the
admin console.

The system rejects generic AI fintech styling: no aurora blobs, glass blur, glow, dot grids, gradient text,
starfields or mono uppercase eyebrows. Light and dark mode come from `light-dark()` tokens. Hero zones stay dark
in both themes, because they are objects, not chrome.

**Key Characteristics:**
- One hero zone per screen, on GCash navy, lit only by the pay-wave arcs.
- Flat GCash blue (`#005CE6`, hover `#003C96`) for every primary action and header.
- Gold is reserved for points and rewards. The coin is the one gradient object.
- Manrope only. Numbers are weight 800 with tight tracking and tabular figures.
- Navy-tinted slates for text and neutrals, never pure grey.
- Motion is one-shot and purposeful, with a reduced-motion fallback everywhere.

## Colors

GCash blue carries action, gold carries value, navy carries the hero, and the neutrals keep GCash's cool blue
cast. Frontmatter hex values are light mode; each themed token has a dark pair in `packages/ui/tokens.css`.

### Primary
- **GCash Blue** (`gcash-blue`): primary buttons, links, the selected tab, focus rings on light surfaces, and the
  customer header. White text on it is 5.7:1. In dark mode the brand token lifts to `#5a9bff`, with dark text.
- **GCash Hover Blue** (`brand-strong`): hover and pressed state of primary actions. This is GCash's own hover
  colour.
- **Blue Mist** (`brand-soft`): hover wash behind secondary and ghost buttons, and text selection.

### Secondary
- **Hero Navy → Hero Deep** (`hero-navy`, `hero-deep`): the background of hero zones, as a 160° tonal deepening.
  Text on it is `on-space` (14.9:1) or `on-space-muted` (7.9:1).
- **Wave Bright / Wave Light** (`wave-bright`, `wave-light`): the logo blues. They are used for pay-wave arcs and
  the ripple. On light surfaces `wave-bright` is for large text or fills only (3.9:1).
- **Chrome Navy / Console Slate** (`merchant-navy`, `console-slate`): merchant/POS and admin headers (PRD 4.2,
  5.2). Muted chrome text is `on-chrome-muted`.

### Tertiary
- **Reward Gold** (`gold-500` fill, `gold-600` strokes, `gold-700` text, `gold-300` on navy, `gold-100` wash): the
  coin, progress arcs and bars, the affordable-reward ring, and the voucher stub strip.
- **Promo Orange** (`promo-700` text on `promo-100`, `promo-500` fill): GCash's orange family, for promos and
  multipliers only.
- **Emerald** (`success-*`): valid, redeemed and active states, and admin KPIs (PRD emerald). On navy, earn amounts
  use `on-space-success`.
- **GCash Red** (`danger-500` icons, `danger-700` text on `danger-100`): invalid, expired and errors. On navy,
  burn amounts use `on-space-danger`.

### Neutral
- **Mall Mist** (`surface-0`): app background (PRD "Background Light").
- **Card White** (`surface-1`): cards, inputs, the selected tab, the QR card.
- **Quiet Panel** (`surface-2`): tab track, read-only fields, disabled fills, skeletons.
- **GCash Ink** (`text-1`): primary text, GCash's own text colour.
- **GCash Slate** (`text-2`): secondary text and unselected tabs (6.0:1 on Quiet Panel).
- **Hairline** (`line`): 1px rings around cards, inputs and secondary buttons.
- **Cream / Ice** (`cream`, `ice`): GCash's warm and cool tints, available for editorial surfaces.

### Named Rules
**The Earned Gold Rule.** Gold appears only on points and rewards. Never on generic buttons, navigation or
headings.

**The Fill-Only Rule.** `gold-500`, `success-500`, `promo-500`, `accent-sky` and `wave-bright` (on light) fail
4.5:1 on white. Use them for fills and graphics, and their 600/700 steps for text.

## Typography

**Display Font:** Manrope Variable (fallback: system-ui, Segoe UI)
**Body Font:** Manrope Variable
**Label/Mono Font:** the system monospace stack, for real codes only (voucher serials, member IDs, cart IDs)

**Character:** one geometric, friendly family, the closest free match to GCash's Gilroy. Hierarchy comes from
weight (800 for display, 500 for body) and tight tracking on big numbers, not from a second typeface.

### Hierarchy
- **Display** (800, clamp(2.25rem, 11vw, 3rem), 1, −0.025em, tabular): the points balance in the hero. It is
  clamped so a 7-digit balance fits at 360px.
- **Headline** (800, 1.5rem, 1.2, −0.025em): screen titles ("Mall Rewards Catalog", "Activity History").
- **Title** (800, 1.125rem, 1.3, −0.025em): card and section titles, reward names, the user's name in the hero.
- **Body** (500, 0.875rem, 1.45): default UI text.
- **Label** (700, 0.75rem): badges, field labels and the quick-action labels. Always sentence case.
- **Code** (600 mono, 0.875rem, +0.05em): serials and IDs.

### Named Rules
**The Tabular Rule.** Any number that changes (points, pesos, counts) uses `tabular-nums`.

**The No-Eyebrow Rule.** No kicker or uppercase label above a heading. The heading carries itself.

## Layout

Each surface has its own viewport. The customer app is mobile web at 360–430px in a single column, with a fixed
four-item quick-action bar at the bottom. Its icons sit on one line and labels centre under them, wrapping to at
most two balanced lines. The merchant portal and POS target desktop and tablet; the admin console starts at
1280px. Spacing follows a 4px grid, mostly 4, 8, 12, 16 and 24px. Touch targets are at least 44px. On C-2 the order
is balance hero → member QR card (prominent, per PRD) → Live now promos. Desktop surfaces put a navy or slate
header with tab navigation above light content of cards, charts and tables. Tab lists scroll horizontally on
narrow screens, with fading edges.

## Elevation & Depth

Depth is mostly tonal: Mall Mist → Card White → Quiet Panel, with cards on a hairline ring plus a soft
navy-tinted shadow. Hero zones get depth from the navy tonal deepening and the pay-wave arcs, not from glow.

### Shadow Vocabulary
- **Resting** (`box-shadow: 0 1px 2px rgb(1 36 92 / 0.06), 0 4px 12px rgb(1 36 92 / 0.06)`): cards, the
  selected tab, the customer header.
- **Lifted** (`box-shadow: 0 2px 6px rgb(1 36 92 / 0.08), 0 12px 32px rgb(1 36 92 / 0.12)`): hovered cards,
  the tier card, the merchant, POS and admin headers.
- **Reward** (`box-shadow: 0 0 0 1px rgb(242 178 27 / 0.5), 0 16px 48px rgb(1 36 92 / 0.28)`): the reward
  moment only.

### Named Rules
**The Three Levels Rule.** There are three elevation levels, and the third belongs to reward moments alone.

## Shapes

The radius tells you the object type. Chips and inputs get gently squared corners (8px), cards 12px (GCash's
standard), and hero zones and the tier card 16px. Buttons, tabs and badges are full pills. Borders are 1px
hairline rings. An affordable reward swaps its ring for a 2px gold one. Hero zones carry a 1px inset edge in
white at 14% opacity, or gold when they hold earned value. The pay-wave arc, a quarter-circle stroke with round
caps opening to the right, is the system's recurring geometry: in hero zones, in the coin's engraved mark, and
in the reward ripple.

## Components

### Buttons
Confident and tactile: flat pills that press in.
- **Shape:** full pill, at least 44px tall (`md`) or 48px (`lg`), bold label.
- **Primary:** flat GCash Blue with white text. On hover it turns GCash Hover Blue; on press it scales to 98%. No
  gradient, no glow.
- **Secondary:** Card White with blue text and a hairline ring. On hover it fills with Blue Mist.
- **Ghost:** blue text with no fill. On hover it fills with Blue Mist.
- **Inverse:** translucent white (10%) with white text and a 20% white ring, for hero surfaces only.
- **Disabled:** a Quiet Panel fill with slate text, and no press.
- **Focus:** a 3px outline at a 2px offset, brand blue on light surfaces and white inside `focus-on-dark`
  containers (every header and every hero zone).

### Tabs
- **Style:** a segmented pill track on Quiet Panel with 4px padding. Tabs are at least 40px tall, bold, 13px.
- **State:** the selected tab is a Card White pill with blue text and the resting shadow. Unselected tabs are
  slate text. Arrow keys move between tabs.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Card White on Mall Mist.
- **Shadow Strategy:** resting at rest, lifted on hover, with a 2px rise.
- **Border:** a hairline ring, or a 2px gold ring when a reward is affordable.
- **Internal Padding:** 12–16px.

### Inputs / Fields
- **Style:** Card White, 8px corners, a hairline ring, at least 44px tall. Selects use the shared `Select`, which
  has an inset chevron.
- **Focus:** a 2px brand ring.
- **Error / Disabled:** errors get a red ring and an inline message; disabled fields get a Quiet Panel fill.

### Navigation
Headers carry the GCash logo (the white version on dark): flat brand blue on the customer app, navy on merchant
and POS, slate on admin. Desktop tab navigation uses a translucent white pill for the active item.

### Hero Panel (signature)
`SpacePanel`: the navy deepening, a 1px inset edge, and the pay-wave arcs (three strokes in logo blues, with a
gold inner arc when the panel is about value). The arcs draw in once on mount and are static under reduced
motion. They are turned off where right-aligned content would collide: voucher stubs and the KPI strips.

### GCash Coin (signature)
A solid disc in one gold gradient (`gold-300` → `gold-500` → `gold-600`) with the GCash mark (C ring, G, an
inner and a taller outer pay wave) engraved as a darker shade of the same gold. It has no blue and nothing
see-through. The mark is a hand-drawn placeholder; swap in the official vector before a client demo.

### Reward Tile, Voucher Ticket, Tier Card (signature)
The **reward tile** is a card whose top is a small navy display case with the category icon and pay-waves. A gold
"Ready to claim" badge and gold ring mark one you can afford; a locked tile is desaturated. The **voucher ticket**
is a notched boarding pass: a navy stub with a gold strip and the solid gold peso amount, above a white body with
the mono serial. The **tier card** is a 1.586-ratio membership card on the hero panel; VIP gets gold type, a gold
arc and a gold edge.

### Reward Moment (signature)
The flow's one choreographed celebration: the object springs in, then at the payoff three rings (gold, then the
logo blues) broadcast outward once, with light confetti in gold and logo blues and a haptic tap. Tap anywhere to
skip. Under reduced motion it goes straight to settled with a 200ms fade.

## Do's and Don'ts

### Do:
- **Do** put exactly one hero zone (`SpacePanel`) on each screen, and keep everything else a calm working surface.
- **Do** use tokens (`bg-brand`, `text-gold-700`, `rounded-card`, `shadow-e1`). No hex values in components; the
  only literals are the QR ink `#0A2757` and the confetti palette.
- **Do** use the shared `Button`, `Select`, `Tabs`, `Dialog` and state components from `@gcash/ui`.
- **Do** add `focus-on-dark` to any blue, navy, slate or hero container.
- **Do** pair every status colour with an icon or label, and keep text at 4.5:1 in both themes.
- **Do** give every animation a reduced-motion fallback through `MotionPrefProvider`.

### Don't:
- **Don't** use gold anywhere except on points and rewards.
- **Don't** add aurora blobs, glass blur, glow, dot grids, gradient text or starfields. The coin is the only
  gradient object outside the hero background.
- **Don't** put uppercase or mono eyebrows above headings. Use mono only for real codes.
- **Don't** use a radius over 16px on containers.
- **Don't** put the logo in a white box on a coloured header, and don't recolour the GCash mark in brand blue on
  the coin.
- **Don't** use confetti on the merchant, POS or admin surfaces, or more than one choreographed moment per flow.
