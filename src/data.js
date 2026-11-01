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
const PALETTES = [
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
};

export const ARGUMENTS = {
  qualite: { label: 'Vanter la qualité', line: 'Regarde, touche : c’est du vrai, les couleurs ne partent pas au lavage.' },
  mode: { label: 'Parler de la mode', line: 'C’est le motif que toutes les dames portent à la messe en ce moment.' },
  mariage: { label: 'Parler du mariage', line: 'Avec ça, la belle-famille va parler de toi pendant des années.' },
  quantite: { label: 'Promettre un prix de groupe', line: 'Pour toute la chorale, je vous mets le même beau tissu, personne n’aura le même.' },
  revente: { label: 'Parler de revente', line: 'Tu vas le revendre le double là-bas, je te le dis.' },
  flatterie: { label: 'Faire un compliment', line: 'Ma fille, avec ton teint, ce motif est fait pour toi.' },
};

export const REACTIONS = {
  insult: ['Tchrrr ! Tu me prends pour qui ?', 'Ah non ! À ce prix-là, j’achète une moto.', 'Tu veux me tuer, ma sœur ?'],
  counter: ['Fais un geste, ma chère.', 'Diminue encore un peu.', 'Je te donne ça, c’est mon dernier prix.', 'On est ensemble, non ?'],
  accept: ['D’accord, emballe-le.', 'Bon, tu as gagné. Mets dans un sachet.', 'Ça me va. Que Dieu bénisse ton commerce.'],
  leave: ['Je vais voir à côté.', 'Ce sera pour une autre fois.', 'Tchip… Au revoir.'],
  nothing: ['Tu n’as pas ce que je cherche.', 'Hmm, rien ne me plaît aujourd’hui.'],
  argOk: ['C’est vrai, hein…', 'Hmm, tu sais parler, toi.'],
  argKo: ['Ce n’est pas ça qui m’intéresse.', 'Arrête tes histoires et donne le prix.'],
  gift: ['Ah, un foulard ? Tu es gentille.', 'Merci, ma sœur, ça fait plaisir.'],
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
];

export const PLAYER_NAMES = ['Dédévi', 'Ayaba', 'Mama Kossi', 'Patience', 'Akpénè'];
export const randomName = (rng) => pick(rng, PLAYER_NAMES);
