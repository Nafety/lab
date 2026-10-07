export interface Anecdote {
  title: string;
  place: string;
  lat: number;
  lon: number;
  details: string[];
  facts: string[];
  question: { q: string; choices: string[]; answer: number };
}

/** Lieux insolites du globe. Dans chaque question, la bonne réponse est `answer` (les choix sont mélangés à l'affichage). */
export const ANECDOTES: Anecdote[] = [
  {
    title: "L'île aux lapins",
    place: 'Okunoshima, Japon',
    lat: 34.31,
    lon: 132.99,
    details: [
      "Okunoshima est une petite île de la mer intérieure de Seto, dont on fait le tour à pied en à peine plus d'une heure. Plusieurs centaines de lapins sauvages y vivent en liberté et accourent dès qu'un visiteur sort un sachet de nourriture.",
      "Son passé est beaucoup plus sombre : de 1929 à 1945, l'armée japonaise y fabriquait en secret du gaz toxique. L'île avait même été effacée des cartes. Un petit musée raconte aujourd'hui cette histoire.",
    ],
    facts: [
      "On y accède en ferry en une quinzaine de minutes.",
      'Chiens et chats y sont interdits pour protéger les lapins.',
      "Personne ne sait vraiment d'où viennent les premiers lapins.",
    ],
    question: {
      q: "Que fabriquait-on en secret sur l'île pendant la guerre ?",
      choices: ['Du gaz toxique', 'Des avions', 'De la fausse monnaie'],
      answer: 0,
    },
  },
  {
    title: 'Un lac rose bonbon',
    place: 'Lac Hillier, Australie',
    lat: -34.09,
    lon: 123.2,
    details: [
      "Le lac Hillier se trouve sur Middle Island, au large de l'Australie-Occidentale. Long d'environ 600 mètres, il n'est séparé de l'océan que par une mince bande de sable et de forêt.",
      "Sa couleur vient d'une algue microscopique, Dunaliella salina, et de bactéries qui adorent le sel. Elles produisent des pigments rouges, des caroténoïdes, la même famille que ceux qui colorent les carottes.",
    ],
    facts: [
      "L'eau reste rose même dans un verre.",
      "Le lac est extrêmement salé.",
      "L'explorateur Matthew Flinders l'a décrit dès 1802.",
    ],
    question: {
      q: "Qu'est-ce qui donne sa couleur rose au lac ?",
      choices: ['Des algues et des bactéries', 'Du sable rouge au fond', 'Le reflet du coucher de soleil'],
      answer: 0,
    },
  },
  {
    title: 'La terre dont personne ne veut',
    place: 'Bir Tawil, entre Égypte et Soudan',
    lat: 21.87,
    lon: 33.75,
    details: [
      "Bir Tawil est un désert d'environ 2 000 km² coincé entre l'Égypte et le Soudan. Deux frontières différentes ont été tracées par les Britanniques, en 1899 et en 1902.",
      "Chaque pays défend le tracé qui lui donne le triangle de Halaïb, un territoire voisin beaucoup plus grand et au bord de la mer Rouge. Avec ces tracés, Bir Tawil revient toujours… à l'autre pays. Résultat : personne ne le réclame !",
    ],
    facts: [
      "Aucun habitant permanent, ni route, ni eau.",
      "Plusieurs aventuriers ont voulu s'y proclamer roi, sans être reconnus.",
      "C'est l'une des très rares terres habitables qu'aucun État ne revendique.",
    ],
    question: {
      q: 'Pourquoi aucun pays ne réclame Bir Tawil ?',
      choices: ['Le réclamer ferait perdre un territoire voisin plus intéressant', 'Il est radioactif', "Il est sous l'eau une partie de l'année"],
      answer: 0,
    },
  },
  {
    title: 'Le désert le plus sec',
    place: "Désert d'Atacama, Chili",
    lat: -24.5,
    lon: -69.25,
    details: [
      "Coincé entre l'océan Pacifique et la cordillère des Andes, l'Atacama est le désert non polaire le plus sec du monde. Les montagnes bloquent l'humidité venue de l'Est, et un courant marin froid empêche les nuages de pluie de se former.",
      "Son sol est si sec et si pauvre en vie que la NASA y teste ses robots destinés à Mars. Et son ciel pur en fait l'un des meilleurs endroits de la planète pour observer les étoiles.",
    ],
    facts: [
      "Certaines zones reçoivent moins d'un millimètre de pluie par an.",
      "Après une rare pluie, le désert se couvre de fleurs : le « désert fleuri ».",
      "Le radiotélescope géant ALMA y est installé à 5 000 m d'altitude.",
    ],
    question: {
      q: "Pourquoi la NASA teste-t-elle ses robots dans l'Atacama ?",
      choices: ['Son sol ressemble à celui de Mars', 'Il y fait plus froid que sur la Lune', "On y ressent moins la gravité"],
      answer: 0,
    },
  },
  {
    title: 'Une frontière dans le salon',
    place: 'Baarle, Belgique et Pays-Bas',
    lat: 51.44,
    lon: 4.93,
    details: [
      "Baarle est un village partagé entre deux pays : Baarle-Hertog en Belgique et Baarle-Nassau aux Pays-Bas. Leurs territoires sont imbriqués en une trentaine d'enclaves, héritage de partages de terres remontant au Moyen Âge.",
      "La frontière est dessinée au sol par des croix blanches. Elle traverse des rues, des magasins et même des maisons. Dans ce cas, c'est la porte d'entrée qui décide : la maison est belge ou néerlandaise selon le côté où elle se trouve.",
    ],
    facts: [
      'Certaines enclaves belges contiennent elles-mêmes des enclaves néerlandaises.',
      "Dans une même rue, les plaques de numéro portent le drapeau de l'un ou l'autre pays.",
      'On peut prendre un café avec un pied dans chaque pays.',
    ],
    question: {
      q: "Comment décide-t-on de la nationalité d'une maison coupée par la frontière ?",
      choices: ["Selon l'emplacement de sa porte d'entrée", 'Selon la nationalité du propriétaire', 'Par tirage au sort'],
      answer: 0,
    },
  },
  {
    title: 'La ville la plus haute du monde',
    place: 'La Rinconada, Pérou',
    lat: -14.63,
    lon: -69.45,
    details: [
      "Perchée à environ 5 100 mètres d'altitude, au pied d'un glacier des Andes, La Rinconada est considérée comme la ville la plus haute du monde. Des dizaines de milliers de personnes y vivent.",
      "Presque tous sont venus pour l'or caché dans la montagne. Les conditions sont très dures : froid glacial, peu d'eau courante et un air où chaque respiration apporte presque moitié moins d'oxygène qu'au niveau de la mer.",
    ],
    facts: [
      "À cette altitude, l'eau bout vers 83 °C au lieu de 100 °C.",
      'Les nuits sont glaciales toute l’année.',
      "Le corps des habitants s'adapte en fabriquant plus de globules rouges.",
    ],
    question: {
      q: 'Pourquoi tant de gens vivent-ils si haut ?',
      choices: ["Pour les mines d'or", 'Pour fuir la chaleur', "Pour l'élevage de lamas"],
      answer: 0,
    },
  },
  {
    title: 'Le point Nemo',
    place: 'Océan Pacifique Sud',
    lat: -48.88,
    lon: -123.39,
    details: [
      "C'est le point de l'océan le plus éloigné de toute terre : environ 2 700 km de la côte la plus proche. Son nom rend hommage au capitaine Nemo, le héros de Jules Verne dans Vingt Mille Lieues sous les mers.",
      "Comme aucun bateau ne passe par là, les agences spatiales y font tomber leurs vieux satellites et stations : c'est le « cimetière des vaisseaux spatiaux ». La station russe Mir y repose depuis 2001.",
    ],
    facts: [
      "Les humains les plus proches sont souvent les astronautes de l'ISS, à environ 400 km au-dessus.",
      "La Station spatiale internationale devrait elle aussi y finir sa vie.",
      "Les îles les plus proches sont inhabitées.",
    ],
    question: {
      q: 'Que trouve-t-on au fond de l’océan près du point Nemo ?',
      choices: ['Un cimetière de vaisseaux spatiaux', 'Une épave de pirate célèbre', 'Une ville engloutie'],
      answer: 0,
    },
  },
  {
    title: 'Le pays sans moustiques… jusqu’en 2025',
    place: 'Islande',
    lat: 64.96,
    lon: -19.02,
    details: [
      "Pendant longtemps, l'Islande a été célèbre pour être l'un des seuls endroits habités du monde sans moustiques, alors que ses voisins, comme la Norvège ou le Groenland, en sont pleins.",
      "Une explication souvent avancée : en hiver, les nombreux cycles de gel et de dégel empêcheraient les larves de survivre. Mais le climat se réchauffe, et en octobre 2025, des moustiques ont été observés pour la première fois dans la nature islandaise.",
    ],
    facts: [
      "L'Islande est posée sur la dorsale médio-atlantique, entre deux plaques tectoniques.",
      'Environ 30 volcans y sont considérés comme actifs.',
      'La géothermie chauffe la grande majorité des maisons.',
    ],
    question: {
      q: 'Quel insecte a longtemps été absent d’Islande ?',
      choices: ['Le moustique', 'La mouche', 'La coccinelle'],
      answer: 0,
    },
  },
  {
    title: "L'île habitée la plus isolée",
    place: 'Tristan da Cunha, Atlantique Sud',
    lat: -37.11,
    lon: -12.28,
    details: [
      "Environ 250 personnes vivent sur cette île volcanique, toutes dans un seul village : Edinburgh of the Seven Seas. L'île habitée la plus proche, Sainte-Hélène, est à plus de 2 400 km.",
      "Il n'y a pas d'aéroport : il faut environ une semaine de bateau depuis l'Afrique du Sud. En 1961, le volcan est entré en éruption et tous les habitants ont été évacués vers l'Angleterre. La plupart sont revenus deux ans plus tard.",
    ],
    facts: [
      'Seulement une poignée de noms de famille différents sur toute l’île.',
      'Les terres sont cultivées en commun.',
      "Le volcan culmine à plus de 2 000 m au-dessus de l'océan.",
    ],
    question: {
      q: "Que s'est-il passé sur l'île en 1961 ?",
      choices: ['Une éruption a forcé tous les habitants à partir', "L'île a été vendue", 'On y a construit un aéroport'],
      answer: 0,
    },
  },
  {
    title: 'Champion des fuseaux horaires',
    place: 'France',
    lat: 48.86,
    lon: 2.35,
    details: [
      "Grâce à ses territoires d'outre-mer, éparpillés sur tous les océans, la France est le pays qui compte le plus de fuseaux horaires au monde : 12, et même 13 si l'on ajoute la Terre Adélie, en Antarctique.",
      "Quand il est midi à Paris en hiver, il est 1 h du matin à Tahiti, 7 h en Guadeloupe, 15 h à La Réunion et 22 h à Nouméa, en Nouvelle-Calédonie.",
    ],
    facts: [
      'La Russie, pourtant immense, n’en compte « que » 11.',
      "La Guyane française partage une frontière avec le Brésil.",
      "Le soleil ne se couche donc jamais complètement sur le territoire français.",
    ],
    question: {
      q: "Combien de fuseaux horaires compte la France, sans l'Antarctique ?",
      choices: ['12', '3', '7'],
      answer: 0,
    },
  },
  {
    title: "Plus haut que l'Everest ?",
    place: 'Chimborazo, Équateur',
    lat: -1.47,
    lon: -78.82,
    details: [
      "Avec ses 8 849 m, l'Everest est le plus haut sommet au-dessus du niveau de la mer. Le Chimborazo, en Équateur, ne mesure « que » 6 263 m.",
      "Mais la Terre n'est pas une boule parfaite : elle est renflée au niveau de l'équateur, à cause de sa rotation. Le Chimborazo, presque sur l'équateur, profite de ce renflement : son sommet est le point le plus éloigné du centre de la Terre, plus de 2 km plus loin que celui de l'Everest !",
    ],
    facts: [
      "C'est un volcan endormi, couvert de glaciers.",
      'Il est situé à environ 1° au sud de l’équateur.',
      'Le savant Alexander von Humboldt a tenté son ascension en 1802.',
    ],
    question: {
      q: "Pourquoi le sommet du Chimborazo est-il plus loin du centre de la Terre que l'Everest ?",
      choices: ["La Terre est renflée au niveau de l'équateur", 'Il grandit plus vite chaque année', 'Il est posé sur une plaque plus épaisse'],
      answer: 0,
    },
  },
  {
    title: 'Le plus petit pays du monde',
    place: 'Vatican',
    lat: 41.9,
    lon: 12.45,
    details: [
      "Avec 0,44 km², le Vatican est le plus petit État du monde : on en fait le tour à pied en moins d'une heure. Il compte environ 800 habitants.",
      "Il a pourtant tout d'un vrai pays : sa poste et ses timbres, sa radio, sa gare ferroviaire et même sa propre armée, la Garde suisse, chargée de protéger le pape depuis 1506.",
    ],
    facts: [
      'Il est entièrement entouré par la ville de Rome.',
      "La Garde suisse porte un uniforme coloré de style Renaissance.",
      'La basilique Saint-Pierre est l’une des plus grandes églises du monde.',
    ],
    question: {
      q: 'Qui assure la protection du pape au Vatican ?',
      choices: ['La Garde suisse', 'La Légion étrangère', 'Les carabiniers italiens'],
      answer: 0,
    },
  },
  {
    title: 'Le pays aux lacs',
    place: 'Canada',
    lat: 56,
    lon: -106,
    details: [
      "Le Canada abriterait environ 60 % des lacs de la planète, plus que tous les autres pays réunis. Beaucoup ont été creusés par les immenses glaciers qui recouvraient le pays il y a plus de 10 000 ans.",
      "C'est aussi le pays qui possède le plus long littoral du monde : plus de 240 000 km de côtes, de quoi faire six fois le tour de la Terre.",
    ],
    facts: [
      "C'est le deuxième plus grand pays du monde, après la Russie.",
      'Il partage avec les États-Unis la plus longue frontière terrestre du monde.',
      'Ses deux langues officielles sont l’anglais et le français.',
    ],
    question: {
      q: 'Quelle part des lacs du monde se trouverait au Canada ?',
      choices: ['Environ 60 %', 'Environ 5 %', 'Environ 25 %'],
      answer: 0,
    },
  },
  {
    title: 'Onze fuseaux horaires',
    place: 'Russie',
    lat: 61.52,
    lon: 105.32,
    details: [
      "Avec plus de 17 millions de km², la Russie est de loin le plus grand pays du monde. Elle s'étend sur 11 fuseaux horaires : quand il est 22 h à Kaliningrad, à l'ouest, il est déjà 8 h le lendemain au Kamtchatka.",
      "Le train Transsibérien relie Moscou à Vladivostok en parcourant plus de 9 000 km. Le voyage dure environ une semaine.",
    ],
    facts: [
      'La Russie a des frontières avec 14 pays.',
      'Elle couvre environ un neuvième des terres émergées.',
      'La Sibérie à elle seule est plus grande que le Canada.',
    ],
    question: {
      q: 'Combien de temps dure environ le voyage Moscou–Vladivostok en Transsibérien ?',
      choices: ['Une semaine', 'Une journée', 'Un mois'],
      answer: 0,
    },
  },
  {
    title: "Une réserve d'eau géante",
    place: 'Lac Baïkal, Russie',
    lat: 53.5,
    lon: 108.2,
    details: [
      "Le lac Baïkal, en Sibérie, contient à lui seul environ 20 % de l'eau douce liquide en surface de la planète. Avec plus de 1 600 m, c'est aussi le lac le plus profond du monde, et le plus ancien : il aurait environ 25 millions d'années.",
      "Il abrite des espèces uniques, comme le phoque du Baïkal, l'un des rares phoques au monde à vivre en eau douce. En hiver, sa glace devient si épaisse qu'on peut y rouler en voiture.",
    ],
    facts: [
      "Plus de 300 rivières s'y jettent, une seule en sort : l'Angara.",
      "Son eau est si claire qu'on voit parfois à 40 m de profondeur.",
      "Plus de la moitié de ses espèces n'existent nulle part ailleurs.",
    ],
    question: {
      q: 'Quel animal surprenant vit dans le lac Baïkal ?',
      choices: ['Un phoque', 'Un requin', 'Un dauphin'],
      answer: 0,
    },
  },
  {
    title: "L'île des arbres-dragons",
    place: 'Socotra, Yémen',
    lat: 12.46,
    lon: 53.82,
    details: [
      "Socotra est une île de l'océan Indien, isolée du continent depuis des millions d'années. Une grande partie de ses plantes n'existent nulle part ailleurs sur Terre.",
      "Sa star est le dragonnier de Socotra, un arbre en forme de parapluie retourné. Quand on entaille son écorce, il en coule une résine rouge sombre, appelée « sang-dragon », utilisée depuis l'Antiquité comme teinture et remède.",
    ],
    facts: [
      "Environ un tiers de ses plantes sont endémiques (uniques à l'île).",
      "L'île est classée au patrimoine mondial de l'UNESCO.",
      "Sa forme en parapluie aide l'arbre à capter l'humidité et à faire de l'ombre à ses racines.",
    ],
    question: {
      q: "Comment appelle-t-on la résine rouge du dragonnier ?",
      choices: ['Le sang-dragon', "L'ambre rouge", 'La sève de feu'],
      answer: 0,
    },
  },
];
