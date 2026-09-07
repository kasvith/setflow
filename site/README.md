# Setflow site

Static landing page for the extension, built with Astro. The hero runs a live mock of the popup
and the playlist overlay on the extension's own `src/shared` utils, so it stays in step with the code.

```bash
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # dist/
```

Release notes are fetched from the GitHub Releases API at build time and fall back to
`src/data/releases.json` when the API is unavailable. Refresh the snapshot now and then:

```bash
curl -s "https://api.github.com/repos/kasvith/setflow/releases?per_page=30" > src/data/releases.json
```

## Cloudflare Pages

| Setting          | Value        |
| ---------------- | ------------ |
| Root directory   | `site`       |
| Build command    | `pnpm build` |
| Output directory | `dist`       |

Node 24 is pinned in `.node-version`; set `NODE_VERSION=24` in the project's environment variables
if Pages does not pick it up.
