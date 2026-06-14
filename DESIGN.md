---
name: The Logistics Registry
description: A tech-precise visual design system for B2B warehouse storefronts.
colors:
  primary: "#1d4ed8"          # oklch(0.488 0.243 264.376)
  primary-foreground: "#f8fafc"
  neutral-bg: "#fafafa"       # oklch(0.985 0 0)
  neutral-foreground: "#18181b"
  border: "#e4e4e7"           # oklch(0.922 0 0)
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
  lg: "10px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.md}"
    border: "1px solid {colors.border}"
---

# Design System: The Logistics Registry

## 1. Overview

**Creative North Star: "The Logistics Registry"**

The Logistics Registry is a highly professional, clean, and mature design system built for B2B wholesale environments. It removes consumer-oriented clutter, heavy box shadows, and warm gradients in favor of high-contrast flat tinted neutrals, structured grid lines, and technical typography. 

Success is measured by how easily and accurately a retailer can parse quantity metrics, SKU availability, and prices in a high-density viewport.

**Key Characteristics:**
- Flat, non-gradient tinted neutral backgrounds (zinc/slate).
- Structural borders (1px) over decorative container shadows.
- Technical monospace metrics for all numeric values (quantities, prices, SKUs).
- Extremely restrained color accents, reserving the primary blue (`oklch(0.488 0.243 264.376)`) exclusively for active status states or key primary actions.

## 2. Colors

The color palette centers around clean grays and deep slate colors, with high-contrast foreground markers and precise primary blue indicators.

### Primary
- **Registry Blue** (oklch(0.488 0.243 264.376)): Used on active pills, selected categories, and primary checkout CTA buttons.

### Neutral
- **Pure White** (oklch(1 0 0)): Used for content canvases (cards, search boxes).
- **Ink Black** (oklch(0.145 0 0)): Used for core copy and headings.
- **Metal Grey** (oklch(0.922 0 0)): Used for border lines and dividers.
- **Cool Mist** (oklch(0.985 0 0)): Used for background shading and unselected elements.

### Named Rules
**The Restrained Accent Rule.** The primary blue accent must carry ≤10% of any page's visible weight. Active category tabs and primary order buttons are the only allowed surfaces.
**The Flat Canvas Rule.** No color gradients, background patterns, or glassmorphism effects are permitted. Color is strictly solid.

## 3. Typography

**Display Font:** Inter (or system-sans fallback)
**Body Font:** Inter
**Label/Mono Font:** JetBrains Mono (or monospace fallback)

**Character:** Bold typographic contrast with high readability. High-density pages benefit from distinct type sizes and weight differences rather than borders alone. Monospace typography is assigned to data fields to establish technical precision.

### Hierarchy
- **Display** (800, 1.875rem, 1.2): Main page headers and warehouse titles.
- **Headline** (700, 1.25rem, 1.3): Section headers and page subsections.
- **Title** (600, 0.875rem, 1.4): Product names and labels.
- **Body** (400, 0.875rem, 1.5): Standard prose, descriptions, and categories. Max line length 70ch.
- **Label** (500, 0.75rem, normal): SKU labels, mini stats, and status pills.

### Named Rules
**The Data Metric Rule.** All quantities, weights, SKU codes, and currency values must use monospace layout font-styling (`font-mono`) and tabular numbers (`tabular-nums`) to ensure strict alignment.

## 4. Elevation

The system is flat by default. Depth is conveyed using thin structural borders and subtle tone shading instead of drop shadows.

### Named Rules
**The Flat-By-Default Rule.** Shadows are prohibited. Depth transitions on hover should be expressed via border color shifts (e.g. from zinc-200 to zinc-400) or subtle background highlight adjustments.

## 5. Components

### Buttons
- **Shape:** Rounded corners (8px)
- **Primary:** Registry Blue background, pure white text. Padding (8px 16px).
- **Secondary / Outline:** Border (1px zinc-200), background transparent, dark zinc-900 text.
- **Hover / Focus:** Primary button shifts background to oklch(0.424 0.199 265.638). Secondary button shifts background to zinc-50.

### Cards / Containers
- **Corner Style:** Rounded (8px)
- **Background:** Pure White (`#ffffff`)
- **Shadow Strategy:** Flat (no shadow).
- **Border:** 1px solid zinc-200 (`border-zinc-200`)
- **Hover:** Border shifts to zinc-400 on hover.

### Inputs / Fields
- **Style:** Background white, border 1px zinc-200, rounded 8px.
- **Focus:** Border changes to Registry Blue with a subtle outline glow.

### Navigation
- Categories list must render as flat, bordered tags, using solid Registry Blue for the active tab and transparent borders for inactive tabs.

## 6. Do's and Don'ts

### Do:
- **Do** use `font-mono` and `tabular-nums` for SKU numbers, counts, and prices.
- **Do** define container shapes with thin 1px gray borders.
- **Do** reserve high-chroma primary colors exclusively for selected filters and key action triggers.

### Don't:
- **Don't** use multi-color gradient fills for headings or backgrounds.
- **Don't** apply box shadows or blur overlays (glassmorphism) as visual decoration.
- **Don't** use amber or orange accents for primary call-to-action buttons or highlights.
- **Don't** wrap grids in secondary cards; let the products flow on a flat canvas grid.
