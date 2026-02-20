export type Choice = {
  id: string;
  label: string;
  leadsTo: string;
};

export type NodeType = 'narration' | 'ending';

export type Outcome = 'solved' | 'unsolved' | 'failed';

export type StoryNode = {
  id: string;
  title?: string;
  text: string;
  type: NodeType;
  choices?: Choice[];
  outcome?: Outcome;
};

export type Story = {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  entryNodeId: string;
  nodes: Record<string, StoryNode>;
};

export const stories: Story[] = [
  {
    id: 'pilot-case',
    title: 'Pilotný prípad: Ticho pod povrchom',
    description:
      'Nočný panelák, výťah stojí medzi poschodiami a na chodbe leží telo. Si priestorový vyšetrovateľ s vlastnými ušami.',
    difficulty: 'easy',
    entryNodeId: 'crime_scene',
    nodes: {
      crime_scene: {
        id: 'crime_scene',
        title: 'Miesto činu',
        type: 'narration',
        text:
          'Je krátko po polnoci. Na štvrtom poschodí stojí výťah s otvorenými dverami. Pred nimi leží telo muža v domácom oblečení. Na mieste je ticho, iba z diaľky počuť tlmený hukot mesta.',
        choices: [
          {
            id: 'inspect_body',
            label: 'Prezrieť telo obete',
            leadsTo: 'body_inspection',
          },
          {
            id: 'talk_neighbours',
            label: 'Zaklopať susedom',
            leadsTo: 'neighbours',
          },
          {
            id: 'check_cctv',
            label: 'Skontrolovať kamerové záznamy pri vchode',
            leadsTo: 'cctv',
          },
        ],
      },
      body_inspection: {
        id: 'body_inspection',
        title: 'Telo obete',
        type: 'narration',
        text:
          'Muž nemá viditeľné poranenia. V ruke stále zviera kľúče od bytu. Na zápästí má staré jazvy po sebapoškodzovaní, ale žiadne čerstvé stopy zápasu.',
        choices: [
          {
            id: 'back_to_neighbours',
            label: 'Vrátiť sa k susedom',
            leadsTo: 'neighbours',
          },
          {
            id: 'back_to_cctv',
            label: 'Ísť skontrolovať kamery',
            leadsTo: 'cctv',
          },
        ],
      },
      neighbours: {
        id: 'neighbours',
        title: 'Susedia',
        type: 'narration',
        text:
          'Na zvonenie otvorí mladý sused. Vraj počul buchnutie výťahu a krátky výkrik, ale už to nestihol. Tvrdí, že obeť sa v posledných dňoch správala nervózne.',
        choices: [
          {
            id: 'push_neighbour',
            label: 'Tlačiť na suseda, či niečo netají',
            leadsTo: 'neighbour_ending',
          },
          {
            id: 'go_to_cctv_from_neighbours',
            label: 'Nechať ho a ísť na kamery',
            leadsTo: 'cctv',
          },
        ],
      },
      cctv: {
        id: 'cctv',
        title: 'Kamerový záznam',
        type: 'narration',
        text:
          'Na zázname vidíš, ako muž nastupuje do výťahu s niekým, koho tvár je mimo záberu. Dvere sa zatvoria. O pár sekúnd neskôr výťah prudko trhne a svetlo zhasne.',
        choices: [
          {
            id: 'technical_inspection',
            label: 'Zavolať technika na výťah',
            leadsTo: 'technical',
          },
          {
            id: 'close_case_unsolved',
            label: 'Uzavrieť prípad ako nehodu',
            leadsTo: 'unsolved_ending',
          },
        ],
      },
      technical: {
        id: 'technical',
        title: 'Technická správa',
        type: 'ending',
        outcome: 'solved',
        text:
          'Technik potvrdí, že výťah bol úmyselne sabotovaný. V kombinácii s výpoveďou suseda a záznamom z kamier sa ti podarí dopracovať k páchateľovi. Prípad uzatváraš ako vraždu so zadržaným podozrivým.',
      },
      unsolved_ending: {
        id: 'unsolved_ending',
        title: 'Prípad v archíve',
        type: 'ending',
        outcome: 'unsolved',
        text:
          'Bez technickej správy a ďalších dôkazov nadriadený súhlasí, aby sa prípad uzavrel ako nešťastná náhoda. V hĺbke duše však tušíš, že pod povrchom zostalo niečo neodkryté.',
      },
      neighbour_ending: {
        id: 'neighbour_ending',
        title: 'Slepá ulička',
        type: 'ending',
        outcome: 'failed',
        text:
          'Na suseda zatlačíš príliš. Zavrie sa do seba a prestane spolupracovať. Bez jeho výpovede a bez ďalších dôkazov prípad uviazne. O niekoľko mesiacov ho presunú do archívu.',
      },
    },
  },
];

