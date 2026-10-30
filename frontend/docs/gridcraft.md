# GridCraft: inspection notes and integration decision

Repository: https://github.com/storytold/gridcraft (cloned locally into `./gridcraft/`,
which is git-ignored).

## What GridCraft is

After inspecting the checked-out revision:

- It is a **standalone, high-performance spreadsheet application written in pure Rust**, by the
  ArtCraft team. Not a React component and not an npm spreadsheet library.
- It is a Cargo workspace with enforced layering: `core`, `numfmt`, `formula`, `functions`,
  `model`, `calc`, `xlsx`, `chart`, `engine`, `ui-egui`, `mcp`, and the apps
  (`gridcraft`, `gridcraft-cli`, `gridcraft-web`).
- Native builds run on macOS, Windows, Linux and BSD; there is a **browser/WASM build** under
  `apps/gridcraft-web` built with Trunk and the `wasm32-unknown-unknown` target.
- **XLSX is its native format** (styles, formulas, tables, conditional formats, charts,
  pivot tables round-trip), plus CSV/TSV and import of `.xls`/`.xlsb`/`.ods` data. It exposes a
  CLI (`gridcraft-cli`) and an **MCP/control** interface for agents.
- License: **MIT OR Apache-2.0**. The ArtCraft brand assets in `docs/brand/` are trademarks under
  a separate brand license and must be removed from forks.

## Decision: keep it independent and optional

Per the specification, the CRM owns its own single-page UI, PostgreSQL database, AI pipeline,
WhatsApp integration, matching engine, and **its own XLSX export** (built with ExcelJS in
`server/export/workbook.ts`). This export works with no GridCraft present.

GridCraft is **not coupled** to the CRM:

- We do **not** import GridCraft's Rust crates or embed its WASM build as the app shell.
- Embedding the WASM build would require the Rust/Trunk toolchain as a hard build dependency and
  would pull a full Excel-class UI into a product that only needs a minimal three-view table.
  That is disproportionate for the MVP.
- The CRM's lightweight TanStack-style tables cover the needed interactions (view, sort, filter,
  select, open the detail drawer).

**Role of GridCraft in this product:** an *optional local spreadsheet workspace* for opening and
editing the exported `.xlsx` when a user wants full spreadsheet power. If the team later decides an
embedded viewer is worthwhile, it should be isolated behind a dedicated route/component, never the
main shell, and kept behind `GRIDCRAFT_WEB_URL` (a dashboard link appears when that variable is
set).

## Running GridCraft locally (optional)

Verify commands against the checked-out revision; these are the documented ones:

```bash
cd gridcraft

# Desktop application
cargo run --release -p gridcraft

# Open an exported workbook in GridCraft
cargo run --release -p gridcraft -- /path/to/real-estate-export.xlsx

# Browser build (needs trunk + the wasm32-unknown-unknown target)
cd apps/gridcraft-web
trunk serve --release        # http://127.0.0.1:8771

# Repository quality checks
cargo xtask ci
```

Requirements: a recent Rust toolchain (the workspace pins `rust-version` in `Cargo.toml`), and for
the web build, `trunk` plus `rustup target add wasm32-unknown-unknown`.

None of these are required to run the CRM or to export Excel.
