---
name: Inclusive Warmth
colors:
  surface: '#fff8f6'
  surface-dim: '#edd5cc'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1ec'
  surface-container: '#ffe9e1'
  surface-container-high: '#fce3da'
  surface-container-highest: '#f6ddd4'
  on-surface: '#251913'
  on-surface-variant: '#594238'
  inverse-surface: '#3c2d27'
  inverse-on-surface: '#ffede7'
  outline: '#8c7166'
  outline-variant: '#e0c0b2'
  surface-tint: '#a23f00'
  primary: '#9e3d00'
  on-primary: '#ffffff'
  primary-container: '#c64f00'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb595'
  secondary: '#635e53'
  on-secondary: '#ffffff'
  secondary-container: '#e9e2d3'
  on-secondary-container: '#696458'
  tertiary: '#6e5749'
  on-tertiary: '#ffffff'
  tertiary-container: '#896f60'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcd'
  primary-fixed-dim: '#ffb595'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7c2e00'
  secondary-fixed: '#e9e2d3'
  secondary-fixed-dim: '#cdc6b8'
  on-secondary-fixed: '#1e1b13'
  on-secondary-fixed-variant: '#4b463c'
  tertiary-fixed: '#fcdcca'
  tertiary-fixed-dim: '#dfc0af'
  on-tertiary-fixed: '#28180d'
  on-tertiary-fixed-variant: '#584235'
  background: '#fff8f6'
  on-background: '#251913'
  surface-variant: '#f6ddd4'
typography:
  display-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 30px
  body-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  label-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0.01em
  headline-lg-mobile:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  touch-target-min: 56px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style

This design system is built on the philosophy of **Radical Inclusion**. It translates the playful, inviting energy of the food store into a digital interface that prioritizes cognitive ease and physical accessibility. The brand personality is warm, patient, and dependable—designed to feel like a helpful assistant rather than a complex tool.

The visual style is a blend of **Modern Minimalism** and **Tactile Design**. By using large, clear surfaces and subtle depth, the UI provides strong affordances that guide users with cognitive or visual impairments. Every element is designed to be "unmistakable," reducing the mental load for both customers with special needs and employees working in high-pressure environments.

## Colors

The palette is strictly curated to meet and exceed WCAG AAA contrast requirements while maintaining the brand's culinary identity.

- **Primary (#D35400):** A darkened "Burnt Orange" derived from the logo. It provides a safer contrast ratio against cream backgrounds than standard orange for interactive elements.
- **Secondary/Background (#FDF5E6):** An "Old Lace" cream. This reduces the blue-light glare common with pure white backgrounds, which can be taxing for users with light sensitivity or dyslexia.
- **Text/Neutral (#2C1B10):** A "Deep Espresso" brown. This offers maximum legibility while feeling warmer and less clinical than pure black.
- **Functional Colors:** Green and Red are deepened to ensure they remain distinguishable for users with common forms of color blindness.

## Typography

This system utilizes **Atkinson Hyperlegible Next** across all roles. This typeface was specifically designed to increase legibility for readers with low vision by focusing on the distinction between similar letter shapes (e.g., I, l, and 1).

**Key Rules:**
- **Minimum Size:** No text shall be smaller than 18px (`body-md`).
- **Alignment:** All long-form text must be left-aligned to provide a consistent "anchor" for the eye, aiding users with cognitive impairments. 
- **No All-Caps:** Avoid all-capitalized strings for body text or labels, as the uniform rectangular shape of capitalized words is harder to decode than lowercase shapes.
- **Line Height:** Generous leading (minimum 1.5x font size) prevents "line skipping" while reading.

## Layout & Spacing

The layout follows a **Fluid Content Model** with strict minimum safety zones to accommodate motor impairments (tremors or limited range of motion).

- **Touch Targets:** All interactive elements must have a minimum hit area of 56x56px, even if the visual icon is smaller.
- **The "Breathe" Rule:** Use `stack-lg` (48px) to separate distinct logical groups (e.g., "Rice" category from "Snacks"). This prevents accidental taps and visual crowding.
- **Grid:** A simplified 12-column grid on desktop, collapsing to a single-column stack on mobile. Avoid multi-column text layouts which can be confusing for screen readers and users with cognitive tracking difficulties.

## Elevation & Depth

To aid users with spatial reasoning difficulties, this design system uses **Tonal Layering** and **High-Contrast Outlines** rather than complex shadows.

- **Surface Tiers:** Background is Cream. Interactive Cards use a slightly lighter Tonal Layer with a 2px solid border in Dark Brown to clearly define the clickable boundary.
- **Active State:** When a component is pressed or focused, it "sinks" (remove border-bottom offset or change background to Primary Orange) to provide immediate tactile-style feedback.
- **Focus Indicators:** Focus rings are never hidden. They must be a 4px thick, Primary Orange stroke with a 2px offset from the element to ensure visibility for keyboard-only users.

## Shapes

The shape language uses **Rounded (8px base)** geometry. This reflects the friendly nature of the logo while providing enough structure to clearly define "containers" for information.

- **Large Components:** Cards and main containers use `rounded-xl` (24px) to feel soft and welcoming.
- **Buttons:** Use `rounded-lg` (16px) to distinguish them from the sharper square containers of purely informational blocks.
- **Icons:** All icons should use a rounded stroke-cap and a minimum 2pt weight to ensure they remain visible against the cream background.

## Components

### Buttons
- **Primary:** Dark Brown background with Cream text. Bold, 20px font.
- **Secondary:** Transparent background with 3px Primary Orange border.
- **Scaling:** On mobile, buttons should be full-width to provide the largest possible touch target.

### Cards (Menu Items)
- Must include a high-quality photo, the item name in `headline-md`, and the price in Primary Orange.
- Use an "Add" button that spans the bottom of the card, clearly separated from the item details to prevent "misfires."

### Input Fields
- Labels are always visible (never use placeholder text as the only label).
- 3px Dark Brown border. On focus, the border changes to Primary Orange and thickens to 5px.

### Navigation
- **Icon + Label:** Navigation items must never be icons alone. They must always be paired with a text label in `label-lg`.
- **Active State:** The active page link is underlined with a 4px Primary Orange stroke.

### Chips (Dietary Tags)
- High-contrast tags (e.g., "Halal", "Vegetarian") using the Dark Brown text on a light version of the primary color. Large enough to be legible at a glance.