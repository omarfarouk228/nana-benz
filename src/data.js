// Données du jeu : catalogue de tissus, qualités, clientèle, revendeuses, améliorations, événements.
import { mulberry32, pick } from './util.js';

/* ------------------------------------------------------------ qualités de tissu (prix d'achat d'une pièce de 6 yards, années 1970) */
export const TIERS = {
  fancy: { name: 'Fancy', long: 'Imprimé fancy', buy: 1800, value: 3000, color: '#8a7f6a', desc: 'Imprimé simple, pour les petites bourses.' },
  anglais: { name: 'Anglais', long: 'Wax anglais', buy: 4200, value: 6800, color: '#2f6b8f', desc: 'Bonne tenue, venu par Accra.' },
  hollandais: { name: 'Hollandais', long: 'Wax hollandais', buy: 8200, value: 13000, color: '#9c2a2a', desc: 'Le vrai wax, couleurs qui ne bougent pas.' },
  super: { name: 'Super wax', long: 'Super wax, nouvelle collection', buy: 13500, value: 22000, color: '#b8860b', desc: 'La nouveauté que toutes les dames veulent.' },
};
export const TIER_ORDER = ['fancy', 'anglais', 'hollandais', 'super'];

/* ------------------------------------------------------------ catalogue de motifs (surnoms populaires) */
export const PALETTES = [
  ['#1d2f6f', '#f2c230', '#d0382b'], // indigo, jaune, rouge
  ['#f08a24', '#1e6b4a', '#4a2512'], // orange, vert, brun
  ['#f4efe4', '#1d2f6f', '#2f8fb0'], // blanc, indigo, turquoise
  ['#5b2a86', '#f2c230', '#e8e0cf'], // violet, jaune, crème
  ['#16120f', '#d0382b', '#e0a526'], // noir, rouge, or
  ['#0f6e6e', '#f08a24', '#f4efe4'], // sarcelle, orange
  ['#c2185b', '#3e2117', '#f2c230'], // fuchsia, brun, jaune
  ['#e0a526', '#2a1a12', '#c0392b'], // or, brun, rouge
  ['#2e7d32', '#f4efe4', '#f2c230'], // vert, blanc, jaune
  ['#8e2a1d', '#f4d9a8', '#1d2f6f'], // brique, sable, indigo
  ['#f2c230', '#1d2f6f', '#1e6b4a'], // jaune, indigo, vert
  ['#3d5a99', '#f08a24', '#f4efe4'], // bleu, orange
];
const NAMES = [
  ['L’œil de ma rivale', 'oeil'], ['Hirondelles', 'hirondelles'], ['Les bulles', 'bulles'], ['Losanges de Bè', 'losanges'],
  ['L’éventail', 'eventail'], ['Feuilles de manioc', 'feuilles'], ['L’escargot', 'escargot'], ['Cauris', 'cauris'],
  ['Le chemin du marché', 'zigzag'], ['Le disque', 'disques'], ['Les clés de la maison', 'cles'], ['Fleurs de mariage', 'fleurs'],
  ['Si tu sors, je sors', 'cage'], ['Ampoule', 'ampoules'], ['Le tam-tam', 'tambours'], ['Bandes de Kpalimé', 'kente'],
  ['Mon mari est capable', 'oeil'], ['Envol', 'hirondelles'], ['Pluie d’or', 'bulles'], ['Le grenier', 'losanges'],
  ['Éventail de la reine', 'eventail'], ['Jardin d’Assigamé', 'feuilles'], ['Lenteur', 'escargot'], ['Richesse', 'cauris'],
];
export const STYLES = {
  oeil: 'symboles', cage: 'symboles', cles: 'symboles', ampoules: 'symboles', disques: 'symboles',
  hirondelles: 'nature', feuilles: 'nature', fleurs: 'nature', escargot: 'nature', cauris: 'nature',
  bulles: 'géométrique', losanges: 'géométrique', zigzag: 'géométrique', eventail: 'géométrique', kente: 'géométrique', tambours: 'géométrique',
};
// les seize familles de motifs, pour dessiner son propre pagne
export const MOTIF_NAMES = { oeil: 'L’œil', hirondelles: 'Hirondelles', bulles: 'Bulles', losanges: 'Losanges', eventail: 'Éventail', feuilles: 'Feuilles', escargot: 'Escargot', cauris: 'Cauris', zigzag: 'Chemin', disques: 'Disques', cles: 'Clés', fleurs: 'Fleurs', cage: 'Cage', ampoules: 'Ampoules', tambours: 'Tam-tam', kente: 'Bandes' };
export const STYLE_ICONS = { symboles: '◎', nature: '❦', 'géométrique': '◆' };

// catalogue déterministe : chaque motif a une qualité, une palette et une graine
export const CATALOG = NAMES.map(([name, motif], i) => {
  const rng = mulberry32(1000 + i * 17);
  const pal = PALETTES[(i * 5 + 3) % PALETTES.length];
  const tier = i < 4 ? 'fancy' : TIER_ORDER[[0, 1, 1, 2, 2, 2, 1, 3][i % 8]];
  return {
    id: 'p' + i, name, motif, tier, style: STYLES[motif],
    spec: { motif, bg: pal[0], fg: pal[1], ac: pal[2], seed: 1 + Math.floor(rng() * 9999) },
  };
});
export const byId = Object.fromEntries(CATALOG.map((p) => [p.id, p]));

/* ------------------------------------------------------------ clientèle */
// mul : prix qu'elle juge normal par rapport à la valeur ; qty : pièces ; tiers : qualités acceptées ;
// patience : tours de marchandage ; skill : dureté en affaires ; args : argument qui la touche
export const PERSONAS = {
  fiancee: { label: 'Une future mariée et sa mère', mul: 1.3, qty: [2, 3], tiers: ['hollandais', 'super'], patience: 5, skill: 0.5, args: 'mariage', weight: 1.2, lines: ['C’est pour la dot de ma fille, il faut du beau.', 'Les belles-sœurs vont regarder le pagne, ma chère.'] },
  fonctionnaire: { label: 'L’épouse d’un fonctionnaire', mul: 1.15, qty: [1, 2], tiers: ['anglais', 'hollandais', 'super'], patience: 4, skill: 0.55, args: 'mode', weight: 2, lines: ['Qu’est-ce qui est à la mode cette semaine ?', 'Mon mari vient d’être nommé, je dois être belle dimanche.'] },
  chorale: { label: 'La trésorière d’une chorale', mul: 0.82, qty: [6, 12], tiers: ['fancy', 'anglais'], patience: 5, skill: 0.75, args: 'quantite', weight: 1, uniform: true, lines: ['Il nous faut le même pagne pour toute la chorale.', 'Pour l’uniforme de Pâques, fais-nous un prix de groupe.'] },
  revendeuse: { label: 'Une revendeuse de Cotonou', mul: 0.88, qty: [3, 6], tiers: ['anglais', 'hollandais'], patience: 6, skill: 0.85, args: 'revente', weight: 1.2, lines: ['Je prends plusieurs pièces, mais donne-moi le prix du gros.', 'Là-bas à Cotonou, on me paie mal, ma sœur.'] },
  etudiante: { label: 'Une étudiante', mul: 0.9, qty: [1, 1], tiers: ['fancy', 'anglais'], patience: 3, skill: 0.6, args: 'flatterie', weight: 1.6, lines: ['Je n’ai pas beaucoup, maman, aide-moi.', 'C’est pour la soirée de l’université.'] },
  ghaneen: { label: 'Un commerçant venu d’Accra', mul: 1.0, qty: [2, 4], tiers: ['anglais', 'hollandais'], patience: 4, skill: 0.8, args: 'revente', weight: 0.9, man: true, lines: ['Madam, give me good price.', 'Mon client à Accra veut du solide.'] },
  touriste: { label: 'Une touriste de passage', mul: 1.7, qty: [1, 2], tiers: ['hollandais', 'super', 'anglais'], patience: 3, skill: 0.25, args: 'qualite', weight: 0.5, lines: ['C’est magnifique ! C’est combien ?', 'Je veux rapporter un souvenir de Lomé.'] },
  fidele: { label: 'Une vieille cliente fidèle', mul: 1.05, qty: [1, 2], tiers: ['anglais', 'hollandais'], patience: 6, skill: 0.5, args: 'qualite', weight: 0.8, loyal: true, lines: ['Ma fille, je viens toujours chez toi.', 'Tu te souviens de moi ? J’ai acheté chez ta mère.'] },
  // clientèles qui arrivent au fil des semaines (unlock : jour, réputation ou marché)
  funerailles: { label: 'Une famille en deuil', mul: 0.95, qty: [4, 10], tiers: ['fancy', 'anglais'], patience: 5, skill: 0.6, args: 'quantite', weight: 0.9, uniform: true, unlock: { day: 6 }, lines: ['Nous enterrons notre père samedi. Toute la famille portera le même pagne.', 'Il faut du sombre, du digne. Fais-nous un prix, c’est le deuil.'] },
  institutrice: { label: 'Une institutrice de Tokoin', mul: 1.0, qty: [1, 2], tiers: ['anglais', 'hollandais'], patience: 4, skill: 0.6, args: 'mode', weight: 1.1, unlock: { day: 10 }, lines: ['C’est la fin du mois, je me fais plaisir.', 'Mes collègues vont être jalouses lundi.'] },
  couturiere: { label: 'Une couturière du quartier', mul: 0.92, qty: [2, 4], tiers: ['fancy', 'anglais', 'hollandais'], patience: 5, skill: 0.75, args: 'revente', weight: 1, unlock: { day: 15 }, lines: ['Mes clientes m’attendent pour les tenues de fête.', 'Je coupe pour tout le quartier, fais-moi un prix de pro.'] },
  lagos: { label: 'Une commerçante venue de Lagos', mul: 1.05, qty: [4, 8], tiers: ['hollandais', 'super'], patience: 5, skill: 0.85, args: 'revente', weight: 0.7, unlock: { rep: 30 }, lines: ['À Lagos, on s’arrache le hollandais en ce moment.', 'Je paie en liquide, mais je veux le bon prix.'] },
  planteur: { label: 'Un planteur de café de Kpalimé', mul: 1.25, qty: [2, 4], tiers: ['hollandais', 'super'], patience: 4, skill: 0.5, args: 'qualite', weight: 0.5, man: true, unlock: { market: 'kpalime' }, lines: ['La récolte a été bonne, je gâte mes femmes.', 'Donne-moi ce que tu as de plus beau.'] },
  epouse: { label: 'L’épouse d’un coopérant', mul: 1.45, qty: [1, 3], tiers: ['anglais', 'hollandais', 'super'], patience: 3, skill: 0.35, args: 'qualite', weight: 0.4, unlock: { day: 20 }, lines: ['On m’a dit que c’est ici qu’on trouve le vrai wax.', 'Je voudrais de quoi faire une robe et des coussins.'] },
};
// répliques supplémentaires : qu'une même clientèle ne dise pas toujours la même chose
const MORE_LINES = {
  fiancee: ['Le mariage est dans trois semaines, on court partout.', 'La famille du garçon est exigeante, montre-nous du solide.'],
  fonctionnaire: ['Il y a une réception à la préfecture samedi.', 'Montre-moi la nouvelle collection, pas les vieux motifs.'],
  chorale: ['Notre chorale chante à la cathédrale dimanche.', 'On est vingt, mais commençons par quelques pièces.'],
  revendeuse: ['Ce qui part bien chez moi, c’est le hollandais à la mode.', 'Si ton prix est bon, je reviens chaque semaine.'],
  etudiante: ['Mon grand frère m’a donné un peu pour la rentrée.', 'Mes copines ont toutes un pagne neuf, moi aussi je veux.'],
  ghaneen: ['My sister, this one is how much?', 'J’achète pour ma boutique de Makola.'],
  touriste: ['Mon guide m’a dit de marchander, c’est vrai ?', 'Les couleurs sont incroyables ici.'],
  fidele: ['Ta tante Ama m’a habillée pendant vingt ans.', 'Je suis venue à pied depuis Bè, alors sois gentille.'],
};
for (const [k, l] of Object.entries(MORE_LINES)) PERSONAS[k].lines.push(...l);

export const ARGUMENTS = {
  qualite: { label: 'Vanter la qualité', lines: ['Regarde, touche : c’est du vrai, les couleurs ne partent pas au lavage.', 'Sens la cire, ma sœur. Ça, c’est du tissu qui tient dix ans.', 'Lave-le cent fois, il restera comme ça. Je te le garantis.'] },
  mode: { label: 'Parler de la mode', lines: ['C’est le motif que toutes les dames portent à la messe en ce moment.', 'Hier encore, trois dames de la préfecture me l’ont demandé.', 'Celui-là, demain il n’y en aura plus au port.'] },
  mariage: { label: 'Parler du mariage', lines: ['Avec ça, la belle-famille va parler de toi pendant des années.', 'Pour une dot, il faut du beau. Personne ne pourra rien dire.', 'Le jour du mariage, c’est toi qu’on regardera, pas la mariée !'] },
  quantite: { label: 'Promettre un prix de groupe', lines: ['Pour toute la chorale, je vous mets le même beau tissu, personne n’aura le même.', 'Tu prends le lot, je te fais le prix du gros, comme aux grandes dames.', 'Pour un groupe, je fais un effort, mais il faut prendre tout.'] },
  revente: { label: 'Parler de revente', lines: ['Tu vas le revendre le double là-bas, je te le dis.', 'Chez toi, ce motif n’est pas encore arrivé : tu seras la première.', 'Tes clientes vont te l’arracher des mains.'] },
  flatterie: { label: 'Faire un compliment', lines: ['Ma fille, avec ton teint, ce motif est fait pour toi.', 'Avec ta taille, une robe dans ça et tout le quartier se retourne.', 'Tu as l’œil, toi : c’est mon plus beau pagne que tu as pris.'] },
};
// ce que dit la commerçante (le prix est inséré à la place de {p})
export const PLAYER_LINES = {
  propose: ['Je te le fais à {p}.', 'Pour toi, {p}.', 'Allez, {p}, et je ne gagne presque rien.', '{p}, c’est mon prix.', 'Regarde la qualité… {p}.', 'Bon, parce que c’est toi : {p}.', 'Je descends à {p}, pas plus.', '{p}. Même au port, tu ne trouveras pas moins.'],
  accept: ['D’accord, c’est bon pour moi.', 'Bon, tu as gagné. Prends-le.', 'Allez, on fait comme ça.', 'Pour te garder comme cliente, j’accepte.'],
  letgo: ['Désolée, je ne peux pas descendre plus bas.', 'À ce prix-là, je perds de l’argent, ma sœur.', 'Va voir à côté, tu reviendras.', 'Non, ça, je ne peux pas.'],
  gift: ['Tiens, je t’ajoute un foulard assorti.', 'Prends aussi ce foulard, c’est cadeau.', 'Je te mets un petit foulard dans le sachet.'],
};

export const REACTIONS = {
  insult: ['Tchrrr ! Tu me prends pour qui ?', 'Ah non ! À ce prix-là, j’achète une moto.', 'Tu veux me tuer, ma sœur ?', 'Eh Dieu ! Tu as vu ça où ?', 'Même au Plateau, on ne vend pas à ce prix !', 'Tu crois que mon mari est ministre ?', 'Hé ! Tu me vends le bateau avec ?', 'Tu rêves, toi. Réveille-toi !'],
  counter: ['Fais un geste, ma chère.', 'Diminue encore un peu.', 'Je te donne ça, c’est mon dernier prix.', 'On est ensemble, non ?', 'Regarde-moi bien : je te donne', 'Mets un peu d’eau dans ton vin.', 'Laisse un peu, je suis ta cliente.', 'Bon, j’ajoute un peu :', 'Il faut que je mange aussi, hein.', 'Arrange-moi, je reviendrai.'],
  accept: ['D’accord, emballe-le.', 'Bon, tu as gagné. Mets dans un sachet.', 'Ça me va. Que Dieu bénisse ton commerce.', 'Akpé ! Je le prends.', 'Marché conclu, ma sœur.', 'Tu es dure en affaires, mais c’est beau.', 'Emballe vite avant que je change d’avis !', 'C’est bon. Ma voisine va être jalouse.'],
  leave: ['Je vais voir à côté.', 'Ce sera pour une autre fois.', 'Tchip… Au revoir.', 'Je reviendrai quand tu seras raisonnable.', 'Laisse, je vais au port moi-même.', 'Ta voisine sera plus gentille.', 'Bon. On se reverra.'],
  nothing: ['Tu n’as pas ce que je cherche.', 'Hmm, rien ne me plaît aujourd’hui.'],
  argOk: ['C’est vrai, hein…', 'Hmm, tu sais parler, toi.', 'Ça, c’est bien dit.', 'Tu me tentes, là…', 'Ah bon ? Montre encore.'],
  argKo: ['Ce n’est pas ça qui m’intéresse.', 'Arrête tes histoires et donne le prix.', 'Les belles paroles, ça ne s’achète pas.', 'Garde ta salive, ma sœur.', 'Hmm. Le prix d’abord.'],
  gift: ['Ah, un foulard ? Tu es gentille.', 'Merci, ma sœur, ça fait plaisir.', 'Akpé ! Tu sais recevoir.', 'Toi, tu connais le commerce.'],
};
// répliques propres à chaque clientèle, mêlées aux répliques communes
export const PERSONA_REACTIONS = {
  fiancee: { counter: ['C’est pour un mariage, sois raisonnable.', 'La dot coûte déjà cher, ma fille…'], accept: ['Les belles-sœurs vont se taire, enfin !', 'Ma fille sera la plus belle.'], leave: ['On trouvera ailleurs pour le mariage.'] },
  fonctionnaire: { counter: ['Le salaire n’est pas encore tombé, fais un effort.', 'Mon mari compte chaque franc, tu sais.'], accept: ['Parfait pour la réception de samedi.'], insult: ['Je ne suis pas la femme du ministre, hein !'] },
  chorale: { counter: ['C’est pour l’église, Dieu te le rendra.', 'Pour toute la chorale, il faut un prix de groupe.'], accept: ['Alléluia ! La chorale sera belle.', 'Le pasteur va te bénir.'], leave: ['Nous prierons pour toi… et nous irons ailleurs.'] },
  revendeuse: { counter: ['Si je prends à ce prix, je ne gagne rien à Cotonou.', 'Donne-moi le prix du gros, je suis commerçante comme toi.'], accept: ['Bon. Si ça part bien, je reviens la semaine prochaine.'], leave: ['À Dantokpa, on me fait mieux que ça.'] },
  etudiante: { counter: ['Maman, je suis étudiante, aide-moi.', 'Je n’ai que ma bourse, tantie…'], accept: ['Merci tantie ! Mes copines vont mourir de jalousie.'], leave: ['Je vais demander à mon grand frère…'] },
  ghaneen: { counter: ['Madam, reduce small.', 'Make it small for me, I beg.'], accept: ['Okay, okay. Wrap it.', 'Good. My customers in Accra will like it.'], leave: ['No, Madam. Makola is cheaper.'], insult: ['Eh! Madam, why?'] },
  touriste: { counter: ['Hmm… et si je vous donne', 'Mon guide m’a dit de marchander :'], accept: ['Merveilleux ! Merci beaucoup !', 'Je vais le montrer à toute ma famille.'], leave: ['Je vais réfléchir, merci.'] },
  fidele: { counter: ['Ta tante me faisait mieux que ça, ma fille.', 'Je suis ta cliente depuis toujours…'], accept: ['Tu es bien la fille de ta famille.'], leave: ['Ta tante n’aurait jamais fait ça.'] },
  funerailles: { counter: ['C’est le deuil, ma sœur, aie pitié.', 'Toute la famille cotise, nous n’avons pas plus.'], accept: ['Que l’âme du défunt repose en paix. Merci.'], leave: ['Nous irons chez quelqu’un qui comprend le deuil.'] },
  institutrice: { counter: ['Avec un salaire d’institutrice ? Diminue.', 'Je compte bien, tu sais : ce n’est pas juste.'], accept: ['Très bien. Je reviendrai à la fin du mois.'] },
  couturiere: { counter: ['Je connais les prix, je suis dans le métier.', 'Mes clientes ne me paieront jamais ça.'], accept: ['Ça va faire de belles tenues.'] },
  lagos: { counter: ['In Lagos, this one is cheaper, my sister.', 'Comme à Balogun, fais-moi le prix.'], accept: ['Deal. I go come back.'] },
  planteur: { counter: ['Le café n’a pas encore été payé, patiente un peu.'], accept: ['Mes femmes vont être contentes !'] },
  epouse: { counter: ['C’est un peu cher pour moi…', 'Vous me faites un petit prix ?'], accept: ['Oh, c’est parfait, merci !'] },
};
// ce que la cliente dit en arrivant selon le jour
export const CONTEXT_LINES = {
  pluie: ['Avec cette pluie, fais vite, je dois rentrer.', 'Je suis trempée, alors sois gentille.'],
  casse: ['Ta voisine Mama Afiavi fait moins cher, tu sais.', 'À l’entrée, on brade aujourd’hui…'],
  paie: ['Le salaire est tombé, je me fais plaisir.'],
  feast: ['C’est la fête, il me faut du neuf !', 'Toute la famille veut un pagne pour la fête.'],
  trendUp: ['Tout le monde porte ce motif en ce moment !', 'C’est celui-là que je cherchais partout.'],
  trendDown: ['Hmm, ce motif-là, plus personne ne le porte…', 'Celui-là est un peu passé, non ?'],
  saturday: ['Le samedi, il y a trop de monde ici !'],
};

/* ------------------------------------------------------------ revendeuses (réseau à crédit) */
export const AGENTS = [
  { id: 'a1', name: 'Kossiwa', town: 'Aného', reliability: 0.92, cap: 4, days: 2 },
  { id: 'a2', name: 'Abla', town: 'Kpalimé', reliability: 0.85, cap: 6, days: 3 },
  { id: 'a3', name: 'Mawuéna', town: 'Atakpamé', reliability: 0.8, cap: 8, days: 4 },
  { id: 'a4', name: 'Dédé', town: 'Cotonou', reliability: 0.72, cap: 10, days: 3 },
  { id: 'a5', name: 'Akossiwa', town: 'Accra', reliability: 0.66, cap: 12, days: 5 },
];
// marges proposées aux revendeuses : plus tu demandes, plus elle tarde et plus le risque monte
export const MARGINS = [
  { id: 'doux', label: 'Prix doux', mul: 1.15, risk: 0, extra: 0 },
  { id: 'juste', label: 'Prix juste', mul: 1.3, risk: 0.06, extra: 1 },
  { id: 'fort', label: 'Prix fort', mul: 1.5, risk: 0.16, extra: 2 },
];

/* ------------------------------------------------------------ améliorations */
export const UPGRADES = [
  { id: 'parasol', name: 'Grand parasol', price: 15000, desc: 'De l’ombre : les clientes patientent plus longtemps et s’arrêtent plus volontiers.' },
  { id: 'etal', name: 'Étal plus large', price: 45000, desc: 'Deux emplacements de plus pour montrer tes tissus.' },
  { id: 'soeur', name: 'Ta petite sœur Afi au stand', price: 70000, desc: 'Elle sert seule les clientes simples à un prix juste pendant que tu marchandes.' },
  { id: 'magasin', name: 'Un magasin au port', price: 160000, desc: 'Tu peux stocker trois fois plus de pièces.' },
  { id: 'reseau', name: 'Carnet de revendeuses', price: 90000, desc: 'Deux revendeuses de plus dans ton réseau (Cotonou, Accra).' },
  { id: 'boutique', name: 'Boutique en dur au Grand marché', price: 600000, desc: 'Huit emplacements, plus de passage, et le comptoir te fait une remise de 8 %.', need: { rep: 40 } },
  { id: 'exclusif', name: 'Ton propre motif en exclusivité', price: 1200000, desc: 'Le comptoir imprime un motif à ton nom. Toi seule le vends, et il ne passe jamais de mode.', need: { rep: 55, upg: 'boutique' } },
];
export const BENZ_PRICE = 3000000;

/* ------------------------------------------------------------ le garage : des voitures de plus en plus chères */
// modèles Mercedes-Benz vendus dans les années 1970 ; la première est la « Benz » qui fait de toi une Nana Benz
export const CARS = [
  { id: 'benz200', name: 'Mercedes-Benz 200', price: 3000000, color: '#efe6d2', len: 1, desc: 'La berline des grandes commerçantes. Celle qui a donné leur nom aux Nana Benz.' },
  { id: 'se280', name: 'Mercedes-Benz 280 SE', price: 5000000, color: '#1d2f6f', len: 1.06, desc: 'La nouvelle Classe S, bleu nuit : tout Lomé se retourne.' },
  { id: 'sel450', name: 'Mercedes-Benz 450 SEL', price: 15000000, color: '#16120f', len: 1.12, desc: 'Le V8 des ministres et des ambassadeurs. Noire, avec chauffeur.' },
  { id: 'pullman', name: 'Mercedes-Benz 600 Pullman', price: 40000000, color: '#6e1623', len: 1.32, desc: 'La limousine des chefs d’État. Six portes. Une seule à Lomé : la tienne.' },
];

/* ------------------------------------------------------------ les autres marchés */
// le jeu commence à Assigamé ; on achète ensuite une place ailleurs, tenue par une gérante quand on n'y est pas
export const MARKETS = [
  { id: 'assigame', name: 'Grand marché d’Assigamé', short: 'Assigamé', sign: 'GRAND MARCHÉ DE LOMÉ', price: 0, rent: 600, crowd: 1, mix: {}, wall: '#d9c7a1', desc: 'Le cœur du commerce de Lomé, là où tout a commencé.' },
  { id: 'adawlato', name: 'Marché d’Adawlato', short: 'Adawlato', sign: 'MARCHÉ D’ADAWLATO', price: 150000, need: { rep: 20 }, rent: 500, crowd: 0.95, flow: 2, mix: { revendeuse: 2.2, ghaneen: 2, lagos: 1.6, couturiere: 1.4, touriste: 0.5 }, wall: '#cfb38a', desc: 'À deux pas du Grand marché : les revendeuses de la sous-région et les commerçants d’Accra y achètent en gros.' },
  { id: 'be', name: 'Marché de Bè', short: 'Bè', sign: 'MARCHÉ DE BÈ', price: 320000, need: { rep: 30 }, rent: 400, crowd: 0.9, flow: 2, mix: { fidele: 2.5, chorale: 1.8, funerailles: 2.2, fiancee: 1.3, touriste: 0.2, epouse: 0.3 }, wall: '#c9a77c', desc: 'Le vieux quartier éwé, près de la lagune : familles, chorales, funérailles. On y achète par fidélité.' },
  { id: 'aneho', name: 'Marché d’Aného', short: 'Aného', sign: 'MARCHÉ D’ANÉHO', price: 700000, need: { rep: 45 }, rent: 450, crowd: 0.9, flow: 3, mix: { fiancee: 2, touriste: 1.8, epouse: 1.6, fonctionnaire: 0.8 }, wall: '#e0cfa6', desc: 'L’ancienne capitale, entre mer et lagune : grands mariages et visiteurs de passage.' },
  { id: 'kpalime', name: 'Marché de Kpalimé', short: 'Kpalimé', sign: 'MARCHÉ DE KPALIMÉ', price: 1200000, need: { rep: 55 }, rent: 400, crowd: 1, flow: 3, mix: { planteur: 3, fonctionnaire: 1.2, etudiante: 0.6 }, wall: '#c8b892', desc: 'Le pays du café et du cacao : après la récolte, les planteurs ont la main large.' },
];
export const marketById = Object.fromEntries(MARKETS.map((m) => [m.id, m]));
export const MANAGER_WAGE = 800; // la gérante d'une place, chaque jour où elle tient l'étal

/* ------------------------------------------------------------ nouvelles collections au comptoir */
// toutes les deux semaines, le bateau apporte une collection nouvelle (noms inventés pour le jeu)
export const COLLECTIONS = [
  { day: 14, title: 'La collection de Noël', items: [['Étoile du berger', 'fleurs', 'hollandais'], ['La crèche', 'cage', 'anglais'], ['Cloches d’or', 'ampoules', 'super']] },
  { day: 28, title: 'La collection de la Bonne Année', items: [['Bonne arrivée', 'hirondelles', 'hollandais'], ['L’an nouveau', 'disques', 'super'], ['Le premier marché', 'zigzag', 'anglais']] },
  { day: 42, title: 'La collection du port autonome', items: [['Le grand bateau', 'kente', 'hollandais'], ['Les grues du port', 'losanges', 'anglais'], ['Containers', 'tambours', 'super']] },
  { day: 56, title: 'La collection des phosphates', items: [['Kpémé', 'bulles', 'hollandais'], ['La mine d’or gris', 'escargot', 'super'], ['Le wagon', 'cles', 'anglais']] },
  { day: 70, title: 'La collection de la lagune', items: [['La pirogue', 'feuilles', 'hollandais'], ['Le pont de Bè', 'zigzag', 'super'], ['Les palmiers de la plage', 'eventail', 'anglais']] },
  { day: 84, title: 'La collection de Pâques', items: [['Résurrection', 'oeil', 'super'], ['La chorale', 'cauris', 'hollandais'], ['Rameaux', 'feuilles', 'anglais']] },
  { day: 100, title: 'La collection de l’Indépendance', items: [['27 avril', 'disques', 'super'], ['Le drapeau', 'kente', 'hollandais'], ['La colombe', 'hirondelles', 'anglais']] },
];

/* ------------------------------------------------------------ calendrier et événements */
export const START = { y: 1974, m: 11, d: 2 }; // lundi 2 décembre 1974 (mois 0-11)
export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function dateOf(day) {
  const d = new Date(START.y, START.m, START.d + day);
  return { wd: d.getDay(), d: d.getDate(), m: d.getMonth(), y: d.getFullYear(), label: `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
}

// fêtes du calendrier qui font bondir la demande
export function feastOf(date) {
  if (date.m === 11 && date.d >= 18 && date.d <= 24) return { name: 'Préparatifs de Noël', mul: 1.7, text: 'Tout Lomé veut un pagne neuf pour la messe de minuit.' };
  if ((date.m === 11 && date.d >= 27) || (date.m === 0 && date.d <= 2)) return { name: 'Fêtes de fin d’année', mul: 1.5, text: 'Les familles s’habillent pour le Nouvel An.' };
  if (date.m === 3 && date.d >= 20 && date.d <= 26) return { name: 'Fête de l’Indépendance', mul: 1.5, text: 'Le 27 avril approche : les associations commandent leurs uniformes.' };
  if (date.m === 8 && date.d >= 1 && date.d <= 7) return { name: 'Epe Ekpe à Glidji', mul: 1.4, text: 'La fête de la pierre sacrée attire du monde jusqu’à Aného.' };
  if (date.m === 0 && date.d >= 8 && date.d <= 12) return { name: 'Défilé du 13 janvier', mul: 1.3, text: 'Les associations de femmes préparent le défilé de la fête nationale : il leur faut des pagnes assortis.', boost: 'chorale' };
  // Pâques 1975 tombe le 30 mars
  if (date.y === 1975 && date.m === 2 && date.d >= 22 && date.d <= 29) return { name: 'Semaine sainte', mul: 1.4, text: 'Pâques approche : les chorales commandent leurs uniformes.', boost: 'chorale' };
  return null;
}

export const RANDOM_EVENTS = [
  { id: 'pluie', w: 1.2, title: 'Grosse pluie', text: 'Il pleut à verse : le marché est presque vide aujourd’hui.', crowd: 0.55 },
  { id: 'bateau', w: 0.8, title: 'Le bateau est en retard', text: 'Le cargo d’Europe n’est pas arrivé : le comptoir augmente ses prix.', priceMul: 1.22 },
  { id: 'arrivage', w: 0.9, title: 'Gros arrivage au port', text: 'Le comptoir est plein à craquer : tout est moins cher ce matin.', priceMul: 0.85 },
  { id: 'rumeur', w: 1, title: 'Une rumeur court', text: 'On dit que la femme du ministre portait {p} hier soir. Toutes les dames le veulent.', trendUp: true },
  { id: 'malheur', w: 0.6, title: 'Mauvaise rumeur', text: 'On raconte que {p} porte malheur aux mariages. Plus personne n’en veut.', trendDown: true },
  { id: 'mariage', w: 0.7, title: 'Un grand mariage se prépare', text: 'La famille d’un notable cherche du wax hollandais pour toute la famille.', vip: 'fiancee' },
  { id: 'paie', w: 0.9, title: 'Jour de paie', text: 'Les fonctionnaires ont touché leur salaire : les dames ont de l’argent.', crowd: 1.3, rich: 1.12 },
  { id: 'calme', w: 1.4, title: 'Journée ordinaire', text: 'Le marché vit son rythme habituel.' },
  // l'État a repris les phosphates le 2 février 1974 : l'argent circule à Lomé
  { id: 'phosphates', w: 0.6, title: 'L’argent des phosphates', text: 'Depuis que l’État a repris les mines de phosphates, les cours flambent et l’argent circule à Lomé : les dames dépensent plus.', crowd: 1.1, rich: 1.1 },
  { id: 'rafle', w: 0.7, title: 'La rivale est passée avant toi', text: '{r} était au comptoir à l’aube : elle a raflé tout le {p}.', rival: 'rafle' },
  { id: 'casse', w: 0.6, title: 'La rivale casse ses prix', text: '{r} brade à l’entrée du marché : aujourd’hui, les clientes marchandent plus dur.', haggleMul: 0.92 },
];

/* ------------------------------------------------------------ la rivale, les clientes fidèles, les motifs baptisés */
export const RIVAL = { name: 'Mama Afiavi', start: 250000 };
// noms de clientes fidèles (éwé et mina ; les commerçants d'Accra portent des noms akan)
export const CLIENT_NAMES = {
  f: ['Afiwa', 'Adjoa', 'Kafui', 'Sena', 'Enyonam', 'Yawa', 'Dzifa', 'Mawussi', 'Elinam', 'Akouvi', 'Délali', 'Ablavi', 'Edem', 'Kayi'],
  m: ['Kofi', 'Kwame', 'Yaw', 'Kwesi', 'Kojo'],
};
export const CLIENT_TITLE = { fidele: 'Tantie', fiancee: 'Mama', fonctionnaire: 'Madame', chorale: 'Sœur', revendeuse: '', etudiante: '', ghaneen: 'Mister' };
// surnoms proposés quand on baptise un motif : dans l'esprit des noms du marché (inventés pour le jeu, sauf « Ton pied, mon pied »)
export const BAPTISMS = [
  'Ton pied, mon pied', 'Les yeux voient, la bouche se tait', 'Je cours plus vite que ma rivale', 'Mon mari m’a dit oui',
  'Petit à petit l’oiseau fait son nid', 'Ce que femme veut', 'Qui me connaît me suit', 'La route de Kpalimé',
  'Patience et longueur de temps', 'Ma belle-mère parle trop', 'Le fils de la reine', 'L’argent appelle l’argent',
  'La pluie ne mouille pas le léopard', 'Ma bouche est fermée', 'Le premier pas de l’enfant', 'Celle qui a fini de souffrir',
];
// fin de la saison : la fête de l'Indépendance, le 27 avril 1975
export const SEASON_END = { y: 1975, m: 3, d: 27 };
export function dayOfDate({ y, m, d }) { return Math.round((new Date(y, m, d) - new Date(START.y, START.m, START.d)) / 86400000); }
// titre obtenu selon le jour où l'on achète la Benz
export function rankOf(day) {
  if (day <= 35) return { title: 'Reine du wax', text: 'On n’avait jamais vu une commerçante monter aussi vite.' };
  if (day <= 50) return { title: 'Nana Benz', text: 'Te voilà parmi les grandes dames d’Assigamé.' };
  if (day <= 80) return { title: 'Grande dame d’Assigamé', text: 'Il t’a fallu de la patience, mais la Benz est à toi.' };
  return { title: 'Commerçante de Lomé', text: 'Tu as mis du temps, mais tu y es arrivée.' };
}
export function seasonRankOf(fortune) {
  if (fortune >= 1500000) return { title: 'Presque une Nana Benz', text: 'Il te manquait peu de chose : l’année prochaine sera la tienne.' };
  if (fortune >= 500000) return { title: 'Commerçante respectée', text: 'Ton étal est connu, ta caisse est solide.' };
  return { title: 'Petite commerçante', text: 'Le marché est dur. Tante Ama dit qu’elle aussi a commencé comme ça.' };
}
// ambitions après la Benz
export const AMBITIONS = [
  { id: 'reine', label: 'Devenir « Reine du marché » (réputation 80)', test: (s) => s.rep >= 80 },
  { id: 'reseau', label: 'Avoir trois revendeuses en route en même temps', test: (s) => s.agents.length >= 3 },
  { id: 'clientes', label: 'Compter dix clientes fidèles', test: (s) => s.clients.length >= 10 },
  { id: 'motifs', label: 'Baptiser trois motifs qui prennent', test: (s) => Object.keys(s.names).length >= 3 },
  { id: 'ecole', label: 'Mettre 1 500 000 F de côté pour les études de ta fille', test: (s) => s.won && s.money >= 1500000 },
  { id: 'seconde', label: 'Une seconde Benz, pour ta fille (3 000 000 F)', test: (s) => s.won && s.money >= 3000000 },
];

export const PLAYER_NAMES = ['Dédévi', 'Ayaba', 'Mama Kossi', 'Patience', 'Akpénè'];
export const randomName = (rng) => pick(rng, PLAYER_NAMES);

// motifs des collections, ajoutés au catalogue
export const COLLECTION_PATTERNS = COLLECTIONS.flatMap((col, ci) => col.items.map(([name, motif, tier], j) => {
  const pal = PALETTES[(ci * 3 + j * 5 + 1) % PALETTES.length];
  return { id: `k${ci}${j}`, name, motif, tier, style: STYLES[motif], col: ci, spec: { motif, bg: pal[0], fg: pal[1], ac: pal[2], seed: 300 + ci * 31 + j * 7 } };
}));
for (const p of COLLECTION_PATTERNS) byId[p.id] = p;
