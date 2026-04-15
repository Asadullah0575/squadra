# Squadra

> **Find your founding team. Build something real.**

Squadra is an open-source team-matching platform for builders, designers, and operators. Post your profile, filter by track, timezone, and role, and connect with the right people to form your squad — for hackathons, startups, or any project.

![Squadra](https://img.shields.io/badge/status-live-brightgreen?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square) ![HTML](https://img.shields.io/badge/built%20with-HTML%2FCSS%2FJS-f0db4f?style=flat-square)

---

## Features

- **Browse builders** — explore profiles filtered by track, role needed, and timezone
- **Post your profile** — list your skills, what you're building, and who you're looking for
- **Invite teammates** — send a one-click invite directly from any builder card
- **Live search** — instant filtering by name, skill, or role
- **Online status** — see who's active right now
- **Zero dependencies** — pure HTML, CSS, and vanilla JavaScript. No framework, no build step.

---

## Preview

| Browse & Filter | Post Profile |
|---|---|
| Filter by track, timezone, and role needed | Post your skills and what you're looking for |

---

## Getting Started

### Option 1 — Open directly

Since Squadra is a single HTML file with no dependencies, you can simply open it in your browser:

```bash
git clone https://github.com/Asadullah0575/squadra.git
cd squadra
open squadra.html   # macOS
# or double-click squadra.html on Windows/Linux
```

### Option 2 — Serve locally

```bash
# Python
python3 -m http.server 8080

# Node.js (npx)
npx serve .
```

Then visit `http://localhost:8080`.

### Option 3 — Deploy to GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Set source to `main` branch, `/ (root)`
3. Your site will be live at `https://asadullah0575.github.io/squadra`

---

## Project Structure

```
squadra/
└── squadra.html     # Entire app — markup, styles, and logic in one file
└── README.md
```

---

## Customisation

All configuration lives inside `squadra.html`. Key areas to edit:

| What | Where in the file |
|---|---|
| Seed builder profiles | `let DB = [...]` in the `<script>` block |
| Hackathon tracks | `<select id="pTrack">` in the modal + filter sidebar |
| Skill tags | `const SKILL_CLASS` and the skills picker buttons |
| Brand name / colors | CSS `:root` variables and `.logo` section in the nav |
| Track color styles | `const TRACK_STYLE` object |

---

## Roadmap

- [ ] Supabase backend — persist profiles across sessions
- [ ] Wallet-based auth (sign in with wallet)
- [ ] In-app messaging between builders
- [ ] Team formation & confirmation flow
- [ ] Profile edit / delete
- [ ] Email notifications on invite

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

```bash
git clone https://github.com/Asadullah0575/squadra.git
cd squadra
# make your changes to squadra.html
git checkout -b feat/your-feature
git commit -m "feat: describe your change"
git push origin feat/your-feature
```

Then open a pull request on GitHub.

---

## License

[MIT](LICENSE) — free to use, modify, and distribute.

---

<p align="center">Built with ⚡ by <a href="https://github.com/Asadullah0575">Asadullah0575</a></p>
