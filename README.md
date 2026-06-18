# resa-massage

> Projet réalisé bénévolement dans le cadre d'un événement unique, et avant tout comme expérience d'apprentissage de l'IA appliquée au développement logiciel. L'ensemble du code a été co-conçu avec [Claude](https://claude.ai) (Anthropic) et la méthodologie [BMad](https://github.com/bmadcode/BMAD-METHOD) — de l'architecture initiale aux détails d'implémentation — pour explorer jusqu'où l'on peut aller avec ces outils.

Système de réservation de créneaux de massage pour événements. Construit avec Astro v6 + Cloudflare Workers + D1 (SQLite).

## Architecture

```
Participants  →  Page de réservation (/)
                 Page de confirmation (/booking/[token])

Praticien·nes →  Vue planning (/practitioner/[token])

Organisateurs →  Interface admin (/admin/*)

Relais SMS    →  App Android (android-sms-relay/)
                 Polling API (/api/v1/sms-jobs)
```

---

## Développement local

### Prérequis

- Node.js 20+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- Compte Cloudflare avec une base D1 créée

### Installation

```bash
npm install
```

### Variables d'environnement

Copier `.env.example` en `.dev.vars` (lu automatiquement par `wrangler dev`) :

```bash
cp .env.example .dev.vars
# Remplir les valeurs dans .dev.vars
```

Clés Turnstile de test (acceptent tout sans vérification) :
- Site key : `1x00000000000000000000AA`
- Secret key : `1x0000000000000000000000000000000AA`

### Lancer le serveur de développement

```bash
npm run dev
# ou
wrangler dev
```

### Migrations base de données

```bash
# Local
wrangler d1 migrations apply resa-massage --local

# Production
wrangler d1 migrations apply resa-massage --remote
```

---

## Déploiement

### Authentification Cloudflare

```bash
wrangler login
```

### Secrets de production

À configurer une seule fois via Wrangler (jamais dans wrangler.toml) :

```bash
wrangler secret put ADMIN_PASSWORD_HASH
wrangler secret put ADMIN_SESSION_SECRET
wrangler secret put TURNSTILE_SITE_KEY
wrangler secret put TURNSTILE_SECRET_KEY
wrangler secret put ANDROID_API_SECRET
```

### Build et déploiement

```bash
npm run build    # Build Astro
npm run deploy   # Deploy sur Cloudflare Workers
# ou en une commande :
wrangler deploy
```

### Régénérer les types Cloudflare

À relancer si `wrangler.toml` est modifié (bindings D1, KV, vars) :

```bash
npm run cf-typegen
# ou
wrangler types
```

---

## Génération des secrets

```bash
# Hash du mot de passe admin (bcrypt)
node -e "const b = require('bcryptjs'); b.hash('monmotdepasse', 12).then(console.log)"

# Clé de session (32 octets aléatoires)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Secret API Android (32 octets aléatoires)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## App Android (relais SMS)

L'application Android tourne en service de premier plan et poll l'API toutes les 30 secondes pour envoyer les SMS via le téléphone.

### Configuration

Créer `android-sms-relay/local.properties` :

```properties
SERVER_URL=https://exemple.com
API_SECRET=<valeur de ANDROID_API_SECRET>
```

### Build de l'APK

**Via Docker (recommandé — environnement reproductible) :**

```bash
cd android-sms-relay
./build.sh           # génère app-debug.apk dans le répertoire courant
./build.sh release   # génère app-release.apk
```

Les variables peuvent aussi être passées directement sans `local.properties` :

```bash
SERVER_URL=https://... API_SECRET=xxx ./build.sh
```

**En local (nécessite Android Studio ou SDK Android) :**

```bash
cd android-sms-relay
./gradlew assembleDebug
# APK : app/build/outputs/apk/debug/app-debug.apk
```

---

## Vérification / type-check

```bash
npm run lint
# ou
npm run type-check
```

---

## Structure du projet

```
src/
├── components/          # Composants Astro réutilisables
├── layouts/             # AdminLayout (nav mobile + desktop)
├── lib/
│   ├── db/              # Accès base de données (D1)
│   ├── admin-auth.ts    # Auth session admin
│   ├── practitioner-auth.ts
│   ├── polling.ts       # Polling client-side
│   ├── time.ts          # Heure locale Europe/Paris
│   └── turnstile.ts     # Vérification Cloudflare Turnstile
├── pages/
│   ├── api/             # Endpoints API REST
│   │   ├── admin/       # API admin (authentifiée)
│   │   ├── v1/          # API Android (Bearer token)
│   │   ├── bookings/    # Réservations participants
│   │   ├── practitioners/ # Planning praticien·nes
│   │   └── slots/       # Créneaux disponibles
│   ├── admin/           # Interface d'administration
│   ├── booking/         # Page de confirmation participant
│   └── practitioner/    # Vue planning praticien·ne
├── styles/
│   └── global.css       # Tailwind CSS v4
migrations/              # Migrations SQL D1
android-sms-relay/       # Application Android (relais SMS)
```
