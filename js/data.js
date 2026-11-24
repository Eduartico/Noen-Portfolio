export const contact = {
  instagram: '',
  discord: '',
};

// A showcase is any themed set: a legion, a character, a type of trooper, a new helmet.
export const showcases = [
  {
    id: '332nd', title: '332nd Company',
    items: [
      { id: '332-vaughn', title: 'Vaughn' },
      { id: '332-appo', title: 'Appo' },
      { id: '332-grunt', title: 'Trooper with Z-6' },
      { id: '332-noen', title: 'Noen' },
    ],
  },
  {
    id: '14th', title: '14th Panda Company',
    items: [
      { id: '14-titus', title: 'Titus' },
      { id: '14-claw', title: 'Claw' },
      { id: '14-slate', title: 'Slate' },
      { id: 'panda-grunt', title: 'Trooper' },
    ],
  },
  {
    id: 'rex', title: 'Captain Rex',
    items: [
      { id: 'rex-pistols', title: 'Pistols up' },
      { id: 'rex-aim', title: 'Aiming' },
      { id: 'rex-belly', title: 'Close quarters' },
      { id: 'rex-run', title: 'Running' },
    ],
  },
];

// span = columns out of 12 on wide screens, rows = row units, more = close-ups shown with it
export const scenes = [
  { id: 'quantum', title: 'Quantum Squad', span: 12, rows: 4, at: '50% 55%', more: ['quantum-1', 'quantum-2', 'quantum-3', 'quantum-4'] },
  { id: 'arrest', title: 'The arrest', span: 7, rows: 4 },
  { id: 'mygeeto', title: 'Mygeeto bridge', span: 5, rows: 4, at: '78% 50%', more: ['mygeeto-1', 'mygeeto-2', 'mygeeto-3', 'mygeeto-4'] },
  { id: 'felucia', title: 'Felucia advance', span: 5, rows: 3, at: '100% 60%', more: ['felucia-1', 'felucia-2', 'felucia-3'] },
  { id: 'kachirho', title: 'Kachirho', span: 7, rows: 3 },
  { id: 'magnaguard', title: 'Magnaguard attack', span: 6, rows: 3, more: ['magnaguard-1', 'magnaguard-2'] },
  { id: 'panda-battle', title: 'Night battle', span: 6, rows: 3, more: ['panda-battle-1', 'panda-battle-2', 'panda-battle-3', 'panda-battle-4'] },
  { id: 'umbara', title: 'Umbara', span: 4, rows: 3 },
  { id: 'venator', title: 'Venator briefing', span: 4, rows: 3, at: '50% 60%', more: ['venator-1', 'venator-2'] },
  { id: 'tx-hangar', title: 'TX-130 hangar', span: 4, rows: 3, at: '50% 60%' },
];

// shown when a scene is picked
export const locations = ['Coruscant', 'Felucia', 'Geonosis', 'Kamino', 'Kashyyyk', 'Lothal', 'Mustafar', 'Naboo', 'Cato Neimoidia', 'Saleucami', 'Utapau', 'Venator interior'];
export const vehicles = ['AT-TE', 'AT-RT', 'AT-AP', 'AT-OT', 'LAAT', 'LAAT/c', 'TX-130', 'Juggernaut', 'SPHA-T', 'BARC speeder', 'Z-95', 'V-19', 'Y-wing', 'ARC-170'];
