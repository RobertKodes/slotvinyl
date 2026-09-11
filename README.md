# slotvinyl

Live Solana **mainnet** as a vinyl cutting lathe. Not an explorer. Not a dashboard. Not a DJ app.

You are in the lacquer room after hours. The platter turns with the slot clock. The groove being cut is a sample of recent transactions, dyed by program family. Stylus glow is fee pressure. Failed txs leave oxblood skips in the acetate. Lift the cutter to freeze a take; while it is up you can drag the platter by hand.

Target live: https://robertkodes.github.io/slotvinyl/

## How to read the lathe

| Lathe | Chain |
| --- | --- |
| Platter rotation | Confirmed slot, ~33⅓-ish — eight slots per rev |
| Groove being cut | Sampled signatures (and a light `getBlock` density tick when the wire allows) |
| Color band | Program family: system, token, compute budget, dex (Jupiter/Raydium/Orca), stake, other |
| Stylus glow | `getRecentPrioritizationFees` median, log-scaled. Falls back to a dim idle if the meter flakes |
| Oxblood skip | `err` on a sampled signature |
| HOLD / cutter up | Freeze the sample. Drag the disc slowly. Spacebar works |

No wallet. No keys. Browser talks JSON-RPC and cuts.

## Palette

Named hex, late-night shop, six inks:

| Token | Hex | Use |
| --- | --- | --- |
| **lacquer** | `#0B0908` | Disc body, room pitch |
| **cream** | `#EDE4D0` | Center label |
| **aluminum** | `#A9A297` | Bed, carriage, screws |
| **amber** | `#E8A03A` | Stylus glow, fee heat |
| **oxblood** | `#7A1E28` | Failed txs / scratches |
| **cyan** | `#6AA8B0` | Token / cool program band |

Brass (`#B08A4A`) is the engraved plate — not a seventh brand color. Dex grooves pick up copper (`#C56A3C`) so they do not collide with amber.

## Type

- **Instrument Serif** — shop nameplate. Optical serif, not Inter, not a SaaS geometric.
- **IBM Plex Mono** — plate stamps, slot figures, the HOLD rocker. Reads as an instrument, not a terminal theme.

## Layout

Asymmetrical instrument desk: lamp over the left, lathe bed offset, brass plate racked a degree on the right. No centered hero. No three cards. No purple.

## Tinkerer notes

```bash
npm i
npm run dev
```

Vite serves at `/slotvinyl/`. Open that path, not `/`.

```bash
npm run build
```

must pass. GitHub Actions builds and publishes `dist/` to the `gh-pages` branch (base `/slotvinyl/`). `public/.nojekyll` rides along so GitHub Pages does not eat the files.

If Pages 404s after merge: GitHub repo Settings → Pages → source **`gh-pages` / root**. The workflow runs on `master` (and `workflow_dispatch`), so the live URL appears after merge, not on the PR branch.

Public RPC, rotating on failure (no keys):

- `solana-rpc.publicnode.com`
- `solana.publicnode.com`
- `api.mainnet-beta.solana.com` (fallback; some networks 403)

Override with `VITE_RPC_URL`. Methods: `getSlot`, `getRecentPerformanceSamples`, `getRecentPrioritizationFees`, a slow rotate of `getSignaturesForAddress` across program lanes, and an occasional `getBlock` with `transactionDetails: "signatures"` for density. If a method 4xxs we stop asking.

`prefers-reduced-motion`: disc still sits on the bed; spin and swarf chips stop. Groove still accumulates under the cutter.

HOLD freezes the cut queue. Drop the cutter to resume.
