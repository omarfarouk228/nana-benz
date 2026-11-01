# Nana Benz · La reine du wax

Jeu de commerce dans le navigateur (PC et mobile). Lomé, décembre 1974 : ta tante t'a laissé sa place au **Grand marché d'Assigamé** et 60 000 F. Achète du wax au comptoir du port, garnis ton étal, **marchande** avec chaque cliente, monte ton réseau de revendeuses… jusqu'à t'offrir la **Benz**, comme les grandes commerçantes de wax de Lomé qu'on appelait les *Nana Benz*.

**Jouer : https://omarfarouk228.github.io/nana-benz/**

## Une journée

1. **Le matin, au comptoir du port** : les arrivages du jour. Quatre qualités (fancy, anglais, hollandais, super wax), des motifs à la mode ou démodés, des prix qui bougent avec les bateaux et les rumeurs.
2. **Ton étal** : tu choisis les tissus exposés (4 emplacements au début). Les clientes ne voient que ça.
3. **Le marché** (de 7 h à 18 h) : les clientes arrivent, regardent, attendent. Touche-en une pour la servir.
4. **Le marchandage** : elle fait une offre, tu annonces ton prix, elle remonte… ou s'en va. Tu peux vanter la qualité, parler de la mode ou du mariage, offrir un foulard. Chaque cliente a son caractère : la future mariée et sa mère, la trésorière de chorale qui veut 10 pièces du même motif, la revendeuse de Cotonou, l'étudiante, le commerçant d'Accra, la touriste…
   La scène se vit depuis l'étal : tu déplies le pagne sur le comptoir, elle le touche, hoche ou secoue la tête, répond après un temps de réflexion avec sa propre voix, pose ses billets que tu ramasses, puis repart avec le tissu plié.
5. **Le soir** : bilan, revendeuses à qui confier des pièces (Aného, Kpalimé, Atakpamé, Cotonou, Accra : elles reviennent avec l'argent… ou pas), améliorations (parasol, étal plus large, ta petite sœur au stand, magasin au port, boutique en dur, ton propre motif en exclusivité).

Le calendrier compte : samedis chargés, dimanches fermés, Noël, Nouvel An, fête de l'Indépendance, jours de pluie, jours de paie, grands mariages.

## Commandes

Tout se joue à la souris ou au doigt. La partie est sauvegardée automatiquement dans le navigateur.

## Technique

- [Vite](https://vite.dev) et JavaScript, sans moteur de jeu ni bibliothèque graphique : scène en Canvas 2D, interface en HTML et CSS.
- **Motifs wax générés par le programme** (`src/wax.js`) : seize familles de motifs (œil, hirondelles, bulles, losanges, éventail, feuilles, escargot, cauris, chevrons, disque, clés, fleurs, cage, ampoules, tam-tam, bandes), tuiles raccordables avec craquelures de cire. Aucun fichier image.
- Personnages dessinés en 2D (`src/people.js`), sons générés en WebAudio (`src/audio.js`).
- Moteur de commerce séparé de l'affichage (`src/game.js`) : modes, prix, clientèle, marchandage, revendeuses, sauvegarde.

```bash
npm install
npm run dev      # http://localhost:5174 (laisser le terminal ouvert)
npm run build
```

Chaque push sur `main` est déployé sur GitHub Pages.

| Fichier | Rôle |
| --- | --- |
| `src/main.js` | Écrans : titre, comptoir, marché, marchandage, soir, fin |
| `src/scene.js` | Scène du marchandage vue de l'étal : gestes, mains, billets, tissu |
| `src/game.js` | Règles et économie |
| `src/data.js` | Catalogue, clientèle, revendeuses, améliorations, calendrier, événements |
| `src/market.js` | Scène du Grand marché (Canvas 2D) |
| `src/wax.js` | Générateur de motifs wax |
| `src/people.js` | Portraits et silhouettes |
| `src/audio.js` | Sons |

## Crédits

Jeu original. Les surnoms des motifs (« L'œil de ma rivale », « Si tu sors, je sors », « Hirondelles »…) sont ceux qu'on entend sur les marchés d'Afrique de l'Ouest ; les dessins sont générés par le jeu. Hommage aux commerçantes de wax de Lomé.

Code © Omar Farouk. Tous droits réservés sauf mention contraire.
