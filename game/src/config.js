// SOLANO HEAT — world tuning: the three city variants, the 8-chapter story,
// the radio stations and every gameplay constant. One engine, three cities.
export const WORLD = 3200;          // the city is WORLD x WORLD pixels
export const ROAD_AT = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROAD_W = 72;           // road width, sidewalks included

// Places every chapter can point at. Coordinates are road-grid positions
// that exist in all three variants; each variant dresses them differently.
export const PLACES = {
  pier:      { x: 1600, y: 3060, label: 'Solano Pier' },
  garage:    { x: 600,  y: 1000, label: "Dario's Garage" },
  park:      { x: 1400, y: 1400, label: 'Palm Court Park' },
  downtown:  { x: 1800, y: 1800, label: 'Downtown Solano' },
  port:      { x: 1000, y: 260,  label: 'Port Solano' },
  stadium:   { x: 2400, y: 800,  label: 'Solano Dome' },
  hospital:  { x: 800,  y: 2200, label: 'St. Marina Hospital' },
  warehouse: { x: 2600, y: 2400, label: 'Warehouse 9' },
  marina:    { x: 2600, y: 3060, label: 'Marina' },
  plaza:     { x: 2200, y: 1800, label: 'Neon Plaza' },
};

// One engine, three cities. Each variant is a palette + a landmark set +
// a time of day; the city generator and the renderer read only this.
export const VARIANTS = {
  solano: {
    id: 'solano', name: 'SOLANO BAY', tag: 'Sun, surf & fast cars',
    seed: 1107, clockStart: 10 * 60 + 24, // 10:24 AM
    sky: '#79c7e8', haze: 'rgba(126,199,232,0.10)',
    ground: '#7fae62', groundAlt: '#79a85e',
    road: '#3d3f45', roadEdge: '#2c2e33', roadLine: '#e8d44f',
    sidewalk: '#b9b3a4', water: '#2f7fc4', waterDeep: '#1d5c96',
    sand: '#e8d29a', sandWet: '#d9c184',
    buildingRoofs: ['#c96f4a', '#d9a05b', '#8fa8bf', '#b5533c', '#e0cfa8', '#7d8ba0'],
    glass: '#9fd8ef', night: false, sunAngle: -0.6,
    light: null, // daylight: no darkness overlay
    lampGlow: false, neon: false,
    landmarkKinds: ['beach', 'pier', 'stadium', 'park', 'marina'],
    radio: 0,
  },
  neon: {
    id: 'neon', name: 'NEON NIGHTS', tag: 'Downtown after dark',
    seed: 2204, clockStart: 23 * 60 + 47, // 11:47 PM
    sky: '#0b1026', haze: 'rgba(11,16,38,0.25)',
    ground: '#232a3d', groundAlt: '#1f2636',
    road: '#171a24', roadEdge: '#0e1018', roadLine: '#c9b458',
    sidewalk: '#3a4157', water: '#0e2a4a', waterDeep: '#081a33',
    sand: '#5a5344', sandWet: '#4a4436',
    buildingRoofs: ['#2c3550', '#3a2c50', '#24384a', '#4a2c3c', '#2e2a44', '#1f2c3e'],
    glass: '#ffd76a', night: true, sunAngle: 0,
    light: 'rgba(4,6,18,0.55)', // darkness overlay, punched through by lamps
    lampGlow: true, neon: true,
    landmarkKinds: ['plaza', 'towers', 'park', 'stadium'],
    radio: 2,
  },
  sunset: {
    id: 'sunset', name: 'GOLDEN HARBOR', tag: 'Golden hour at the port',
    seed: 3309, clockStart: 18 * 60 + 58, // 6:58 PM
    sky: '#f2a35e', haze: 'rgba(242,163,94,0.16)',
    ground: '#97875f', groundAlt: '#8d7d55',
    road: '#4a3f3a', roadEdge: '#382f2c', roadLine: '#f0d060',
    sidewalk: '#a89a7e', water: '#c96a4a', waterDeep: '#8f4530',
    sand: '#e0b878', sandWet: '#c99e62',
    buildingRoofs: ['#a85a3c', '#c07a45', '#8a5a68', '#b08a4a', '#6a4a5a', '#94543a'],
    glass: '#ffb36a', night: false, sunAngle: 2.4,
    light: 'rgba(120,40,10,0.10)', // warm dusk tint
    lampGlow: true, neon: false,
    landmarkKinds: ['port', 'cranes', 'stadium', 'park', 'beach'],
    radio: 1,
  },
};

// The story: Mara Voss, retired getaway driver, pulled back in by her
// brother Dario — and hunted across Port Solano by Captain Reyes.
export const HERO = 'Mara Voss';
export const BROTHER = 'Dario Voss';
export const CAPTAIN = 'Captain Reyes';

export const CHAPTERS = [
  {
    title: 'The Last Job', giver: BROTHER, reward: 500,
    intro: ['MARA: One last drive, Dario. Then I am done.',
            'DARIO: Just get me to the pier, sis. No cops, no trouble.'],
    steps: [
      { type: 'goto', place: 'pier', text: 'Drive Dario to Solano Pier' },
      { type: 'meet', place: 'pier', text: 'Meet the buyer at the pier' },
    ],
  },
  {
    title: 'Hot Wheels', giver: BROTHER, reward: 800,
    intro: ['DARIO: The buyer wants a Comet GT. Any Comet GT.',
            'MARA: So I steal one. Like old times.'],
    steps: [
      { type: 'steal', text: 'Steal a sports car (press E near one)' },
      { type: 'deliver', place: 'garage', text: 'Bring it to the garage' },
    ],
  },
  {
    title: 'Neon Nights', giver: 'Luz', reward: 900,
    intro: ['LUZ: A package downtown. No questions, no cops.',
            'MARA: There are always cops, Luz.'],
    steps: [
      { type: 'goto', place: 'downtown', text: 'Pick up the package downtown' },
      { type: 'deliver', place: 'plaza', text: 'Drop it at Neon Plaza' },
    ],
  },
  {
    title: 'The Informant', giver: 'Luz', reward: 1200,
    intro: ['LUZ: My guy in the park knows where Reyes keeps the files.',
            'MARA: Parks, informants... this is getting old, Luz.'],
    steps: [
      { type: 'meet', place: 'park', text: 'Meet the informant in the park' },
      { type: 'escape', text: 'Lose the heat — get your wanted level to zero' },
    ],
  },
  {
    title: 'Harbor Lights', giver: BROTHER, reward: 1500,
    intro: ['DARIO: Crates at the port. Reyes has the docks watched.',
            'MARA: Then I go in quiet. Or loud. We will see.'],
    steps: [
      { type: 'goto', place: 'port', text: 'Reach the port crates' },
      { type: 'deliver', place: 'warehouse', text: 'Haul the crates to Warehouse 9' },
    ],
  },
  {
    title: "The Captain's Trap", giver: CAPTAIN, reward: 2000,
    intro: ['REYES: Voss! Drop the wheel and step out. This ends tonight.',
            'MARA: You brought a helicopter, Captain? I am flattered.'],
    steps: [
      { type: 'survive', seconds: 45, text: 'Survive the trap — 4 stars, helicopter overhead' },
      { type: 'escape', text: 'Break away and lose the heat' },
    ],
  },
  {
    title: 'Family Business', giver: BROTHER, reward: 2500,
    intro: ['DARIO: They grabbed me, Mara. Warehouse 9. Hurry.',
            'MARA: Hold on, little brother. I am coming through the front.'],
    steps: [
      { type: 'goto', place: 'warehouse', text: 'Fight your way to Warehouse 9' },
      { type: 'shoot', count: 6, text: 'Take down the crew holding Dario (0/6)' },
      { type: 'meet', place: 'warehouse', text: 'Get Dario out of there' },
    ],
  },
  {
    title: 'Solano Rising', giver: HERO, reward: 4000,
    intro: ['MARA: The files go to the Dome tonight. Reyes cannot stop us all.',
            'DARIO: Five stars, sis. Drive like you mean it.'],
    steps: [
      { type: 'goto', place: 'stadium', text: 'Reach the Solano Dome with the files' },
      { type: 'survive', seconds: 30, text: 'Hold the Dome until the broadcast starts' },
      { type: 'deliver', place: 'marina', text: 'Slip away to the marina — freedom' },
    ],
  },
];

// Radio: three procedural WebAudio stations, cycled with Q or keys 1-3.
export const RADIO = [
  { name: 'SOL 98.5', genre: 'SOLANO POP', bpm: 128, root: 57, wave: 'square', bright: true },
  { name: 'BAY FM', genre: 'SUNSET DRIVE', bpm: 92, root: 50, wave: 'triangle', bright: false },
  { name: 'NEON 104', genre: 'NIGHT ELECTRO', bpm: 122, root: 45, wave: 'sawtooth', bright: true },
];

export const TUNE = {
  playerWalk: 210, playerSprint: 330, playerHp: 100,
  carAccel: 620, carTop: 560, carReverse: 220, carTurn: 2.9, carGrip: 3.2,
  trafficCount: 26, pedCount: 42, parkedCount: 18,
  policeTop: 600, policeRam: 26, bustSeconds: 1.4,
  wantedDecaySeconds: 14, wantedHideSeconds: 9,
  bulletSpeed: 900, fireInterval: 0.16,
  taxiFare: 120, packageReward: 150,
  heliMinWanted: 4,
};
