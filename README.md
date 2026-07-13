# Infomap

Infomap is a personal daily briefing for AI and technology signals. It collects
public rankings and feeds once per day, normalizes them into one dataset, and
publishes a static dashboard on GitHub Pages.

## Included sources

- GitHub Trending
- Hacker News
- Hugging Face Papers
- Techmeme
- Stratechery
- Interconnects
- Latent Space
- Simon Willison

The collector keeps ten items per source, creates a cross-source daily Top 10,
and retains the latest 30 daily snapshots under `public/data/archive`.

## Local development

Requires Node.js 22 or newer.

```bash
npm install
npm run fetch
npm run dev
```

Open `http://localhost:3000`.

## Validation

```bash
npm run lint
npm run build
node --test tests/rendered-html.test.mjs
```

## GitHub Pages

The workflow in `.github/workflows/daily-pages.yml` runs every day at 07:30
Singapore time, refreshes the data, commits the daily archive, builds the static
site, and deploys it to GitHub Pages.

After pushing the repository to GitHub, open **Settings → Pages** and select
**GitHub Actions** as the source. Run the workflow manually once to publish the
first edition.

No API keys are required for the current source set. Future private keys should
be stored in GitHub Actions Secrets and used only by the collector.
