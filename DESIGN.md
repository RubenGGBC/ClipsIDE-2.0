# Clips 2.0 — Editorial IDE Design System

## 1. Direction

Clips 2.0 is a focused teaching and debugging environment for CLIPS. The UI
must read as an editorial IDE: dense enough for expert work, calm enough to
make inference state legible, and recognisable as the current five-zone tool.

The editor remains the visual centre. Files and outline form the left rail,
agenda and facts form the inference inspector, and the console anchors the
bottom. The redesign changes hierarchy and finish, never the workflow.

Reference: `design/Acentos.dc.html` (direction B). Its navy, slate, amber,
green and rose palette is the visual contract. No glass, ornamental gradients, floating card
stacks or decorative animation.

## 2. Color Tokens

```css
--color-void: #0d1b2a;
--color-chrome: #1b263b;
--color-surface: #22334a;
--color-surface-hover: #293c55;
--color-border: #2a3b52;
--color-text: #e0e1dd;
--color-muted: #778da9;
--color-faint: #415a77;
--color-primary: #c9a227;
--color-primary-hover: #d8b640;
--color-new: #7fb2a6;
--color-danger: #c4787e;
--color-violet: #9a8fc8;
--color-string: #9fb68b;
--color-number: #c6a27d;
```

The five navy-to-platinum colors carry all structure. Three accents sit on top
of them, in the same cool luminosity family, and they exist for one reason: the
base palette has no hue contrast, so without them the inference cycle cannot be
read at a glance.

Semantic meaning is fixed:

- Amber means primary execution, pending work and dirty state.
- Green means success, fresh facts and focus confirmation.
- Rose means retraction, error and destructive interruption.
- Violet identifies CLIPS constructs and templates.
- Muted and faint blues carry secondary and tertiary information.

State must never be communicated by color alone. Every state carries a second,
non-color signal, so the screen still reads in greyscale and through a screen
reader:

| State | Color | Non-color signal |
| --- | --- | --- |
| Fresh fact | green | `+` before the index, hidden text "(nuevo)" |
| Retracted fact | rose | `−` before the index, strikethrough, hidden text |
| Next activation | amber | "Siguiente" label, left border, first position |
| Error status | rose | square status dot, bold weight |
| Confirmed status | green | round status dot |
| Unbalanced paren | rose | wavy underline |

No color may enter the stylesheet without being declared in the token list;
`src/palette.test.ts` enforces this.

## 3. Typography

- Interface: IBM Plex Sans, 400/500/600.
- Code, status, counts and console: IBM Plex Mono, 400/500/600.
- Base interface size: 14px. Code and console: 13px. Metadata: 11–12px.
- Section labels are uppercase, 10–11px, 0.08em tracking.
- Product mark is compact and typographic, not a large marketing logo.

## 4. Spacing And Geometry

Spacing uses a 4px base: 4, 8, 12, 16, 20, 24 and 32px. Controls use 4–6px
corner radii. Major workspace regions are rectangular and separated by 1px
borders, not wrapped in cards.

Desktop (`> 900px`):

- 56px command bar.
- 232px project rail.
- Flexible editor, always the largest region.
- 340px inference inspector, resizable from 240–560px.
- 208px console, resizable from 112–460px.
- Existing split dimensions remain persisted.

Compact (`<= 900px`):

- Command bar wraps into brand/status and horizontally scrollable actions.
- A four-item tablist selects `Código`, `Ficheros`, `Inferencia`, or `Consola`.
- Exactly one workspace view is exposed at a time; inactive views stay mounted
  when needed to preserve editor and console state, but are hidden from layout
  and the accessibility tree.
- Splitters are unavailable because touch targets cannot express precision
  resizing reliably.
- At 375px, controls remain at least 40px high and tabs remain fully reachable.

## 5. Component Anatomy

### Command Bar

Product mark and active file sit at the start. Execution controls form one
ordered group: Ejecutar is filled amber, Paso and Reiniciar are quiet surface
buttons, Detener is rose outlined and enabled only while busy. Status is a
compact live region at the end with explicit text for dirty/error/success.

### Project Rail

`Proyecto` and `Esquema` are distinct sections on one continuous surface.
File actions are concise labelled controls. The active file uses an amber rail,
surface shift and `aria-current`. Outline rows use typographic glyphs with
semantic color and retain full text labels.

### Editor

The editor sits on `--color-void`, with a slim document header that identifies
the active file and its modified/loaded state. CodeMirror remains the only
editing surface. Syntax colors map to the semantic palette and bracket depth
remains visible.

### Inference Inspector

Agenda and facts share one inspector. Their headers expose name and count.
The next activation has an amber rail and a textual `Siguiente` marker. Facts
remain grouped tables; new and retracted states retain non-color cues.

### Console

The console header names the region and keeps the REPL visually anchored.
Output remains scrollable and history behavior remains unchanged. The prompt
uses amber and error lines use rose.

### Drop State

File drag creates one full-workspace scrim with a dashed green boundary and
explicit replacement copy. It does not intercept pointer events.

## 6. Interaction And Motion

- Hover changes surface and text contrast only on interactive elements.
- Focus uses a 2px `--color-new` outline with 2px offset.
- Pressed/selected controls use border, surface and text changes together.
- The only content animation is the existing fact-change wash, limited to
  opacity/background and disabled by `prefers-reduced-motion`.
- No entrance animation, pulsing status, parallax or decorative motion.

## 7. Accessibility Constraints

- All icon-like marks have adjacent text or accessible names.
- The compact navigation is a real `tablist` with `tab`, `aria-selected`,
  `aria-controls`, roving keyboard focus and labelled `tabpanel` regions.
- Command status uses `role="status"` without stealing focus.
- Hidden compact views use both layout hiding and `aria-hidden` semantics.
- Contrast targets WCAG 2.2 AA for text and focus indicators.
- Existing keyboard shortcuts and keyboard-operable splitters are preserved.
- Touch targets are at least 40px in compact mode.

## 8. Accepted Debt

- IBM Plex remains fetched from Google Fonts; offline fallback uses local system
  sans and monospace stacks.
- The native `prompt()` flow for creating files is preserved because replacing
  it would change product behavior beyond this visual redesign.
- Desktop splitters remain custom rather than using a layout dependency.

## 9. Verification Contract

The redesign is complete only when existing UI tests pass, compact tab behavior
has direct DOM tests, TypeScript build and Oxlint pass, and Playwright evidence
at 375, 768 and 1280px confirms hierarchy, overflow, focus and interaction.
