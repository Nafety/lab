/** Étoile : nom, ascension droite (heures), déclinaison (degrés), magnitude (plus petit = plus brillant). */
export type Star = [name: string, ra: number, dec: number, mag: number];

export interface Constellation {
  name: string;
  /** Article Wikipédia, pour la description chargée en direct. */
  wiki: string;
  stars: Star[];
  lines: [number, number][];
  info: string;
}

export const CONSTELLATIONS: Constellation[] = [
  {
    name: 'La Grande Ourse',
    wiki: 'Grande Ourse',
    stars: [
      ['Dubhe', 11.062, 61.75, 1.8], ['Merak', 11.031, 56.38, 2.4], ['Phecda', 11.897, 53.69, 2.4], ['Megrez', 12.257, 57.03, 3.3],
      ['Alioth', 12.9, 55.96, 1.8], ['Mizar', 13.399, 54.93, 2.2], ['Alkaid', 13.792, 49.31, 1.9],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
    info: "Ses sept étoiles les plus brillantes dessinent la « Grande Casserole ». En prolongeant environ cinq fois le bord de la casserole (de Merak vers Dubhe), on tombe sur l'étoile Polaire, qui indique le nord.",
  },
  {
    name: 'La Petite Ourse',
    wiki: 'Petite Ourse',
    stars: [
      ['Polaire', 2.53, 89.26, 2.0], ['Yildun', 17.537, 86.59, 4.4], ['ε UMi', 16.766, 82.04, 4.2], ['ζ UMi', 15.734, 77.79, 4.3],
      ['η UMi', 16.292, 75.76, 5.0], ['Pherkad', 15.345, 71.83, 3.0], ['Kochab', 14.845, 74.16, 2.1],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 6], [6, 5], [5, 4], [4, 3]],
    info: "Au bout de sa queue brille l'étoile Polaire, presque exactement au-dessus du pôle Nord. Elle paraît immobile pendant que tout le ciel tourne autour d'elle : les marins s'en servaient pour se repérer.",
  },
  {
    name: 'Cassiopée',
    wiki: 'Cassiopée (constellation)',
    stars: [['Caph', 0.153, 59.15, 2.3], ['Schedar', 0.675, 56.54, 2.2], ['Navi', 0.945, 60.72, 2.4], ['Ruchbah', 1.43, 60.24, 2.7], ['Segin', 1.907, 63.67, 3.4]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
    info: "Reconnaissable à sa forme de W (ou de M, selon l'heure). Dans la mythologie grecque, Cassiopée était une reine si vaniteuse qu'elle fut condamnée à tourner autour du pôle, parfois la tête en bas.",
  },
  {
    name: 'Orion',
    wiki: 'Orion (constellation)',
    stars: [
      ['Bételgeuse', 5.919, 7.41, 0.5], ['Rigel', 5.242, -8.2, 0.1], ['Bellatrix', 5.419, 6.35, 1.6], ['Mintaka', 5.533, -0.3, 2.2],
      ['Alnilam', 5.603, -1.2, 1.7], ['Alnitak', 5.679, -1.94, 1.8], ['Saiph', 5.796, -9.67, 2.1], ['Meissa', 5.585, 9.93, 3.4],
    ],
    lines: [[7, 0], [7, 2], [0, 5], [2, 3], [3, 4], [4, 5], [5, 6], [3, 1]],
    info: "Le chasseur géant de la mythologie. Ses trois étoiles alignées forment sa célèbre ceinture. Bételgeuse, son épaule rouge, est une supergéante si énorme que, placée à la place du Soleil, elle engloutirait l'orbite de Mars.",
  },
  {
    name: 'La Croix du Sud',
    wiki: 'Croix du Sud',
    stars: [['Acrux', 12.443, -63.1, 0.8], ['Mimosa', 12.795, -59.69, 1.3], ['Gacrux', 12.519, -57.11, 1.6], ['Imai', 12.252, -58.75, 2.8], ['Ginan', 12.356, -60.4, 3.6]],
    lines: [[2, 0], [1, 3]],
    info: "La plus petite des 88 constellations, visible seulement depuis l'hémisphère sud. Elle aide à trouver le pôle Sud céleste, et elle figure sur les drapeaux de l'Australie, de la Nouvelle-Zélande et du Brésil.",
  },
  {
    name: 'Le Scorpion',
    wiki: 'Scorpion (constellation)',
    stars: [
      ['Antarès', 16.49, -26.43, 1.0], ['Graffias', 16.09, -19.81, 2.6], ['Dschubba', 16.006, -22.62, 2.3], ['π Sco', 15.981, -26.11, 2.9],
      ['σ Sco', 16.353, -25.59, 2.9], ['τ Sco', 16.598, -28.22, 2.8], ['ε Sco', 16.836, -34.29, 2.3], ['μ Sco', 16.864, -38.05, 3.0],
      ['ζ Sco', 16.91, -42.36, 3.6], ['η Sco', 17.203, -43.24, 3.3], ['Sargas', 17.622, -43.0, 1.9], ['ι Sco', 17.793, -40.13, 3.0],
      ['κ Sco', 17.708, -39.03, 2.4], ['Shaula', 17.56, -37.1, 1.6],
    ],
    lines: [[1, 2], [2, 3], [2, 4], [4, 0], [0, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13]],
    info: "Son cœur est Antarès, une supergéante rouge dont le nom signifie « rival de Mars » à cause de sa couleur. Selon la légende, c'est ce scorpion qui piqua Orion : les deux constellations sont à l'opposé dans le ciel et ne se croisent jamais.",
  },
  {
    name: 'Le Lion',
    wiki: 'Lion (constellation)',
    stars: [
      ['Régulus', 10.14, 11.97, 1.4], ['η Leo', 10.122, 16.76, 3.5], ['Algieba', 10.333, 19.84, 2.0], ['Adhafera', 10.278, 23.42, 3.4],
      ['Rasalas', 9.88, 26.01, 3.9], ['ε Leo', 9.764, 23.77, 3.0], ['Zosma', 11.235, 20.52, 2.6], ['Chertan', 11.237, 15.43, 3.3],
      ['Denebola', 11.818, 14.57, 2.1],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 8], [8, 7], [7, 0], [6, 7]],
    info: "Sa tête et sa crinière forment un point d'interrogation à l'envers, la « faucille ». Régulus, son étoile la plus brillante, se trouve presque sur le chemin du Soleil : la Lune passe parfois juste devant elle.",
  },
  {
    name: 'Le Cygne',
    wiki: 'Cygne (constellation)',
    stars: [['Deneb', 20.69, 45.28, 1.3], ['Sadr', 20.37, 40.26, 2.2], ['Albireo', 19.512, 27.96, 3.1], ['Gienah', 20.77, 33.97, 2.5], ['δ Cyg', 19.75, 45.13, 2.9]],
    lines: [[0, 1], [1, 2], [3, 1], [1, 4]],
    info: "On l'appelle aussi la « Croix du Nord ». Deneb, au bout de sa queue, est l'une des étoiles les plus lumineuses connues : elle brille des dizaines de milliers de fois plus que le Soleil, mais elle est très, très loin.",
  },
];

export interface Planet {
  id: string;
  wiki: string;
  name: string;
  texture: string;
  info: string;
  ring?: boolean;
}

export const PLANETS: Planet[] = [
  { id: 'mercury', wiki: 'Mercure (planète)', name: 'Mercure', texture: 'mercury.jpg', info: 'La plus petite planète et la plus proche du Soleil. Une année y dure seulement 88 jours terrestres.' },
  { id: 'venus', wiki: 'Vénus (planète)', name: 'Vénus', texture: 'venus_atmosphere.jpg', info: "La planète la plus chaude (environ 465 °C), à cause d'un effet de serre extrême. Elle tourne à l'envers, et un jour y dure plus longtemps qu'une année !" },
  { id: 'mars', wiki: 'Mars (planète)', name: 'Mars', texture: 'mars.jpg', info: "La planète rouge doit sa couleur à la rouille (oxyde de fer) de son sol. Elle abrite Olympus Mons, le plus haut volcan du système solaire : environ 22 km de haut." },
  { id: 'jupiter', wiki: 'Jupiter (planète)', name: 'Jupiter', texture: 'jupiter.jpg', info: 'La plus grosse planète : plus de 1 300 Terres pourraient y tenir. Sa Grande Tache rouge est une tempête plus large que la Terre, qui souffle depuis des siècles.' },
  { id: 'saturn', wiki: 'Saturne (planète)', name: 'Saturne', texture: 'saturn.jpg', ring: true, info: "Ses anneaux sont faits de milliards de morceaux de glace et de roche. Elle est si peu dense qu'elle flotterait dans une baignoire géante !" },
  { id: 'uranus', wiki: 'Uranus (planète)', name: 'Uranus', texture: 'uranus.jpg', info: "Elle tourne couchée sur le côté, son axe étant incliné d'environ 98°. C'est la première planète découverte au télescope, par William Herschel en 1781." },
  { id: 'neptune', wiki: 'Neptune (planète)', name: 'Neptune', texture: 'neptune.jpg', info: "La planète la plus éloignée du Soleil. Ses vents dépassent 2 000 km/h. Elle a été découverte en 1846 grâce aux calculs du Français Urbain Le Verrier, avant même d'être observée." },
  { id: 'moon', wiki: 'Lune', name: 'La Lune', texture: 'moon.jpg', info: "Elle nous montre toujours la même face. Elle s'éloigne de la Terre d'environ 3,8 cm chaque année." },
];

/** Questions de connaissances : la bonne réponse est la planète `planet` (montrée après la réponse). */
export const PLANET_FACTS: { q: string; planet: string }[] = [
  { q: 'Quelle planète est la plus chaude du système solaire ?', planet: 'venus' },
  { q: 'Sur quelle planète se dresse le plus haut volcan du système solaire ?', planet: 'mars' },
  { q: 'Quelle planète tourne couchée sur le côté ?', planet: 'uranus' },
  { q: 'Quelle planète a été trouvée grâce à des calculs, avant d’être vue ?', planet: 'neptune' },
  { q: 'Quelle est la plus grosse planète du système solaire ?', planet: 'jupiter' },
  { q: "Quelle planète flotterait dans une baignoire géante ?", planet: 'saturn' },
  { q: 'Sur quelle planète une année ne dure que 88 jours ?', planet: 'mercury' },
];
