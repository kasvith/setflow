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

## Deploy

The site runs as a Cloudflare Worker serving static assets, configured in `wrangler.json`
(assets from `dist/`, build command, and the `setflow.kasvith.me` custom domain).

From a machine that has run `wrangler login`:

```bash
pnpm deploy    # builds, then uploads dist/ and binds the domain
```

Or connect the repo under Workers & Pages in the Cloudflare dashboard with root directory `site`,
build command `pnpm build`, and deploy command `pnpm exec wrangler deploy`. Node 24 is pinned in
`.node-version`.
