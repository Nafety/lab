import { HISTORY } from './history';
import { didYouKnowQuestions, onThisDayQuestions } from '../live';

/** Question de livre : `title` (facultatif) s'affiche en grand, la bonne réponse est toujours choices[0]. */
export interface BookQuestion {
  title?: string;
  q: string;
  choices: string[];
  explain: string;
}

export interface BookTheme {
  title: string;
  /** Questions intégrées (et contenu de secours si le chargement en direct échoue). */
  questions: BookQuestion[];
  /** Questions chargées en direct (Wikipédia), renouvelées à chaque ouverture. */
  live?: (count: number) => Promise<BookQuestion[]>;
}

export const BOOK_THEMES: BookTheme[] = [
  {
    title: 'Inventions nées par accident',
    questions: [
      { title: 'La moisissure miraculeuse', q: 'Quelle découverte Alexander Fleming fit-il en rentrant de vacances, en 1928 ?', choices: ['La pénicilline', "L'aspirine", 'Le vaccin contre la rage', "L'insuline"], explain: "Il avait laissé traîner des boîtes de culture de bactéries. Une moisissure avait poussé dessus… et tué les bactéries autour d'elle. Le premier antibiotique était né." },
      { title: 'Une poche bien chaude', q: "Qu'est-ce qui fondit dans la poche de l'ingénieur Percy Spencer, le menant au four à micro-ondes ?", choices: ['Une barre chocolatée', 'Un bonbon à la menthe', 'Un morceau de beurre', 'Une bougie'], explain: "En 1945, il travaillait près d'un magnétron, un appareil de radar. Sa barre chocolatée fondit sans qu'il sente de chaleur : il comprit que ces ondes pouvaient cuire les aliments." },
      { title: 'La colle ratée', q: 'À quoi servit le tout premier Post-it ?', choices: ['De marque-page dans un livre de chants', 'De liste de courses', 'D’étiquette de prix', 'De pansement'], explain: "Le chimiste Spencer Silver avait créé une colle « trop faible ». Des années plus tard, son collègue Art Fry l'utilisa pour que ses marque-pages ne tombent plus de son recueil de chants à la chorale." },
      { title: 'Promenade dans les champs', q: "Qu'est-ce qui inspira l'invention du Velcro ?", choices: ["Des boules de bardane accrochées au poil d'un chien", 'Les ventouses de la pieuvre', 'Les pattes du gecko', "Les épines d'un cactus"], explain: "En 1941, le Suisse George de Mestral observa au microscope les petits crochets de ces fleurs collées au pelage de son chien. Il mit dix ans à reproduire le système." },
      { title: 'Une lueur dans le noir', q: 'Quelle fut la première radiographie célèbre de Wilhelm Röntgen, en 1895 ?', choices: ['La main de sa femme', 'Son chat', 'Une pomme', 'Son propre crâne'], explain: "On y voit les os et la bague d'Anna Bertha. En la découvrant, elle aurait dit : « J'ai vu ma mort. » Röntgen reçut le tout premier prix Nobel de physique en 1901." },
      { title: 'Des mains sucrées', q: 'Comment le chimiste Constantin Fahlberg découvrit-il la saccharine, en 1879 ?', choices: ['Il trouva ses mains sucrées en dînant, sans s’être lavé', 'Il renversa du sucre dans un acide', 'Il mâcha une plante exotique', "Il l'avait vu en rêve"], explain: "Rentré du laboratoire sans se laver les mains, il remarqua que son pain avait un goût sucré. Il retourna goûter (prudemment !) ses produits chimiques pour trouver le coupable." },
      { title: 'La bouteille vide', q: 'Que cherchait Roy Plunkett quand il découvrit le Téflon, en 1938 ?', choices: ['Un nouveau gaz pour les réfrigérateurs', 'Une colle extra-forte', 'Une peinture pour bateaux', 'Un carburant pour avions'], explain: "Une bouteille de gaz semblait vide… mais elle était encore lourde. En la sciant, il trouva une poudre blanche incroyablement glissante. Elle couvre aujourd'hui nos poêles." },
      { title: 'Un client difficile', q: 'Selon la légende, pourquoi le cuisinier George Crum aurait-il inventé les chips, en 1853 ?', choices: ['Pour se venger d’un client qui trouvait ses frites trop épaisses', 'Pour nourrir des soldats en voyage', 'Parce qu’il manquait d’huile', 'Pour un concours de cuisine'], explain: "Exaspéré, il aurait coupé ses pommes de terre en tranches ultra-fines, trop cuites et trop salées. Le client adora ! L'histoire est belle, mais les historiens doutent qu'elle soit vraie." },
    ],
  },
  {
    title: 'Animaux aux super-pouvoirs',
    questions: [
      { title: "L'increvable", q: "Quel minuscule animal a survécu à un séjour dans le vide de l'espace ?", choices: ['Le tardigrade', 'La fourmi', 'Le scorpion', 'La méduse'], explain: "En 2007, des tardigrades (moins d'un millimètre) ont passé dix jours exposés au vide spatial et beaucoup ont survécu. Ils supportent aussi le gel extrême et une sécheresse de plusieurs années." },
      { title: "L'éternelle jeunesse", q: 'Que peut faire la méduse Turritopsis dohrnii ?', choices: ['Redevenir jeune et recommencer sa vie', 'Vivre hors de l’eau', 'Briller plus fort que le soleil', 'Se diviser en cent méduses'], explain: "Blessée ou vieillissante, elle peut retourner au stade de polype, comme un papillon qui redeviendrait chenille. On la surnomme la « méduse immortelle »." },
      { title: 'Un cœur… ou trois ?', q: 'Combien de cœurs possède une pieuvre ?', choices: ['Trois', 'Un', 'Deux', 'Huit'], explain: "Deux cœurs pompent le sang vers les branchies, le troisième vers le reste du corps. Et son sang est bleu, grâce au cuivre qu'il contient." },
      { title: 'Le boxeur des mers', q: "Quel petit animal frappe si fort qu'il peut fêler la vitre d'un aquarium ?", choices: ['La crevette-mante', 'Le crabe', 'Le homard', 'Le poisson-globe'], explain: "Son coup part à plus de 80 km/h, l'un des mouvements les plus rapides du monde animal. Ses yeux distinguent aussi bien plus de couleurs que les nôtres." },
      { title: 'Le roi de la repousse', q: 'Quel animal peut faire repousser ses pattes, et même une partie de son cœur et de son cerveau ?', choices: ["L'axolotl", 'La grenouille', 'Le lézard', 'Le hérisson'], explain: "Cette salamandre mexicaine reste toute sa vie à l'état de « bébé ». Les scientifiques l'étudient pour comprendre comment régénérer des organes." },
      { title: 'Un drôle de cube', q: 'Quelle est la particularité des crottes du wombat ?', choices: ['Elles sont en forme de cube', 'Elles brillent dans le noir', 'Elles sentent la rose', 'Elles sont sucrées'], explain: "Son intestin a des parois plus ou moins souples qui façonnent des crottes cubiques. Il s'en sert pour marquer son territoire : les cubes ne roulent pas !" },
      { title: 'Marche arrière', q: 'Quel oiseau est capable de voler à reculons ?', choices: ['Le colibri', "L'aigle", 'Le moineau', 'Le pigeon'], explain: "Ses ailes battent jusqu'à 80 fois par seconde et pivotent à l'épaule. Il peut ainsi faire du surplace devant une fleur, monter, descendre… et reculer." },
      { title: 'Main dans la main', q: 'Que font les loutres de mer pour ne pas dériver en dormant ?', choices: ['Elles se tiennent par la patte', 'Elles s’accrochent au fond avec la queue', 'Elles dorment sur la plage', "Elles s'enterrent dans le sable"], explain: "Elles flottent sur le dos et se tiennent la patte, ou s'enroulent dans de grandes algues. Ces groupes de loutres endormies s'appellent des « radeaux »." },
    ],
  },
  {
    title: 'Les mots et leurs secrets',
    questions: [
      { title: 'Un monsieur très propre', q: 'D’où vient le mot « poubelle » ?', choices: ['Du préfet Eugène Poubelle', 'Du latin « pulvis » (poussière)', "D'un mot breton", 'D’une marque de seaux'], explain: "En 1883, ce préfet de Paris obligea les habitants à mettre leurs déchets dans des récipients. Les Parisiens, mécontents, donnèrent son nom à la boîte." },
      { title: 'Le ministre radin', q: 'D’où vient le mot « silhouette » ?', choices: ['D’un ministre des Finances très économe', "D'un peintre italien", "D'un mot grec signifiant « ombre »", "D'une danse"], explain: "Étienne de Silhouette, ministre en 1759, imposa des économies sévères. On appela « à la Silhouette » les choses faites à moindre frais, comme ces portraits réduits à un simple contour." },
      { title: 'Un jeu de cartes', q: "D'où vient le mot « sandwich » ?", choices: ['D’un comte anglais', "D'une ville italienne", "D'un mot allemand signifiant « pain »", "D'un boulanger parisien"], explain: "Selon la tradition, John Montagu, comte de Sandwich, demandait de la viande entre deux tranches de pain pour manger sans quitter sa table de jeu… ou son bureau." },
      { title: 'Merci les vaches', q: 'Le mot « vaccin » vient du latin « vacca ». Que signifie-t-il ?', choices: ['Vache', 'Piqûre', 'Protection', 'Médecin'], explain: "À la fin du XVIIIe siècle, Edward Jenner protégea des gens de la variole en leur inoculant la « vaccine », une maladie bénigne… des vaches." },
      { title: 'Le travail forcé', q: 'Le mot « robot » vient du tchèque « robota ». Que signifie ce mot ?', choices: ['Travail forcé, corvée', 'Homme de métal', 'Machine', 'Esclave du ciel'], explain: "Il apparaît en 1920 dans une pièce de théâtre de l'écrivain Karel Čapek. C'est son frère, le peintre Josef Čapek, qui lui aurait soufflé le mot." },
      { title: 'Le bleu de Gênes', q: 'Le mot « jean » vient du nom d’une ville. Laquelle ?', choices: ['Gênes', 'Genève', 'Jérusalem', 'Gand'], explain: "Les marins de Gênes portaient une toile solide appelée « jean ». Quant au « denim », il viendrait de la « toile de Nîmes »." },
      { title: 'Au pas de course ?', q: "On raconte que « bistrot » vient du russe « bystro » (vite), crié par des soldats en 1814. Est-ce vrai ?", choices: ["Non, c'est une légende", 'Oui, c’est prouvé', 'Oui, mais en 1914', 'Non, cela vient de l’anglais'], explain: "Le mot n'apparaît dans les textes que vers 1880, plus de 60 ans après le passage des Cosaques à Paris. Son origine reste mystérieuse." },
      { title: 'Le malentendu qui n’a pas existé', q: '« Kangourou » voudrait dire « je ne comprends pas » dans une langue aborigène. Vrai ?', choices: ['Faux : cela vient de « gangurru », le nom de l’animal', 'Vrai, c’est un malentendu célèbre', 'Faux : cela vient du latin', 'Vrai, en japonais'], explain: "En 1770, l'explorateur James Cook nota le mot chez le peuple Guugu Yimithirr, où « gangurru » désigne une espèce de grand kangourou gris." },
    ],
  },
  {
    title: 'Le corps humain, cet inconnu',
    questions: [
      { title: 'Guili-guili', q: 'Pourquoi ne peut-on pas se chatouiller soi-même ?', choices: ['Le cerveau prévoit nos propres gestes', 'La peau ne réagit qu’aux autres', 'Nos doigts sont trop froids', 'C’est possible, mais seulement aux pieds'], explain: "Le cervelet anticipe les sensations provoquées par nos propres mouvements et les « atténue ». Sans effet de surprise, pas de chatouilles !" },
      { title: 'Des autoroutes de sang', q: 'Mis bout à bout, les vaisseaux sanguins d’un adulte mesureraient environ…', choices: ['100 000 km', '100 m', '10 km', '1 million de km'], explain: "De quoi faire plus de deux fois le tour de la Terre ! La grande majorité sont des capillaires, plus fins qu'un cheveu." },
      { title: 'Le plus petit', q: 'Où se trouve le plus petit os du corps humain ?', choices: ["Dans l'oreille", 'Dans le petit orteil', 'Dans le nez', 'Dans le doigt'], explain: "C'est l'étrier, dans l'oreille moyenne : environ 3 mm. Il transmet les vibrations des sons vers l'oreille interne." },
      { title: 'Le drôle de voisin', q: "Quel animal a des empreintes digitales presque impossibles à distinguer des nôtres ?", choices: ['Le koala', 'Le chien', 'Le cochon', 'Le perroquet'], explain: "Même au microscope, les empreintes du koala ressemblent étonnamment à celles des humains. Elles l'aident à agripper l'écorce et les feuilles d'eucalyptus." },
      { title: 'Le moteur infatigable', q: 'Combien de fois environ le cœur bat-il en une journée ?', choices: ['100 000 fois', '1 000 fois', '10 000 fois', '1 million de fois'], explain: "Soit environ 2,5 milliards de battements au cours d'une vie. Chaque jour, il pompe l'équivalent de plusieurs milliers de litres de sang." },
      { title: 'La carte qui n’existe pas', q: "On voyait autrefois une « carte de la langue » : sucré au bout, amer au fond… Est-ce exact ?", choices: ['Non, chaque zone perçoit toutes les saveurs', 'Oui, c’est exact', 'Oui, mais seulement chez les enfants', 'Non, on ne goûte qu’avec le nez'], explain: "Cette carte vient d'une mauvaise interprétation d'une étude allemande de 1901. Les papilles de toute la langue détectent toutes les saveurs." },
      { title: 'Un estomac qui se renouvelle', q: 'Pourquoi l’acide de notre estomac ne le digère-t-il pas ?', choices: ['Il se protège par du mucus et renouvelle sa paroi', 'Il est en métal', "L'acide est trop faible", "Il se vide toutes les heures"], explain: "L'acide gastrique peut attaquer certains métaux ! Une couche de mucus protège la paroi, dont les cellules de surface sont remplacées en quelques jours." },
      { title: 'Contagieux', q: 'Le bâillement est contagieux entre humains. Peut-il l’être entre un humain et son chien ?', choices: ['Oui, des études l’ont observé', 'Non, jamais', 'Seulement chez les chats', 'Seulement si le chien dort'], explain: "Plusieurs études montrent que des chiens bâillent en voyant bâiller leur maître, surtout s'ils le connaissent bien. Un signe d'empathie ?" },
    ],
  },
  {
    title: 'Mythes et idées reçues',
    questions: [
      { title: 'Le petit caporal', q: 'Napoléon était-il vraiment très petit ?', choices: ['Non, il mesurait environ 1,69 m, une taille normale à l’époque', 'Oui, à peine 1,50 m', 'Oui, il était nain', 'Non, il faisait près de 2 m'], explain: "La légende vient des caricatures anglaises et d'une confusion entre pouces français et anglais. Son surnom « le petit caporal » était affectueux." },
      { title: 'Des cornes ?', q: 'Les Vikings portaient-ils des casques à cornes ?', choices: ["Non, c'est une invention du XIXe siècle", 'Oui, pour effrayer leurs ennemis', 'Seulement les chefs', 'Seulement pour les fêtes'], explain: "Aucun casque à cornes viking n'a été retrouvé. L'image s'est répandue avec les costumes d'opéra, notamment pour Wagner en 1876." },
      { title: 'Vue de la Lune', q: 'Peut-on voir la Grande Muraille de Chine depuis la Lune ?', choices: ['Non, elle est bien trop étroite', 'Oui, à l’œil nu', 'Oui, mais seulement la nuit', 'Seulement avec des jumelles'], explain: "Elle ne fait que quelques mètres de large. Depuis la Lune, à 384 000 km, on ne distingue même pas les continents en détail, encore moins un mur." },
      { title: 'La mémoire du poisson', q: 'Les poissons rouges ont-ils une mémoire de 3 secondes ?', choices: ['Non, ils se souviennent pendant des mois', 'Oui, exactement 3 secondes', 'Non, à peine 1 seconde', 'Ils n’ont pas de mémoire'], explain: "Des expériences montrent qu'ils peuvent apprendre à pousser un levier ou à reconnaître un signal, et s'en souvenir des mois plus tard." },
      { title: 'Rouge de colère', q: 'Pourquoi le taureau fonce-t-il sur la cape du torero ?', choices: ['À cause de son mouvement, pas de sa couleur', 'Parce qu’il déteste le rouge', 'Parce qu’elle sent le sang', 'Parce qu’elle brille'], explain: "Les taureaux voient mal le rouge. Une cape bleue ou blanche agitée de la même façon provoque la même charge." },
      { title: '10 % du cerveau ?', q: "N'utilise-t-on vraiment que 10 % de notre cerveau ?", choices: ['Non, nous l’utilisons entièrement', 'Oui, le reste dort', 'Oui, sauf les génies', 'Non, seulement 50 %'], explain: "L'imagerie médicale montre que toutes les zones du cerveau servent, même si elles ne sont pas toutes actives en même temps. Le cerveau consomme environ 20 % de notre énergie." },
      { title: 'Jamais deux fois ?', q: 'La foudre ne tombe-t-elle jamais deux fois au même endroit ?', choices: ['Faux, l’Empire State Building est frappé une vingtaine de fois par an', 'Vrai, c’est une loi physique', 'Vrai, sauf en mer', 'Faux, mais seulement sur les arbres'], explain: "Les endroits hauts et pointus attirent la foudre encore et encore. C'est d'ailleurs le principe du paratonnerre, inventé par Benjamin Franklin." },
      { title: 'Une phrase célèbre', q: '« Qu’ils mangent de la brioche ! » : Marie-Antoinette a-t-elle vraiment dit cela ?', choices: ["Aucune preuve : la phrase circulait avant qu'elle n'arrive en France", 'Oui, devant tout Versailles', 'Oui, mais en allemand', 'Non, c’était Louis XIV'], explain: "Jean-Jacques Rousseau rapporte une phrase semblable, attribuée à « une grande princesse », dans un texte écrit alors que Marie-Antoinette n'était qu'une enfant en Autriche." },
    ],
  },
  {
    title: 'Coutumes étonnantes du monde',
    questions: [
      { title: 'Le porte-bonheur chocolaté', q: 'Au Japon, pourquoi offre-t-on des Kit Kat aux élèves avant les examens ?', choices: ["Leur nom ressemble à « kitto katsu » : « tu vas gagner à coup sûr »", 'Parce qu’ils donnent de l’énergie', 'C’est une tradition impériale', 'Pour fêter la fin des cours'], explain: "Ce jeu de mots a fait du Kit Kat un porte-bonheur. On en trouve au Japon des centaines de saveurs : thé vert, patate douce, wasabi…" },
      { title: 'Douze coups de minuit', q: 'En Espagne, que mange-t-on aux douze coups de minuit le 31 décembre ?', choices: ['Douze grains de raisin', 'Douze olives', 'Douze amandes', 'Douze crêpes'], explain: "Un grain à chaque coup de cloche, pour s'assurer douze mois de chance. Il faut avaler vite… on a à peine trois secondes par grain !" },
      { title: 'Épicé, le célibat', q: "Au Danemark, que lance-t-on sur une personne qui fête ses 25 ans sans être mariée ?", choices: ['De la cannelle', 'Du riz', 'Des plumes', 'Des confettis'], explain: "Les amis l'aspergent de cannelle en poudre ! À 30 ans, on passe au poivre. Une tradition qui viendrait des marchands d'épices, souvent restés célibataires à force de voyager." },
      { title: 'Un sport conjugal', q: 'En Finlande, quel championnat du monde original se dispute chaque année ?', choices: ['Le porter de femme', 'Le lancer de téléphone portable', 'La course de traîneaux de bureau', 'Le saut à la perche dans un lac'], explain: "Les concurrents portent leur partenaire sur un parcours d'obstacles avec un bassin d'eau. Le prix ? Le poids de la partenaire… en bière. (Le lancer de téléphone existe aussi en Finlande !)" },
      { title: 'Le déluge de livres', q: 'En Islande, quelle est la grande tradition de la veille de Noël ?', choices: ['S’offrir des livres et les lire la nuit', 'Se baigner dans un geyser', 'Manger du chocolat dans la neige', 'Chanter sur les volcans'], explain: "C'est le « Jólabókaflóð », le « déluge de livres de Noël ». La plupart des nouveaux livres sortent juste avant les fêtes." },
      { title: 'Un banquet sauvage', q: 'À Lopburi, en Thaïlande, pour qui organise-t-on un immense buffet chaque année ?', choices: ['Pour les singes de la ville', 'Pour les éléphants', 'Pour les moines', 'Pour les touristes'], explain: "Des tonnes de fruits et de légumes sont offertes aux macaques qui vivent en liberté dans la ville, pour les remercier d'attirer les visiteurs." },
      { title: 'Cachez ce balai', q: 'En Norvège, que cachent traditionnellement les familles la veille de Noël ?', choices: ['Leurs balais', 'Leurs chaussures', 'Leurs clés', 'Leurs miroirs'], explain: "Selon une vieille croyance, les sorcières et les esprits malfaisants sortent cette nuit-là et cherchent des balais pour voler. Mieux vaut les mettre à l'abri !" },
      { title: 'Messe sur roulettes', q: 'À Caracas, au Venezuela, comment beaucoup d’habitants se rendent-ils à la messe de Noël ?', choices: ['En patins à roulettes', 'À dos d’âne', 'En barque', 'À reculons'], explain: "Certaines rues sont même fermées aux voitures le matin pour laisser passer les patineurs. L'origine de cette tradition reste mystérieuse." },
    ],
  },
  {
    title: "L'Histoire comme on ne vous l'a jamais contée",
    questions: [
      { title: 'Une guerre éclair', q: 'Combien de temps dura la guerre entre le Royaume-Uni et Zanzibar, en 1896 ?', choices: ['Moins d’une heure', 'Une semaine', 'Trois mois', 'Sept ans'], explain: "C'est la guerre la plus courte de l'Histoire : entre 38 et 45 minutes selon les sources, le temps que les navires britanniques bombardent le palais du sultan." },
      { title: 'Plus vieille que les Aztèques', q: "Laquelle de ces choses existait déjà lorsque les Aztèques fondèrent Tenochtitlan, en 1325 ?", choices: ["L'université d'Oxford", 'La tour Eiffel', "L'imprimerie de Gutenberg", 'Le château de Versailles'], explain: "On enseignait à Oxford dès la fin du XIe siècle, plus de deux siècles avant la fondation de la capitale aztèque, l'actuelle Mexico." },
      { title: 'Un pigeon héroïque', q: 'Qui était Cher Ami, décoré pendant la Première Guerre mondiale ?', choices: ['Un pigeon voyageur', 'Un chien sanitaire', 'Un cheval de cavalerie', 'Un espion français'], explain: "En 1918, blessé, il apporta un message qui permit de sauver près de 200 soldats américains encerclés. Il reçut la Croix de guerre française." },
      { title: 'La guerre perdue', q: "En 1932, contre quels ennemis l'armée australienne mena-t-elle une « guerre »… sans la gagner ?", choices: ['Des émeus', 'Des kangourous', 'Des lapins', 'Des crocodiles'], explain: "Des milliers d'émeus ravageaient les cultures. Les soldats, armés de mitrailleuses, furent ridiculisés par ces grands oiseaux rapides et dispersés." },
      { title: 'Napoléon battu par des lapins', q: "Selon les mémoires d'un général, quelle mésaventure arriva à Napoléon lors d'une chasse en 1807 ?", choices: ['Il fut chargé par une horde de lapins', 'Il tomba dans un étang', 'Un cerf vola son chapeau', 'Il fut piqué par des guêpes'], explain: "Les lapins, élevés en cage et habitués à être nourris, se ruèrent sur l'empereur au lieu de fuir. Il dut battre en retraite dans sa voiture !" },
      { title: 'Les derniers mammouths', q: "Des mammouths vivaient-ils encore quand les Égyptiens bâtissaient les pyramides ?", choices: ["Oui, sur une île de l'Arctique", 'Non, ils avaient disparu depuis un million d’années', 'Oui, en Égypte même', 'Non, ils n’ont jamais côtoyé les humains'], explain: "Une petite population a survécu sur l'île Wrangel, au nord de la Sibérie, jusqu'à il y a environ 4 000 ans, bien après la construction de la grande pyramide." },
      { title: 'Un médicament étonnant', q: 'Dans les années 1830, aux États-Unis, sous quelle forme vendait-on du ketchup ?', choices: ['En pilules contre les maux de ventre', 'En bonbons', 'En crème pour la peau', 'En parfum'], explain: "Un médecin, John Cook Bennett, prétendait que la tomate soignait l'indigestion. Des « pilules de tomate » furent vendues… avant d'être dénoncées comme une arnaque." },
      { title: 'Un coup de pinceau', q: 'Tous les combien de temps environ repeint-on la tour Eiffel ?', choices: ['Tous les 7 ans', 'Tous les ans', 'Tous les 50 ans', 'Jamais'], explain: "Il faut environ 60 tonnes de peinture, appliquées à la main par une équipe de peintres. C'est indispensable pour protéger le fer de la rouille." },
    ],
  },
  {
    title: 'Le saviez-vous ?',
    questions: [],
    live: didYouKnowQuestions,
  },
  {
    title: 'Ce jour-là, dans l’Histoire',
    questions: [],
    live: onThisDayQuestions,
  },
  {
    title: 'Les grandes dates du monde',
    questions: HISTORY.map((h) => ({ title: h.event, q: h.q, choices: h.choices, explain: h.explain })),
  },
];
