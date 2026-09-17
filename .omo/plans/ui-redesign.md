# Clips 2.0 UI Redesign Plan

## Claim

The app can adopt the Acentos editorial IDE system and compact tab navigation
without changing editor, file, engine, inference, console or splitter behavior.

## Work Graph

1. Add failing UI tests for the compact workspace tablist, selection semantics,
   keyboard navigation and stable panel identity.
2. Extract layout-only components from `App.tsx`:
   - `components/CommandBar.tsx`
   - `components/ProjectRail.tsx`
   - `components/WorkspaceTabs.tsx`
   - `components/InferencePanel.tsx`
3. Keep state, engine orchestration and file operations in `App.tsx`; pass typed,
   narrow props to the extracted views.
4. Add editor and console region headers without recreating CodeMirror or
   changing console history.
5. Replace `index.css` with token-driven desktop and compact layouts governed by
   `DESIGN.md`; retain semantic classes used by inference state.
6. Run targeted tests after each extraction, then full test/build/lint.
7. Build with `npm run build`, start `npm run preview -- --host 127.0.0.1`
   from `packages/app`, and use the Playwright MCP against the printed local URL
   (normally `http://127.0.0.1:4173`). Capture fresh screenshots at 375x812,
   768x1024 and 1280x800 after the scenarios below pass.
8. Run changed-file `lsp_diagnostics`, `npm test`, `npm run build` and
   `npm run lint`. All must exit cleanly. Then invoke `/visual-qa` in
   reference-fidelity mode and `/review-work`; resolve every blocking finding
   before completion.

## File Ownership

- `DESIGN.md`: visual contract.
- `packages/app/src/App.tsx`: state and workflow composition only.
- `packages/app/src/components/CommandBar.tsx`: execution and status controls.
- `packages/app/src/components/ProjectRail.tsx`: project files/actions/outline.
- `packages/app/src/components/WorkspaceTabs.tsx`: compact navigation state and
  keyboard semantics.
- `packages/app/src/components/InferencePanel.tsx`: agenda/facts composition.
- `packages/app/src/components/Editor.tsx`: editor host and document header.
- `packages/app/src/components/Console.tsx`: console header and existing REPL.
- `packages/app/src/index.css`: all tokens, layout, states and breakpoints.
- `packages/app/src/ui.test.tsx`: preserved regression tests plus tab behavior.

## Evidence Path

- Behavior preservation: existing Vitest suite.
- Compact navigation: Testing Library role/ARIA and keyboard tests.
- Type and bundle integrity: `npm run build`.
- Static quality: `npm run lint` and changed-file LSP diagnostics.
- User-visible correctness: Playwright interaction and screenshots at the three
  contract widths, including file selection, tabs, filter, console and focus.

## Browser QA Scenarios

Use the Playwright MCP from the `playwright` skill. Run every scenario against
the production preview, not Vite development mode.

### 1280x800 — Desktop Workbench

1. Load the app and confirm command bar, project rail, editor, inference
   inspector and console are simultaneously visible with no page-level scroll.
2. Select another file in the project rail. Its row must expose
   `aria-current="true"`, the editor document must change and the outline must
   correspond to the selected file.
3. Tab to both splitters and press arrow keys. The inspector/console dimensions
   must change while all five regions remain usable.
4. Focus the facts filter, type a matching template and confirm non-matching
   groups disappear without horizontal page overflow.
5. Focus the console input, submit `(facts)`, then use ArrowUp. The submitted
   command must return to the input and console output must remain readable.
6. Capture `artifacts/ui-1280.png`. Compare hierarchy and palette with
   `design/Acentos.dc.html`: navy editor, slate chrome, amber primary action,
   green fresh/success state, rose error/retraction state.

### 768x1024 — Tablet Tabs

1. Confirm a tablist named for workspace navigation exposes exactly Código,
   Ficheros, Inferencia and Consola; Código starts selected.
2. Click each tab. Exactly its labelled tabpanel must be visible; inactive
   tabpanels must be hidden from the accessibility tree.
3. Focus Código and use ArrowRight/ArrowLeft. Focus and `aria-selected` must
   move with wraparound, and the corresponding panel must become visible.
4. Open Ficheros, select a file, return to Código and confirm the selected file
   remains active and the CodeMirror instance remains editable.
5. Open Inferencia and verify Agenda, Hechos and the facts filter remain usable.
6. Capture `artifacts/ui-768.png`; no clipped controls or viewport overflow.

### 375x812 — Phone Tabs

1. Confirm the command bar actions remain reachable by horizontal scrolling,
   with 40px minimum control height and no overlap with status text.
2. Traverse all four tabs by keyboard and click. Labels must remain readable,
   selected state must have both color and a structural cue, and one panel is
   visible at a time.
3. In Ficheros, file actions and file rows must be reachable without horizontal
   page scrolling. In Consola, the prompt input must remain fully visible when
   focused. In Inferencia, fact tables may scroll inside their panel only.
4. Capture `artifacts/ui-375.png`; reject any clipped text, inaccessible action,
   page-level horizontal scroll or overlapping region.

### Focus And Console Checks

- Press Tab through command controls, workspace tabs, file actions, outline,
  filter and console. Every focused control must show the green 2px indicator.
- Trigger the existing run shortcut and confirm status text updates through the
  live region. Trigger Escape only while busy and confirm the explicit stopped
  status/error output; shortcuts must not switch compact tabs unexpectedly.
- Enable reduced motion in Playwright and verify fact-change animation is absent.

## Final Pass Criteria

- `npm test`, `npm run build` and `npm run lint` exit 0 from `packages/app`.
- LSP reports no errors or warnings in every changed TypeScript/TSX file.
- All browser scenarios pass at their named dimensions with fresh screenshots.
- Browser console contains no application errors.
- `/visual-qa` reports no blocking design-system, responsive, accessibility or
  reference-fidelity issue.
- `/review-work` reports no blocking correctness, quality or security finding.

## Scope Boundaries

No engine/protocol changes, no new dependencies, no persistence migration, no
replacement of native file creation prompt, and no speculative dev tooling.
