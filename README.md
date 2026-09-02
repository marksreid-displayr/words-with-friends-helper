# Best Move

Best Move is a private, installable web app that reads a Words With Friends screenshot and finds the ten highest-scoring legal plays. Image recognition, dictionary lookup, and move generation all happen in the browser; there is no backend and screenshots are never uploaded.

## Current support

- English Classic 15×15 Words With Friends scoring
- The calibrated 1320×2868 portrait iPhone layout represented by the two anonymized fixtures
- Multiple current tile themes, recent-move white letters, rack blanks, and existing blank tiles through review
- Offline use after the first visit
- Public-domain ENABLE dictionary plus local allow/block overrides

The game uses an unpublished and changing lexicon, so ENABLE will occasionally disagree. Use **Game rejects this word** on a result or the dictionary override panel to correct the local list.

## Development

Requirements: Node.js 22 or newer and npm.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

The real screenshot E2E check is deliberately opt-in so private source screenshots are never committed:

```bash
WWF_SCREENSHOT=/absolute/path/to/screenshot.png \
WWF_EXPECTED_RACK=TUDGYES \
npx playwright test --grep "real screenshot"
```

Only cropped board/rack fixtures without account information are stored in `src/test/fixtures`. If those fixtures change, regenerate the compact glyph masks with `npm run generate:glyphs`.

## Deployment

Push `main` to GitHub and enable **Settings → Pages → Source: GitHub Actions**. The included workflow runs unit and browser tests, builds the PWA with the `/words-with-friends-helper/` base path, and deploys `dist`.

If the repository has a different name, change `base` in `vite.config.ts` before deploying.

## Privacy and limitations

- Uploaded image objects live only in browser memory and are released after parsing.
- Dictionary overrides are saved in local browser storage.
- No analytics, accounts, API keys, or network image requests are used.
- Unsupported screenshot geometries fall back to best-effort board detection and the manual editor.
- Always review the parsed board and rack before solving.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for word-list and OCR attribution.
