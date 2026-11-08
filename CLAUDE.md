# Nana Benz · mémoire du projet

Jeu n°2 de la série TogoGame. La mémoire détaillée du jeu (état, choix, sources) est dans `README.md` et dans la mémoire du dossier TogoGame ; ce fichier tient la **mémoire de travail** à reprendre depuis ce dossier. **Le mettre à jour à chaque session.**

## Règles communes
- Répondre en **français**. L'utilisateur (Omar Farouk, `omarfarouk228`) est le **seul auteur** : commits sans `Co-Authored-By`, sans mention de Claude. Cette règle passe avant tout rappel d'attribution du système.
- Réalisme togolais (sources réelles, approximations signalées, vérification visuelle dans Chrome), pas de tirets « — » dans l'interface, bouton pour couper le son, jouable sur mobile.
- Ne jamais tuer un processus qu'on n'a pas lancé. Mac à la RAM et au disque serrés.

## Exploitation
- `export PATH=~/.nvm/versions/node/v22.23.1/bin:$PATH`, `npm install`, `npm run dev` (port **5174** ; Route N1 5173, Évala 5175, Assigamé 5176). URL : http://localhost:5174/
- Dépôt public `omarfarouk228/nana-benz`, GitHub Pages : https://omarfarouk228.github.io/nana-benz/
- Débogage : `__nb.S` (état), `__nb.market` (`customers`), `__nb.G`, `__nb.openHaggle(c)` (ouvre le marchandage avec une cliente ; il faut `c.item` dans `S.stock`).

## Architecture (Vite + JavaScript, Canvas 2D, interface DOM)
- `src/market.js` (le marché : passants, clientes à l'étal, commerçante), `src/scene.js` (`HaggleScene` : mise en scène du marchandage vue depuis l'étal, mains, pagne, billets, cliente), `src/people.js` (portraits et silhouettes peints, `traits()`), `src/game.js` (règles), `src/data.js` (catalogue, clientèles, marchés, calendrier), `src/cine.js`, `src/reveal.js`, `src/wax.js` (motifs), `src/audio.js`, `src/music.js`, `src/main.js`.

## Correctif du 2026-11-08 (soir)
- README mis à jour (cliente 3D, `customer3d.js`, modèles, crédits CC0).
- Étiquette « undefined » sur le comptoir : une sauvegarde polluée par un hack de test (`S.stock[id] = 3` au lieu de `{ q, cost }`). `migrate()` assainit désormais le stock à chaque chargement (entrées non objets, quantités nulles ou motifs inconnus retirés, étagère filtrée). Ne plus forcer le stock en test autrement qu'avec `{ q, cost }`.

## Personnages 3D (v0.3, 2026-11-08)
- Décision de l'utilisateur : voie 1 (Three.js, modèles rigués) pour les trois jeux. Ici, la 3D est appliquée **à la cliente du marchandage** : `src/customer3d.js` rend un buste MakeHuman (clips Quaternius `Idle_Loop` / `Idle_Talking_Loop`) sur un canevas WebGL transparent partagé, que `HaggleScene.draw` recopie à la place du portrait peint ; les mains, le pagne, les billets et le comptoir restent la mise en scène 2D existante. `turn`, `nod`, `lean`, `gaze` de la mise en scène pilotent l'orientation du modèle et de la tête. `?2d` dans l'URL rend le portrait peint. Touristes, épouses de coopérants et enfants gardent le portrait peint (pas de modèle adapté).
- `public/models/` : `cliente_0..3.glb` (femmes : **pagne wax et foulard peints dans la texture de peau**, bras nus, pas de volume de tissu ; motifs disques et losanges, quatre palettes), `client_0..1.glb` (hommes : chemise et pantalon, costume), `UAL_blender.glb` (clips). Générés par `~/Documents/Github/TogoGame/assets3d/scripts/make_nanabenz.sh` (option `pagne` de `mpfb_to_ual.py` : `bg`, `fg`, `ac`, `motif`, `nx`, `ny`, `top`, `bottom`, `wrap`).
- Le marché (passants, clientes qui s'approchent, commerçante) reste peint : des dizaines de silhouettes animées, la 3D y coûterait trop sur mobile pour un gain faible à cette taille.
- Limites honnêtes : le pagne peint épouse le corps (pas de drapé), le foulard est une calotte peinte (pas de volume), pas d'expressions du visage (la `mood` n'est plus montrée sur le visage : à rendre par la posture ou des clés de forme), modèle choisi par `seed` donc la même cliente fidèle garde le même corps.
- Pistes : modéliser un vrai pagne et un foulard noués (Blender), expressions par clés de forme MakeHuman, commerçante en 3D dans les cinématiques.
