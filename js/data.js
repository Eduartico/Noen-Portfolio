export const contact = {
  instagram: 'https://www.instagram.com/commander.noen/',
  discord: '',
};

// One tile per entry; everything in `set` opens with it. span = columns out of 12, rows = row units.
export const works = [
  { id: 'quantum', title: '332nd Battle', span: 12, rows: 4, at: '50% 55%', set: ['quantum', 'quantum-1', 'quantum-2', 'quantum-3', 'quantum-4'] },
  { id: 'arrest', title: 'Coruscant Chase', span: 7, rows: 4 },
  { id: 'mygeeto', title: 'Mygeeto\'s Cold', span: 5, rows: 4, at: '78% 50%', set: ['mygeeto', 'mygeeto-1', 'mygeeto-2', 'mygeeto-3', 'mygeeto-4'] },
  { id: 'felucia', title: 'Jungle Deployment', span: 5, rows: 3, at: '100% 60%', set: ['felucia', 'felucia-1', 'felucia-2', 'felucia-3'] },
  { id: 'kachirho', title: 'First Contact', span: 7, rows: 3 },
  {
    id: '332-vaughn', title: '332nd Company', span: 4, rows: 4, at: '50% 12%',
    set: [['332-vaughn', 'Vaughn'], ['332-appo', 'Appo'], ['332-grunt', 'Trooper with Z-6'], ['332-noen', 'Noen']],
  },
  {
    id: 'rex-pistols', title: 'Captain Rex', span: 4, rows: 4, at: '50% 12%',
    set: [['rex-pistols', 'Captain Rex'], ['rex-aim', 'Captain Rex'], ['rex-belly', 'Captain Rex'], ['rex-run', 'Captain Rex']],
  },
  {
    id: '14-titus', title: '14th Panda Company', span: 4, rows: 4, at: '50% 12%',
    set: [['14-titus', 'Titus'], ['14-claw', 'Claw'], ['14-slate', 'Slate'], ['panda-grunt', 'Trooper']],
  },
  { id: 'magnaguard', title: 'Magnaguard Attack', span: 6, rows: 3, set: ['magnaguard', 'magnaguard-1', 'magnaguard-2'] },
  { id: 'panda-battle', title: 'Night Battle', span: 6, rows: 3, set: ['panda-battle', 'panda-battle-1', 'panda-battle-2', 'panda-battle-3', 'panda-battle-4'] },
  { id: 'umbara', title: 'Light in Shadow', span: 4, rows: 3 },
  { id: 'venator', title: 'Venator Briefing', span: 4, rows: 3, at: '50% 60%', set: ['venator', 'venator-1', 'venator-2'] },
  { id: 'tx-hangar', title: 'Hangar Preparation', span: 4, rows: 3, at: '50% 60%' },
];

// shown when a scene is picked
export const locations = ['Coruscant', 'Felucia', 'Geonosis', 'Kamino', 'Kashyyyk', 'Lothal', 'Mustafar', 'Naboo', 'Cato Neimoidia', 'Saleucami', 'Utapau', 'Venator interior'];
export const vehicles = ['AT-TE', 'AT-RT', 'AT-AP', 'AT-OT', 'LAAT', 'LAAT/c', 'TX-130', 'Juggernaut', 'SPHA-T', 'BARC speeder', 'Z-95', 'V-19', 'Y-wing', 'ARC-170'];
