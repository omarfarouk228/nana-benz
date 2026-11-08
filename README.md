# Nana Benz · La reine du wax

Jeu de commerce dans le navigateur (PC et mobile). Lomé, décembre 1974 : ta tante t'a laissé sa place au **Grand marché d'Assigamé** et 60 000 F. Achète du wax au comptoir du port, garnis ton étal, **marchande** avec chaque cliente, monte ton réseau de revendeuses… jusqu'à t'offrir la **Benz**, comme les grandes commerçantes de wax de Lomé qu'on appelait les *Nana Benz*.

**Jouer : https://omarfarouk228.github.io/nana-benz/**

## Une journée

1. **Le matin, au comptoir du port** : les arrivages du jour. Quatre qualités (fancy, anglais, hollandais, super wax), des motifs à la mode ou démodés, des prix qui bougent avec les bateaux et les rumeurs.
2. **Ton étal** : tu choisis les tissus exposés (4 emplacements au début). Les clientes ne voient que ça.
3. **Le marché** (de 7 h à 18 h) : les clientes arrivent, regardent, attendent. Touche-en une pour la servir.
3 bis. **Héler les passants** : ta commerçante crie un boniment, un passant proche peut se retourner et venir à l'étal (meilleures chances avec une bonne réputation, un tissu à la mode ou un parasol).
4. **Le marchandage** : elle fait une offre, tu annonces ton prix, elle remonte… ou s'en va. Tu peux vanter la qualité, parler de la mode ou du mariage, offrir un foulard. Chaque cliente a son caractère : la future mariée et sa mère, la trésorière de chorale qui veut 10 pièces du même motif, la revendeuse de Cotonou, l'étudiante, le commerçant d'Accra, la touriste…
   La scène se vit depuis l'étal : tu déplies le pagne sur le comptoir, elle le touche, hoche ou secoue la tête, répond après un temps de réflexion avec sa propre voix, pose ses billets que tu ramasses, puis repart avec le tissu plié. La cliente est un personnage en 3D (pagne wax et foulard, ou chemise et costume pour les commerçants), qui respire, parle et se détourne quand elle s'en va.
5. **Le soir** : bilan, revendeuses à qui confier des pièces (Aného, Kpalimé, Atakpamé, Cotonou, Accra : elles reviennent avec l'argent… ou pas), améliorations (parasol, étal plus large, ta petite sœur au stand, magasin au port, boutique en dur, ton propre motif en exclusivité).

Le calendrier compte : samedis chargés, dimanches fermés, Noël, Nouvel An, défilé du 13 janvier, semaine sainte, fête de l'Indépendance, jours de pluie, jours de paie, grands mariages.

## Au fil de la partie

- **Lire la cliente** : après chaque refus, ses gestes trahissent son vrai prix (elle recule, replie le tissu, le caresse, cherche son porte-monnaie). Les marchandes aguerries cachent mieux leur jeu.
- **Le prix juste fait la réputation** ; écorcher une cliente ou la vexer la fait baisser.
- **Clientes fidèles** : une cliente bien servie revient avec son nom, se souvient du prix de la dernière fois et en parle autour d'elle.
- **Des dialogues variés** : répliques propres à chaque clientèle, au temps qu'il fait, aux fêtes et à la mode du motif.
- **Nouveautés régulières** : nouvelles clientèles (famille en deuil, institutrice, couturière, commerçante de Lagos, épouse de coopérant, planteur de Kpalimé), une collection de motifs toutes les deux semaines.
- **Le crédit du comptoir** (réputation 15) : prendre le tissu maintenant, payer dans les 7 jours.
- **Baptiser un motif** (réputation 25) : comme les Nana Benz, donne un surnom à un motif ; s'il prend, il devient à la mode.
- **Ton pagne exclusif** : choisis son motif, ses couleurs, son nom et ton prix de vente.
- **D'autres marchés** : Adawlato, Bè, Aného, Kpalimé, chacun avec sa clientèle. Le matin, tu choisis où tu vends ; ailleurs, une gérante vend ton stock.
- **Te reposer** : reste à la maison, tes gérantes (et Afi à Assigamé) tiennent le marché ; le soir, un récapitulatif.
- **Les revendeuses** : un billet pour les motiver, et elles rentrent un jour plus tôt.
- **La rivale**, Mama Afiavi, rafle les arrivages à la mode, casse ses prix et court elle aussi vers sa Benz.
- **Le garage** : la Benz (3 000 000 F) donne un titre selon ta rapidité, puis viennent la 280 SE (5 M), la 450 SEL (15 M) et la 600 Pullman (40 M), chacune livrée avec sa grande scène. Ensuite, des ambitions de grande dame.
- **La saison** se termine à la fête de l'Indépendance, le 27 avril 1975 : sans la Benz, un classement selon ta fortune (on peut continuer).
- **Défi du jour** : la même semaine de marché pour tout le monde, un score à partager.
- **Coups durs** : la caisse ne passe jamais sous zéro ; la tontine, puis tante Ama, dépannent toujours.

Contexte historique utilisé : nationalisation des phosphates (2 février 1974), distribution du wax par les maisons de commerce (UAC, CFAO, SCOA) qui faisaient crédit aux commerçantes. Les noms de motifs baptisés, des collections et des clientes fidèles sont inventés pour le jeu, ainsi que la rivale.

## Commandes

Tout se joue à la souris ou au doigt, et au clavier : 1, 2, 3 servent une cliente, H hèle les passants ; pendant le marchandage, ← → changent le prix (Maj : par 500), Entrée propose, A accepte. Un bouton coupe le son. La partie est sauvegardée après chaque vente. Une fois chargé, le jeu fonctionne hors ligne.

## Technique

- [Vite](https://vite.dev) et JavaScript, sans moteur de jeu : marché et mise en scène en Canvas 2D, interface en HTML et CSS.
- **Motifs wax générés par le programme** (`src/wax.js`) : seize familles de motifs (œil, hirondelles, bulles, losanges, éventail, feuilles, escargot, cauris, chevrons, disque, clés, fleurs, cage, ampoules, tam-tam, bandes), tuiles raccordables avec craquelures de cire. Aucun fichier image.
- **Cliente du marchandage en 3D** avec [Three.js](https://threejs.org) (`src/customer3d.js`) : six personnages générés avec [MakeHuman](http://www.makehumancommunity.org) (MPFB2 dans Blender, actifs CC0), quatre femmes en pagne wax et foulard, deux hommes, animés par les clips de la [Universal Animation Library de Quaternius](https://quaternius.com) (CC0). Le buste est rendu sur un canevas transparent que la mise en scène peinte recopie à la place du portrait ; mains, pagne et billets restent peints. `?2d` dans l'adresse rend le portrait peint. Les touristes et les enfants gardent leur portrait peint.
- Passants, clientes du marché et commerçante dessinés en 2D (`src/people.js`), sons générés en Web Audio (`src/audio.js`).
- Moteur de commerce séparé de l'affichage (`src/game.js`) : modes, prix, clientèle, marchandage, revendeuses, sauvegarde.

```bash
npm install
npm run dev      # http://localhost:5174 (laisser le terminal ouvert)
npm run build
npm test         # règles et équilibrage (joueuses automatiques)
npm run sim      # jour médian de la Benz selon la façon de marchander
```

Chaque push sur `main` est déployé sur GitHub Pages.

| Fichier | Rôle |
| --- | --- |
| `src/main.js` | Écrans : titre, comptoir, marché, marchandage, soir, fin |
| `src/music.js` | Musique générée : cloche ewe en 12/8, hochet, basse, guitare highlife, kalimba |
| `src/cine.js` | Cinématiques de l'aube (plage de Lomé) et du soir (Grand marché) |
| `src/scene.js` | Scène du marchandage vue de l'étal : gestes, mains, billets, tissu |
| `src/customer3d.js` | Cliente en 3D (Three.js) : chargement, animation, cadrage |
| `src/game.js` | Règles et économie |
| `src/data.js` | Catalogue, clientèle, revendeuses, améliorations, calendrier, événements |
| `src/market.js` | Scène du Grand marché (Canvas 2D) |
| `src/wax.js` | Générateur de motifs wax |
| `src/people.js` | Portraits et silhouettes |
| `src/audio.js` | Sons |
| `src/reveal.js` | Le garage : voitures et scène de livraison |
| `public/models/` | Six clientes et clients (GLB) et la bibliothèque de clips |
| `public/sw.js` | Jeu hors ligne |
| `tests/` | Tests du moteur et joueuses automatiques |

## Crédits

Jeu original. Personnages 3D générés avec MakeHuman (actifs CC0) ; animations Quaternius (CC0). Les surnoms des motifs (« L'œil de ma rivale », « Si tu sors, je sors », « Hirondelles »…) sont ceux qu'on entend sur les marchés d'Afrique de l'Ouest ; les dessins sont générés par le jeu. Hommage aux commerçantes de wax de Lomé.

Code © Omar Farouk. Tous droits réservés sauf mention contraire.
