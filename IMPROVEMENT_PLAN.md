# StyleForge v2 — Improvement & Enhancement Plan

> **Status update (2026-07-17): v2.0 IMPLEMENTED.** Everything below has shipped in this
> working tree except the Country Club adapter, which is deliberately excluded — it will be
> built in a private internal fork so the Country Club design system is never exposed in the
> public plugin. Delivered: live-fetch with bundled fallback + source stamping (§1.1), a
> 47-test suite + weekly-drift CI (§1.2), the expanded shadcn surface — base-color & accent
> pickers from all 24 registry themes, derived radius scale, Geist font variables, shadow
> tiers, state/alpha recipes (§1.3), Dev-Mode code syntax on every variable (§1.4),
> seven new adapters — Radix Colors, Material UI, Chakra UI, Mantine, DaisyUI, Bootstrap 5
> and a generic DTCG/Tokens Studio importer (§2), plus the diff/review re-sync flow with
> color swatches and DTCG+CSS export (§3). Remaining for later: per-group selective import
> (§3.2 partial), component-recipe variables (§3.3), Polaris/Carbon adapters.

Original plan (written after the code + data audit on 2026-07-17):
Fixed already in this working tree (ship as **v1.1 patch**):

- **Light-mode UI bug** — accent colors (`--sf-brand`, primary button, checkboxes, progress bar, spinner, header logo, success icon) were hardcoded for dark theme and rendered white-on-white in Figma's light theme. All hardcoded values now route through `--sf-brand` / `--sf-on-brand` tokens with a `.figma-light` override block (Figma injects that class because `themeColors: true` is already set). `styles.css` is the only file that changed.
- **Stale shadcn tokens** — the bundled `shadcn-light/dark.tokens.json` carried the v4-launch palette. Diffed against the current default `neutral` theme in `shadcn-ui/ui` (`apps/v4/registry/themes.ts`) and corrected:
  - `chart-1..5` (both modes): old orange/teal/blue palette → current **grayscale ramp** (`0.87 / 0.556 / 0.439 / 0.371 / 0.269`)
  - dark `popover`: `0.269` → `0.205`
  - dark `accent`: `0.371` → `0.269`
  - dark `sidebar-ring`: `0.439` → `0.556`
  - `destructive-foreground` (both modes): **removed** — no longer part of the distributed theme

---

## 1. Accuracy: true 1:1 parity with upstream (highest priority)

The audit found the root cause of drift: **adapters bundle static JSON snapshots and never fetch upstream** (`shadcnAdapter.fetchAndParse()` reads local files despite the fetcher supporting `raw.githubusercontent.com`). Any upstream change silently invalidates the import.

1.1 **Live-fetch with pinned fallback.** Each adapter fetches its canonical source at import time (shadcn: `apps/v4/registry/themes.ts` or the registry JSON endpoint; Base UI: `docs/src/css/index.css` `@theme`; Tailwind: `packages/tailwindcss/theme.css`) and falls back to the bundled snapshot offline. Show the source + commit/version in the UI ("tokens from shadcn-ui/ui@main, fetched today" vs "bundled snapshot vX").
   - `manifest.json` `allowedDomains` already permits `raw.githubusercontent.com` — no manifest change needed.

1.2 **Snapshot tests as a parity contract.** There are currently **zero test files** (vitest configured, `npm test` exits 1). Add per-adapter golden tests: parse the bundled snapshot → assert the exact variable tree (names, resolved hex, modes, scopes). Add a CI job that fetches upstream weekly and fails when the snapshot drifts, so stale data becomes a PR instead of a silent bug.

1.3 **Complete the shadcn token surface.** Today `categories: ['colors']` only. Missing for 1:1 parity:
   - **Radius scale** — `radius` is in the JSON but not imported as the derived scale: `sm = radius×0.6`, `md = ×0.8`, `lg = radius`, `xl = ×1.4`, `2xl = ×1.8`, `3xl = ×2.2`, `4xl = ×2.6` (from `@theme inline` in globals.css). Import as FLOAT variables.
   - **Base-color variants** — shadcn init offers neutral / stone / zinc / mauve / olive / mist / taupe plus 10 accent themes (blue, cyan, …) in `registry/themes.ts`. Offer a base-color picker in the ConfigPanel; import the chosen theme's values.
   - **Named styles (Vega, Nova, Luma, Lyra, Maia, Mira, Rhea, Sera)** — the new per-style layers restyle components but also imply token deltas (e.g. Vega surfaces use `ring-1 ring-foreground/10` instead of borders). At minimum import per-style extras; long-term see §3.3.
   - **Typography styles** — font stacks (Geist/Geist Mono today) + the text-size ramp as Figma text styles.
   - **Effect styles** — Tailwind shadow tiers (`shadow-xs/sm/md/lg/xl`) as Figma effect styles; shadcn components reference them constantly.
   - **State/alpha recipes** — `ring-ring/50` focus rings, `destructive/10..40` tints, `dark:bg-input/30` (= 4.5% white — Tailwind's `/30` multiplies existing alpha). These cannot be plain aliases; import as mode-aware RGBA variables in a `state/` group. (Reference implementation: the shadcn/ui Vega Figma library built in-house, run `shadcn-vega-001` — its `state/*` variable group is the proven model.)

1.4 **Code syntax on every variable.** `setVariableCodeSyntax('WEB', 'var(--token)')` is never called. Adding it makes Dev Mode show the exact CSS custom property — cheap, high-value parity for developers.

1.5 **Base UI verification.** The bundled `base-ui.tokens.json` looks structurally right (alpha-gray primitives match the docs palette) but: verify `typography/font-sans` (`'Unica 77'` — the docs previously used `die grotesk a`; confirm against current `docs/src/css/index.css`), and add the missing pieces used by every component: radius 0 design language, the hard shadow `4px 4px 0 rgb(0 0 0 / 12%)` (transparent in dark), and focus-ring recipes.

## 2. More design systems (adapter roadmap)

Ordered by expected demand and adapter effort (the `LibraryAdapter` interface + `registerAdapter` make each one additive):

| Priority | System | Source of truth | Notes |
|---|---|---|---|
| P0 | **Country Club** | internal repo tokens | Not in the community plugin build (the design system itself is published on Figma Community), but ship it behind a build flag / private build for internal project use — the adapter pattern supports both from one codebase. |
| P0 | **shadcn base-color + style variants** | `registry/themes.ts`, `registry/styles/style-*.css` | Extends the existing adapter; biggest accuracy win. |
| P1 | **Radix Themes / Radix Colors** | `@radix-ui/colors` | Pure token package, trivial to parse, huge audience. |
| P1 | **Material (MUI / Material 3)** | `@mui/material` default theme, M3 token JSON | Large audience; M3 has an official DTCG-ish token export. |
| P1 | **Chakra UI** | `@chakra-ui/theme` | Well-structured theme object. |
| P2 | **Mantine** | `@mantine/core` default theme | |
| P2 | **DaisyUI** | theme CSS variables | Sits on Tailwind — reuses the existing dependency mechanism. |
| P2 | **Bootstrap 5** | `_variables.scss` (compiled map) | Needs a small SCSS-map parser. |
| P3 | **Shopify Polaris / IBM Carbon** | published token JSON packages | Both ship DTCG-style JSON; mostly mapping work. |
| P3 | **Open Props / Tokens Studio JSON import** | user-supplied file | Generic DTCG importer = "bring your own design system", the long-tail killer feature. |

## 3. New features for v2

3.1 **Update / re-sync flow.** Detect existing StyleForge collections (tag them with `setSharedPluginData`), diff current values against fresh tokens, and show an "Update available: 12 changed, 3 added, 1 removed" review screen before applying. Today re-running silently overwrites.

3.2 **Selective import.** The category checkboxes exist in the UI; extend to per-group (e.g. only `chart/*`) and per-mode selection, plus "merge into existing collection" vs "create new".

3.3 **Component styles awareness (stretch).** Import per-component recipes (paddings, radii, control heights) as FLOAT variables in a `components/` group so libraries built on top stay bound to code values. Source: the cva definitions in each system.

3.4 **Export / round-trip.** Export current Figma variables back to DTCG JSON or CSS `@theme` — closes the loop for teams that tweak tokens in Figma first.

3.5 **UI polish.**
   - Preview swatches in TokenPreview render actual resolved colors per mode (with the light/dark toggle).
   - Post-import summary listing created collections/styles with counts and a "select in Figma" affordance.
   - Error surface: per-token parse warnings instead of all-or-nothing failure.

## 4. Engineering hygiene

- **Tests** (see 1.2): adapter goldens, `colorUtils` oklch→sRGB conversion cases (validate against CSS Color 4 reference values, incl. alpha like `oklch(1 0 0 / 10%)`), variableManager idempotence (re-import produces zero duplicates).
- **CI**: GitHub Actions — typecheck, build, vitest, weekly upstream-drift check.
- **Versioned data**: stamp bundled snapshots with source commit + date in the JSON (`"_source": {"repo": "...", "commit": "...", "fetched": "..."}`) and surface it in the UI.
- **Release checklist**: build both bundles, bump `package.json` + manifest version, verify in Figma light *and* dark theme (the bug class fixed in v1.1).

## 5. Suggested release slicing

- **v1.1 (now)** — light-mode fix + corrected shadcn tokens. Zero risk, ship immediately.
- **v1.2** — live-fetch with fallback, code syntax, radius scale, snapshot tests + CI.
- **v2.0** — shadcn base-colors + styles picker, typography/effect styles, state/alpha recipes, update/diff flow, Radix + Country Club (internal build) adapters.
- **v2.x** — MUI/Chakra/Mantine/DaisyUI adapters, DTCG import/export, component-recipe variables.
