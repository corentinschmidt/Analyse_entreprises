# StockScore v5 — Déploiement sur Netlify

## Fichiers à déposer sur Netlify

Dépose les 5 fichiers suivants dans le même dossier :

```
stockscore_v5.html    ← l'application principale
manifest.json         ← configuration PWA
sw.js                 ← service worker (mode offline)
icon-192.png          ← icône app
icon-512.png          ← icône app haute résolution
```

---

## Étapes Netlify (5 minutes)

1. Va sur **netlify.com** → "Sign up" → compte gratuit (email ou GitHub)
2. Sur le dashboard, clique **"Add new site" → "Deploy manually"**
3. Glisse-dépose le **dossier** contenant les 5 fichiers ci-dessus
4. Netlify te donne une URL : `https://stockscore-xxxx.netlify.app`
5. *(Optionnel)* Renomme le site : Site settings → Change site name → `stockscore-monnom`

---

## Installation sur iPhone

1. Ouvre **Safari** (obligatoire, pas Chrome) sur ton iPhone
2. Va sur ton URL Netlify
3. Clique l'icône **Partager** (carré avec flèche en bas)
4. Appuie sur **"Sur l'écran d'accueil"**
5. Nomme l'app **"StockScore"** → Ajouter

L'app apparaît sur ton écran d'accueil comme une vraie application, en plein écran sans barre d'adresse.

## Installation sur Android

1. Ouvre **Chrome** sur ton Android
2. Va sur ton URL Netlify
3. Chrome affiche automatiquement une bannière **"Ajouter à l'écran d'accueil"**
   *(Si pas de bannière : menu ⋮ → "Ajouter à l'écran d'accueil")*
4. Confirme → l'icône StockScore apparaît

---

## Configuration des clés API dans l'app

Une fois l'app installée, entre tes clés une seule fois :
- **Groq** : console.groq.com → API Keys (gratuit)
- **Tavily** : app.tavily.com → API Keys (1000 req/mois gratuit)
- **NewsAPI** : newsapi.org → Get API Key (100 req/jour gratuit)

Les clés sont sauvegardées localement sur ton téléphone.

---

## Synchronisation PC ↔ Téléphone

Tes données (favoris, portefeuille) sont dans le navigateur local.
Pour synchroniser entre appareils :
1. Sur le PC → **"Exporter mes données"** → sauvegarde le .json
2. Sur le téléphone → **"Importer données"** → sélectionne le .json

---

## Mise à jour de l'app

Quand une nouvelle version est disponible :
1. Remplace `stockscore_v5.html` sur Netlify par le nouveau fichier
2. Sur ton téléphone, ferme et rouvre l'app — elle se met à jour automatiquement
3. Tes données sont préservées (localStorage)

---

*StockScore v5 — Analyseur IA · Groq LLaMA 3.3 · Tavily Web Search · NewsAPI · Yahoo Finance · FDA.gov · ClinicalTrials.gov*
