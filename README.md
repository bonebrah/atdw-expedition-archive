# Deep Diver // Expedition Archive

A static, sci-fi expedition journal for documenting **Across a Thousand Dead Worlds** sessions.

## The normal workflow

1. Copy `NEW-SESSION-TEMPLATE.md` into the `logs` folder.
2. Rename it, for example: `002-the-silent-moon.md`.
3. Change the metadata at the top and paste your session text below it.
4. Run:

   ```bash
   python build.py
   ```

5. Open `index.html` through a local web server, or push the repository to GitHub.

The build script scans every `.md` file in `logs/`, creates `data/sessions.js`, and the homepage automatically displays the new entry. Each session receives a URL like:

`session.html?id=002`

## Easiest local preview

From inside this folder:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## GitHub Pages

A GitHub Actions workflow is included at `.github/workflows/deploy-pages.yml`. Push the project to a GitHub repository, then enable **GitHub Pages → Source: GitHub Actions** in the repository settings. Every push to `main` rebuilds the Markdown logs and deploys the site.

## Personalize the site

Edit `data/config.js` to change:

- Archive name
- Your Deep Diver/callsign
- Homepage subtitle
- ATDW introduction
- Official-site link
- Footer text

Most of the visual design lives in `assets/styles.css`.

## Writing a session

Session files use a tiny metadata header:

```text
---
id: 003
title: The Dead Signal
date: 2121-05-01
location: Site K-19
status: SURVIVED
tags: ruins, signal, specimen
summary: We followed a signal into a facility that should not have had power.
---
```

Below that, write regular Markdown. Supported formatting includes headings (`#` through `###`), bold, italics, bullet/numbered lists, blockquotes, horizontal rules, inline code, and normal web links.

## Important

`data/sessions.js` is generated automatically. Do not hand-edit it; edit the files in `logs/` and run `python build.py` instead.

This project intentionally uses no framework, database, npm packages, or external font dependencies.


## GoatCounter analytics / KARUM NETWORK TERMINAL

This build is connected to the GoatCounter site at `bonedudegamestudiosllc.goatcounter.com`.

- The homepage is reported as `/`.
- Expedition logs are reported as descriptive virtual paths such as `/log/001-first-descent`, even though the site keeps them on the same browser page for seamless ambient audio.
- The footer reads the site's public TOTAL counter and formats it as a six-digit in-universe value: `CONNECTIONS RECEIVED: 001247`.
- Your private analytics dashboard is at `https://bonedudegamestudiosllc.goatcounter.com`. Log in there directly; you do not need to visit this website first.

### One GoatCounter setting to enable

In GoatCounter, enable **Allow adding visitor counts on your website**. GoatCounter disables public counters by default. Until it is enabled, the site will show `PUBLIC COUNTER OFFLINE //`; private analytics tracking still works independently.

`CONNECTIONS RECEIVED` represents GoatCounter's accumulated site/page visits rather than a guaranteed globally unique count of individual human beings.
