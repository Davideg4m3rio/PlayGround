export const STAGES = [
  {
    id: 'neon', name: 'NEON ROOFTOP', subtitle: 'Sector 09 — Midnight',
    style: 'neon', sky: ['#070b1f', '#231044', '#4b1b58'], floor: '#101528',
    accent: '#4fe3ff', accent2: '#ff4d9d', fog: 'rgba(80,40,140,0.28)',
    particle: 'rain', music: 'neon',
  },
  {
    id: 'temple', name: 'SKY TEMPLE', subtitle: 'The Floating Monastery',
    style: 'temple', sky: ['#2a1745', '#b3435a', '#ffb36b'], floor: '#3a2b33',
    accent: '#ffcf7a', accent2: '#ff6f61', fog: 'rgba(255,160,110,0.16)',
    particle: 'petal', music: 'temple',
  },
  {
    id: 'volcano', name: 'MAGMA CORE', subtitle: 'Heart of the Titan',
    style: 'volcano', sky: ['#17060b', '#4e0c12', '#b3271b'], floor: '#25100f',
    accent: '#ff7a2f', accent2: '#ffd25e', fog: 'rgba(255,90,30,0.2)',
    particle: 'ember', music: 'volcano',
  },
  {
    id: 'glacier', name: 'FROZEN PEAK', subtitle: 'Where the Sky Sleeps',
    style: 'glacier', sky: ['#061729', '#0c3d5c', '#2b7f9e'], floor: '#0b2235',
    accent: '#7dd3ff', accent2: '#d6f6ff', fog: 'rgba(120,220,255,0.16)',
    particle: 'snow', music: 'glacier',
  },
  {
    id: 'void', name: 'VOID SANCTUM', subtitle: 'Between Worlds',
    style: 'void', sky: ['#050310', '#160b33', '#2b1554'], floor: '#0b0718',
    accent: '#a675ff', accent2: '#4fe3ff', fog: 'rgba(150,100,255,0.2)',
    particle: 'star', music: 'void',
  },
  {
    id: 'dojo', name: 'IRON DOJO', subtitle: 'Hall of a Thousand Strikes',
    style: 'dojo', sky: ['#0d1015', '#1c232b', '#39434d'], floor: '#1a1f25',
    accent: '#ffd27a', accent2: '#ff6f61', fog: 'rgba(255,210,120,0.1)',
    particle: 'dust', music: 'dojo',
  },
]

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]))

export function stageById(id) {
  return STAGE_BY_ID[id] || STAGES[0]
}
