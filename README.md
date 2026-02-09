# De Oostelijke Krant

Statische krant-site voor de Minecraft SMP van JaymianLee.

## Structuur
- `index.html` → home (laatste nieuws)
- `archive.html` → archief met edities
- `contact.html` → tips insturen via Twitch chat
- `editions/*.html` → losse krant-edities
- `data/issues.json` → index van alle edities (datum/auteur/slug)

## Workflow voor nieuwe editie
1. Jay geeft een opsomming van wat er gebeurd is.
2. Dirk maakt nieuwe `editions/YYYY-MM-DD-editie-X.html`.
3. Dirk voegt item toe in `data/issues.json`.
4. Push naar GitHub → online bijgewerkt.

Auteur standaard: **JaymianLee**.
