# Design System Tokens & CSS Variables Documentation

## 1. Overview & Architecture

This project uses a layered design token architecture derived from the Figma token export in [`design-tokens.tokens.json`](../design-tokens.tokens.json). 

The automated conversion script [`scripts/convert-tokens.js`](../scripts/convert-tokens.js) transforms these tokens into standard CSS Custom Properties output at [`src/app/design-tokens.css`](../src/app/design-tokens.css).

```
   ┌─────────────────────────────────────────────────────────────┐
   │            Foundational Primitive Colors (0-100)            │
   │    (--color-primitive-*) ⚠️ DO NOT USE DIRECTLY ON UI       │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ feeds / establishes
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                  Semantic UI Color Roles                    │
   │  (--color-ui-*, --color-role-*) ✅ USE ON UI COMPONENTS     │
   │                                                             │
   │  • Brand Roles (Set 2):                                     │
   │    --color-ui-primary-color2    (#529cf3 - Sky Blue)        │
   │    --color-ui-secondary-color2  (#1579ef - Royal Blue)      │
   │    --color-ui-tertiary-color2   (#8fbff7 - Soft Blue)       │
   │    (plus container & on-container contrast pairs)           │
   │                                                             │
   │  • Material 3 Semantics:                                    │
   │    Primary, Secondary, Tertiary, Surface, Outline, Error    │
   └─────────────────────────────────────────────────────────────┘
```

---

## 2. Color System Rules

### ⚠️ Foundation Primitives vs. Semantic Roles

| Category | CSS Variable Prefix | Target Usage | Can Be Used on UI? |
| :--- | :--- | :--- | :---: |
| **Primitive Colors** | `--color-primitive-*` | Raw chromatic swatches (0-100 scale, key foundation colors). Used **only** as reference foundations. | ❌ **NEVER** |
| **Semantic UI Roles** | `--color-ui-*`, `--color-role-*` | Interactive elements, backgrounds, text, borders, active states, feedback alerts. | ✅ **YES** |

> **Why are primitives prohibited on the UI?**  
> Primitive colors (e.g. `--color-primitive-primary-color-pallette-primary-40`) are raw palette steps. Using them directly couples your UI to arbitrary color values. If dark mode, brand rebranding, or theme switching is applied, primitive variables do not react semantically. UI components must always consume **semantic roles**.

---

### Primary UI Roles (Role Set 2: Direct UI Application)

The design system designates **Role Set 2** (`primary color2`, `secondary color2`, etc.) as the active brand palette for user interface components:

| Token Name in JSON | Generated CSS Variable | Ergonomic Alias | Hex / Value | Primary Role & Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `primary color2` | `--color-ui-primary-color2` | `--color-ui-primary`, `--color-primary-2` | `#529cf3` | Primary brand color, main call-to-actions, active indicators |
| `primary container 2` | `--color-ui-primary-container-2` | `--color-ui-primary-container` | `#bfcbd9` | Primary container background, subtle callout cards |
| `on primary container 2` | `--color-ui-on-primary-container-2` | `--color-ui-on-primary-container` | `#2a4769` | High-contrast text/icons on primary container backgrounds |
| `secondary color2` | `--color-ui-secondary-color2` | `--color-ui-secondary`, `--color-secondary-2` | `#1579ef` | Secondary actions, badges, accents, interactive links |
| `secondary container 2` | `--color-ui-secondary-container-2` | `--color-ui-secondary-container` | `#cfe4fc` | Secondary container/chip backgrounds |
| `on secondary container 2` | `--color-ui-on-secondary-container-2` | `--color-ui-on-secondary-container` | `#083b77` | Text/icons placed over secondary container surfaces |
| `tertiary color2` | `--color-ui-tertiary-color2` | `--color-ui-tertiary`, `--color-tertiary-2` | `#8fbff7` | Tertiary highlights, tertiary tags, subtle hover fills |
| `tertiary container 2` | `--color-ui-tertiary-container-2` | `--color-ui-tertiary-container` | `#b8d6fa` | Tertiary container backgrounds |
| `on tertiary container 2` | `--color-ui-on-tertiary-container-2` | `--color-ui-on-tertiary-container` | `#0a4385` | Text/icons placed on tertiary containers |
| `color` | `--color-ui-color` | `--color-ui-accent` | `#529cf3` | General accent token |

### Standard Semantic Hierarchy (Material 3 Mappings)

Tokens referencing primitive values are dynamically linked via CSS `var()` with literal fallbacks:

- **Surface & Backgrounds**:
  - `--color-role-surface`: Base surface (`#fafafa`)
  - `--color-role-surface-on-surface`: Standard text on surface (`#191919`)
  - `--color-role-surface-surface-variant`: Muted surface tint (`#e7e4e4`)
  - `--color-role-surface-on-surface-variant`: Muted text / secondary copy (`#524747`)
  - Container elevations: `--color-role-surface-surface-container-lowest` through `highest`
  - Inverse states: `--color-role-surface-inverse-surface`, `--color-role-surface-inverse-on-surface`
- **Feedback & Outlines**:
  - `--color-role-error-error`: Critical / destructive actions and alerts (`#c50707`)
  - `--color-role-error-on-error`: Text/icons on error backgrounds (`#ffffff`)
  - `--color-role-error-error-container`: Soft error banner background (`#fdcece`)
  - `--color-role-outline-outline`: Borders, dividers, and structural outlines (`#887777`)
  - `--color-role-outline-outline-variant`: Subtle borders and dividers (`#cfc9c9`)

---

## 3. Spacing Scale

The spacing system provides both pixel-accurate tokens and standard t-shirt scale aliases:

| Token Name | Base Value | Rem Equivalent | Token Variable | Semantic Scale Alias |
| :--- | :--- | :--- | :--- | :--- |
| `no spacing` | `0px` | `0rem` | `--spacing-no-spacing` | `--spacing-0` / `--spacing-none` |
| `extra small spacing` | `4px` | `0.25rem` | `--spacing-extra-small-spacing` | `--spacing-xs` |
| `small spacing` | `8px` | `0.5rem` | `--spacing-small-spacing` | `--spacing-sm` |
| `medium spacing` | `12px` | `0.75rem` | `--spacing-medium-spacing` | `--spacing-md` |
| `base spacing` | `16px` | `1.0rem` | `--spacing-base-spacing` | `--spacing-base` |
| `large spacing` | `20px` | `1.25rem` | `--spacing-large-spacing` | `--spacing-lg` |
| `extra large spacing` | `24px` | `1.5rem` | `--spacing-extra-large-spacing` | `--spacing-xl` |
| `very large sacing` | `32px` | `2.0rem` | `--spacing-very-large-sacing` | `--spacing-2xl` |

---

## 4. Elevation & Shadow Effects

Figma drop shadow definitions are converted to CSS `box-shadow` properties:

| Effect Token | CSS Variable | Value | Recommended Usage |
| :--- | :--- | :--- | :--- |
| `hard shadow` | `--shadow-hard-shadow` | `4px 6px 8px 0px rgba(0, 0, 0, 0.322)` | Modals, elevated dialogs, floating context menus |
| `medium shadow` | `--shadow-medium-shadow` | `2px 4px 6px 0px rgba(0, 0, 0, 0.278)` | Card hover states, dropdown menus, flyouts |
| `soft shadow` | `--shadow-soft-shadow` | `2px 2px 20px 0px rgba(0, 0, 0, 0.122)` | Base card elevation, subtle container separation |

---

## 5. Typography System

The typography scale generates discrete CSS custom properties for each text style category:
- **Display**: `display large`, `display medium`, `display small`
- **Headline**: `headline large`, `headline medium`, `headline small`
- **Title**: `title large`, `title medium`, `title small`
- **Body**: `body large`, `body medium`, `body small`
- **Label**: `label large`, `label medium`, `label small`
- **Button**: `button`, `button2`

### Generated Variables per Style
For any style (e.g. `body-large`):
- `--typography-body-large-font-family`
- `--typography-body-large-font-size`
- `--typography-body-large-font-weight`
- `--typography-body-large-line-height`
- `--typography-body-large-letter-spacing`
- `--typography-body-large-text-decoration`

### Built-in Typography Utility Classes
The generator outputs ready-to-use utility classes at the bottom of `design-tokens.css`:
```css
/* Example Usage in HTML/JSX */
<h1 className="type-headline-large">Heading</h1>
<p className="type-body-large">Body text</p>
<button className="type-button">Click Me</button>
```

---

## 6. How to Run the Converter Script

### Execution via NPM Script
Whenever `design-tokens.tokens.json` is updated from Figma, regenerate the CSS tokens with:

```bash
npm run tokens:build
```

### Execution via Direct Node CLI
You can specify custom input and output paths:

```bash
# Default paths:
node scripts/convert-tokens.js

# Custom paths:
node scripts/convert-tokens.js --input ./path/to/tokens.json --output ./src/styles/custom-tokens.css
```

---

## 7. Next.js & Tailwind CSS Integration

### Global Import
[`src/app/design-tokens.css`](../src/app/design-tokens.css) is imported directly into [`src/app/globals.css`](../src/app/globals.css):

```css
@import "tailwindcss";
@import "./design-tokens.css";

@theme inline {
  --color-primary: var(--color-ui-primary);
  --color-secondary: var(--color-ui-secondary);
  --color-tertiary: var(--color-ui-tertiary);
}
```

### Usage in Components

#### 1. In Vanilla CSS:
```css
.card {
  background-color: var(--color-ui-primary-container);
  color: var(--color-ui-on-primary-container);
  padding: var(--spacing-base);
  box-shadow: var(--shadow-medium-shadow);
  border-radius: var(--spacing-sm);
}
```

#### 2. In Tailwind Classes:
```tsx
// Consuming mapped theme variables:
<button className="bg-primary text-white hover:bg-secondary px-4 py-2 rounded-lg">
  Action
</button>

// Or direct arbitrary values with design token variables:
<div className="p-[var(--spacing-lg)] shadow-[var(--shadow-soft-shadow)] bg-[var(--color-ui-primary-container)]">
  <p className="text-[var(--color-ui-on-primary-container)]">Content</p>
</div>
```
