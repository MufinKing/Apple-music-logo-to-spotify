# Logos Apple Music pour Spotify

[English](README.md) · **Français**

Affiche les **logos d'artistes d'Apple Music** sur les pages artiste de Spotify, à la place du nom en texte.

Apple Music permet aux artistes d'ajouter un logo à leur profil. Cette extension [Spicetify](https://spicetify.app) apporte ces logos dans l'application Spotify pour ordinateur. Si l'artiste n'a pas de logo, le nom en texte habituel reste affiché.

<!-- Ajoute une capture d'écran : ![Une page artiste avec son logo](docs/screenshot.png) -->

## Fonctionnement

```
Spotify (cette extension Spicetify)
   │ 1. trouve l'artiste avec l'API de recherche iTunes d'Apple (depuis ton ordinateur)
   │ 2. demande le logo à ton Worker Cloudflare
   ▼
Ton Worker Cloudflare
   │ 3. lit la page Apple Music de l'artiste et trouve l'image du logo
   │ 4. récupère l'image et la renvoie
   ▼
Spotify affiche le logo à la place du nom de l'artiste
```

Un Worker est nécessaire parce que Spotify ne peut pas lire directement les pages web d'Apple Music (règles CORS des navigateurs). **Chaque utilisateur déploie son propre Worker.** L'offre gratuite de Cloudflare suffit largement pour une personne (100 000 requêtes par jour au moment de la rédaction).

## Prérequis

- L'**application Spotify pour ordinateur** avec [Spicetify](https://spicetify.app) installé (ça ne marche pas dans le lecteur web)
- Un compte [Cloudflare](https://dash.cloudflare.com) gratuit
- Développé et testé sous macOS. Windows et Linux devraient fonctionner mais ne sont pas testés.

## Installation

### 1. Déployer ton Worker

**Avec le tableau de bord (aucun outil à installer)**

1. Dans le tableau de bord Cloudflare, ouvre **Workers & Pages** et crée un Worker (un nom au choix, par exemple `apple-logos`). Les libellés des menus changent de temps en temps.
2. Déploie le code par défaut, puis choisis **Edit code**, remplace tout par le contenu de [`worker.js`](worker.js) et redéploie.
3. Copie l'URL de ton Worker, du type `https://apple-logos.<ton-sous-domaine>.workers.dev`.

**Ou en ligne de commande** (Node 18+) : `npx wrangler login`, puis `npx wrangler deploy` dans ce dossier.

**Test :** ouvre `https://<url-de-ton-worker>/logo?name=Eminem` dans un navigateur. Tu dois voir une image de logo. Ajoute `&debug=1` pour obtenir un diagnostic JSON (`version`, `template`, et le résultat de chaque essai d'image dans `tries`).

### 2. Installer l'extension

1. Ouvre [`apple-logos.js`](apple-logos.js) dans un éditeur de texte et remplace `API` par l'URL de ton Worker, en gardant la fin `/logo?name=` :
   ```js
   const API = "https://apple-logos.ton-sous-domaine.workers.dev/logo?name=";
   ```
2. Copie le fichier dans le dossier `Extensions` de Spicetify :
   - macOS / Linux : `cp apple-logos.js "$(spicetify path userdata)/Extensions/"`
   - Windows (PowerShell) : `Copy-Item apple-logos.js "$(spicetify path userdata)\Extensions\"`
3. Active-la et applique :
   ```
   spicetify config extensions apple-logos.js
   spicetify apply
   ```
4. Quitte complètement Spotify, rouvre-le et ouvre une page artiste.

Après chaque mise à jour de Spotify, relance `spicetify apply`.

## Réglages

En haut de `apple-logos.js` :

| Réglage | Défaut | Rôle |
|---|---|---|
| `API` | valeur d'exemple | L'URL de ton Worker, terminée par `/logo?name=` |
| `COUNTRY` | `"fr"` | Code pays à deux lettres du store Apple Music utilisé pour chercher l'artiste. Mets le tien. |
| `POSITION` | `"center"` | `"center"` ou `"right"` : en bas du bandeau, sur la ligne des auditeurs mensuels. `"inline"` : au-dessus du nom, à gauche. |
| `HEIGHT` | `72` | Hauteur du logo en pixels |
| `PLATE` | `"#fff"` | Fond derrière les logos sombres, invisibles sur le bandeau sombre de Spotify. `""` le désactive. |
| `DEBUG` | `false` | `true` affiche de petites notifications dans Spotify (logo affiché, pas de logo, qui a fait la recherche) |
| `TITLE` | sélecteur du titre Spotify | Emplacement du nom de l'artiste dans la page. À changer si Spotify modifie son affichage. |
| `LISTENERS` | anglais / français | Texte servant à repérer le bandeau de l'artiste. Ajoute ta langue si le logo est mal placé. |

Le Worker a le même réglage `COUNTRY` en haut de `worker.js`. Garde les deux identiques.

## Dépannage

| Symptôme | Cause et solution |
|---|---|
| Notification « set your Worker URL » | Modifie `API` dans `apple-logos.js` (étape 2.1), puis recopie le fichier. |
| Notification « logo server unreachable » | L'URL du Worker est fausse ou le Worker est en panne. Ouvre l'URL de test de l'étape 1 dans un navigateur. |
| Notification rouge mentionnant `iTunes search … Rate limit` | Apple limite les recherches par adresse IP. L'extension cherche normalement depuis ton ordinateur, donc cette recherche a échoué aussi. Attends quelques minutes et revisite l'artiste. |
| Notification « artist title not found » | Spotify a changé son affichage. Ajuste `TITLE` (inspecte le nom de l'artiste avec les outils de développement de Spicetify). |
| Le nom en texte reste | Normal : l'artiste n'a pas de logo Apple Music, ou les noms diffèrent. Mets `DEBUG = true` pour voir ce qui se passe. |
| Logo peu visible | Ajuste `PLATE`, ou mets-le à `""`. |
| `Extension "apple-logos.js" not found` au moment d'appliquer | Le fichier n'est pas dans le dossier `Extensions`, ou porte un autre nom. Vérifie avec `ls "$(spicetify path userdata)/Extensions"`. |

Pour un problème côté Worker, ouvre `https://<url-de-ton-worker>/logo?name=<Artiste>&debug=1` : il montre l'artiste trouvé, le gabarit et chaque essai d'image.

## Limites

- Seuls les artistes ayant ajouté un logo sur Apple Music en ont un. La fonctionnalité est récente, donc beaucoup n'en ont pas.
- Le nom de l'artiste doit correspondre exactement (casse, accents et ponctuation sont ignorés). Les homonymes ou orthographes différentes n'ont pas de logo plutôt qu'un mauvais.
- Le projet dépend de la structure des pages d'Apple Music et de l'affichage de Spotify. Aucun des deux n'est documenté et ils peuvent changer et casser l'extension.
- Les logos sont conçus pour les fonds d'Apple Music. Les logos sombres reçoivent une plaque claire sur Spotify.
- Application pour ordinateur uniquement.

## Confidentialité

Les noms d'artistes que tu consultes sont envoyés à l'API de recherche iTunes d'Apple depuis ton ordinateur, et à ton propre Worker, qui contacte Apple Music et les serveurs d'images d'Apple. Il n'y a aucune mesure d'audience et rien n'est envoyé ailleurs. Ton Worker est accessible à quiconque connaît son URL, ne la partage donc pas.

## Avertissement

Projet personnel non officiel, sans lien avec Apple, Spotify, Cloudflare ni Spicetify. Spicetify modifie le client Spotify, ce qui peut aller à l'encontre des conditions d'utilisation de Spotify. Ce projet lit des pages web et des images publiques d'Apple sans API officielle, ce qui peut aller à l'encontre des conditions d'Apple. Les logos appartiennent à leurs artistes et ayants droit : ce projet n'en stocke aucun et est destiné à un usage personnel. Utilisation à tes risques.

## Développement

`npm test` (Node 18+) lance les tests du Worker avec un réseau simulé. L'extension n'a pas de tests automatisés.

## Licence

[MIT](LICENSE)
