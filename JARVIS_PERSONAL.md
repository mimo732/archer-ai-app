# JARVIS Android — branche personnelle de test

Branche : `jarvis-personal-fr-v1`

## Objectif

Adapter la base ARCHER en assistant JARVIS Android personnel, sans dépendre du serveur `space-z.ai`.

## Architecture Android actuelle

- Interface embarquée localement dans l'APK : `www/index.html`
- Pont natif Android conservé sous le nom technique `ArcherBridge` pour éviter de casser la compatibilité
- Reconnaissance vocale : dialogue vocal Android en français (`fr-FR`)
- Synthèse vocale : moteur TTS disponible dans la WebView Android
- Commandes locales : ouverture d'applications, recherches Google/YouTube, heure/date
- Mémoire simple : `localStorage` sur le téléphone
- IA : appel direct depuis Android vers OpenRouter
- Clé OpenRouter : stockée uniquement sur le téléphone, via `EncryptedSharedPreferences` quand disponible
- Aucun secret ou jeton API n'est stocké dans GitHub

## Ce qui ne dépend plus d'un serveur personnel

L'APK n'utilise plus `server.url` dans `capacitor.config.json`. Capacitor charge les fichiers du dossier `www` directement depuis l'application.

Une connexion Internet reste nécessaire uniquement pour les requêtes envoyées au modèle IA OpenRouter et pour les recherches Web.

## Test APK

Le workflow `.github/workflows/build-jarvis-android.yml` construit un APK debug nommé `JARVIS-test.apk` comme artefact GitHub Actions. Il ne crée pas de GitHub Release.

## Étapes suivantes

1. Valider la compilation GitHub Actions.
2. Installer l'APK de test sur l'OPPO.
3. Tester : micro français, voix, ouverture de Maps/YouTube/WhatsApp, clé OpenRouter et conversation.
4. Corriger les problèmes spécifiques ColorOS.
5. Ajouter ensuite un vrai service Android de premier plan + wake word « Jarvis » pour l'écoute en arrière-plan.
6. Ajouter les permissions/actions sensibles progressivement, avec confirmation avant appel/SMS ou autres actions critiques.

## Important

Cette branche est destinée aux essais personnels. Ne jamais committer une clé API, un mot de passe ou des données privées.
