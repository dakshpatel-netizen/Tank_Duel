import { MAP_SIZE_SCALES, type MapId, type MapSizeId } from '../config';
import type {
  DecorationObj,
  HillZoneSpot,
  MapDefinition,
  PowerPadData,
  RockObj,
  SpawnPoint,
  TerrainZone,
  TreeObj,
  WallObj,
} from '../types';

function makeDesertOutpost(): MapDefinition {
  const walls: WallObj[] = [];
  // Four L-shaped tactical bunkers at (+-28, +-28) facing center
  const corners: [number, number][] = [
    [28, 28],
    [-28, 28],
    [28, -28],
    [-28, -28],
  ];
  corners.forEach(([cx, cz], idx) => {
    const sx = Math.sign(cx);
    const sz = Math.sign(cz);
    walls.push({
      id: `l_h_${idx}`,
      x: cx - sx * 7.5,
      z: cz,
      w: 17,
      d: 2.2,
      h: 1.75,
      kind: 'wall',
    });
    walls.push({
      id: `l_v_${idx}`,
      x: cx,
      z: cz - sz * 7.5,
      w: 2.2,
      d: 17,
      h: 1.75,
      kind: 'wall',
    });
  });

  // Compact mid-outer tactical cover blocks well clear of spawn ring (r=53) and test lane (x=45)
  walls.push(
    { id: 'flank_e', x: 38, z: 0, w: 2.2, d: 10, h: 1.75, kind: 'wall' },
    { id: 'flank_w', x: -38, z: 0, w: 2.2, d: 10, h: 1.75, kind: 'wall' },
    { id: 'flank_s', x: 0, z: 38, w: 10, d: 2.2, h: 1.75, kind: 'wall' },
    { id: 'flank_n', x: 0, z: -38, w: 10, d: 2.2, h: 1.75, kind: 'wall' }
  );

  const rocks: RockObj[] = [
    { id: 'r0', x: 0, z: 0, r: 4.8, h: 3.6 },
    { id: 'r1', x: 11, z: 7, r: 3.4, h: 2.9 },
    { id: 'r2', x: -10, z: 6, r: 3.4, h: 2.8 },
    { id: 'r3', x: 5, z: -11, r: 3.8, h: 3.2 },
    { id: 'r4', x: -8, z: -9, r: 3.2, h: 2.6 },
  ];

  const crateCenters: [number, number][] = [
    [36, 0],
    [-36, 0],
    [0, 36],
    [0, -36],
    [22, -40],
    [-22, 40],
    [-38, -38],
    [38, 38],
  ];
  const crates: { id: string; x: number; z: number }[] = [];
  crateCenters.forEach(([gx, gz], gIdx) => {
    crates.push({ id: `c_${gIdx}_0`, x: gx - 1.0, z: gz });
    crates.push({ id: `c_${gIdx}_1`, x: gx + 1.0, z: gz });
    crates.push({ id: `c_${gIdx}_2`, x: gx, z: gz + 1.8 });
  });

  const barrelCoords: [number, number][] = [
    [19, 12],
    [19, -12],
    [-19, 12],
    [-19, -12],
    [42, 24],
    [-42, -24],
    [24, 42],
    [-24, -42],
    [12, 22],
    [-12, -22],
  ];
  const barrels = barrelCoords.map(([x, z], i) => ({ id: `b_${i}`, x, z }));

  const zones: TerrainZone[] = [
    { id: 'sp_1', type: 'speed_pad', shape: 'rect', x: 0, z: 26, w: 5, d: 10, dirX: 0, dirZ: -1 },
    { id: 'sp_2', type: 'speed_pad', shape: 'rect', x: 0, z: -26, w: 5, d: 10, dirX: 0, dirZ: 1 },
  ];

  const spawns: SpawnPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const deg = 15 + i * 30;
    const rad = (deg * Math.PI) / 180;
    const x = Math.cos(rad) * 53;
    const z = Math.sin(rad) * 53;
    const angle = Math.atan2(-x, -z);
    spawns.push({ x, z, angle, team: i % 2 === 0 ? 'red' : 'blue' });
  }

  const padCoords: [number, number][] = [
    [16, 0],
    [-16, 0],
    [0, 16],
    [0, -16],
    [37, 19],
    [-37, -19],
    [19, -37],
    [-19, 37],
    [52, 52],
    [-52, -52],
  ];
  const pads: PowerPadData[] = padCoords.map(([x, z], i) => ({ id: `pad_${i}`, x, z }));

  const hillSpots: HillZoneSpot[] = [
    { id: 'h0', x: 0, z: 0, r: 10 },
    { id: 'h1', x: 30, z: 0, r: 10 },
    { id: 'h2', x: -30, z: 0, r: 10 },
    { id: 'h3', x: 0, z: 30, r: 10 },
    { id: 'h4', x: 0, z: -30, r: 10 },
  ];

  const decorations: DecorationObj[] = [
    { kind: 'mesa', x: -96, z: -92, scale: 1.4, rot: 0.4 },
    { kind: 'mesa', x: 98, z: -90, scale: 1.25, rot: 1.1 },
    { kind: 'mesa', x: 94, z: 98, scale: 1.35, rot: 2.3 },
    { kind: 'mesa', x: -98, z: 94, scale: 1.2, rot: 0.8 },
    { kind: 'cactus', x: -75, z: 22, scale: 1.1, rot: 0.2 },
    { kind: 'cactus', x: 76, z: -20, scale: 1.0, rot: 1.5 },
    { kind: 'cactus', x: 18, z: 75, scale: 1.05, rot: 2.1 },
    { kind: 'cactus', x: -22, z: -75, scale: 1.15, rot: 0.9 },
  ];

  return {
    id: 'desert_outpost',
    name: 'Desert Outpost',
    description: 'Sun-baked sandstone canyon with L-bunkers, speed strips, and high-risk center rocks.',
    bestFor: 'Open fights',
    hazards: ['barrels', 'speed_pads'],
    width: 136,
    depth: 136,
    palette: {
      ground: '#D9A566',
      groundAccent: '#C28B4E',
      skyTop: '#2E1E59',
      skyBottom: '#F59E6C',
      fog: '#E4A876',
      sunColor: '#FFD19A',
      wallColor: '#8B6544',
      rockColor: '#9E734E',
    },
    sunElevationDeg: 25,
    walls,
    rocks,
    crates,
    barrels,
    trees: [],
    zones,
    spawns,
    pads,
    hillSpots,
    decorations,
  };
}

function makeIndustrialYard(): MapDefinition {
  const walls: WallObj[] = [];
  const horiz: [number, number][] = [
    [-50, -48],
    [-25, -48],
    [25, -48],
    [50, -48],
    [-50, 48],
    [-25, 48],
    [25, 48],
    [50, 48],
  ];
  horiz.forEach(([x, z], i) => {
    walls.push({ id: `ch_${i}`, x, z, w: 12, d: 2.6, h: 2.8, kind: 'container' });
  });
  const vert: [number, number][] = [
    [-38, -16],
    [-38, 16],
    [38, -16],
    [38, 16],
    [-62, -16],
    [-62, 16],
    [62, -16],
    [62, 16],
  ];
  vert.forEach(([x, z], i) => {
    walls.push({ id: `cv_${i}`, x, z, w: 2.6, d: 12, h: 2.8, kind: 'container' });
  });

  // Central loading area
  walls.push({ id: 'cw_0', x: 0, z: 10, w: 10, d: 2, h: 2.4, kind: 'wall' });
  walls.push({ id: 'cw_1', x: 0, z: -10, w: 10, d: 2, h: 2.4, kind: 'wall' });
  walls.push({ id: 'cw_2', x: 10, z: 0, w: 2, d: 10, h: 2.4, kind: 'wall' });
  walls.push({ id: 'cw_3', x: -10, z: 0, w: 2, d: 10, h: 2.4, kind: 'wall' });

  const barrelClusters: [number, number][] = [
    [38, 8],
    [-38, 8],
    [38, -8],
    [-38, -8],
    [8, 38],
    [-8, 38],
    [8, -38],
    [-8, -38],
    [0, 62],
    [0, -62],
  ];
  const barrels: { id: string; x: number; z: number }[] = [];
  barrelClusters.forEach(([bx, bz], i) => {
    barrels.push({ id: `ib_${i}_0`, x: bx, z: bz });
    if (i < 4) barrels.push({ id: `ib_${i}_1`, x: bx + 1.8, z: bz + 1.2 });
  });

  const crateCenters: [number, number][] = [
    [70, 0],
    [-70, 0],
    [0, 70],
    [0, -70],
  ];
  const crates: { id: string; x: number; z: number }[] = [];
  crateCenters.forEach(([cx, cz], idx) => {
    crates.push({ id: `ic_${idx}_0`, x: cx - 1, z: cz - 1 });
    crates.push({ id: `ic_${idx}_1`, x: cx + 1, z: cz - 1 });
    crates.push({ id: `ic_${idx}_2`, x: cx - 1, z: cz + 1 });
    crates.push({ id: `ic_${idx}_3`, x: cx + 1, z: cz + 1 });
  });

  const spawns: SpawnPoint[] = [
    // North edge
    { x: -35, z: -68, angle: 0, team: 'red' },
    { x: 0, z: -68, angle: 0, team: 'red' },
    { x: 35, z: -68, angle: 0, team: 'red' },
    // South edge
    { x: -35, z: 68, angle: Math.PI, team: 'blue' },
    { x: 0, z: 68, angle: Math.PI, team: 'blue' },
    { x: 35, z: 68, angle: Math.PI, team: 'blue' },
    // West edge
    { x: -68, z: -32, angle: Math.PI / 2, team: 'red' },
    { x: -68, z: 0, angle: Math.PI / 2, team: 'red' },
    { x: -68, z: 32, angle: Math.PI / 2, team: 'blue' },
    // East edge
    { x: 68, z: -32, angle: -Math.PI / 2, team: 'red' },
    { x: 68, z: 0, angle: -Math.PI / 2, team: 'blue' },
    { x: 68, z: 32, angle: -Math.PI / 2, team: 'blue' },
  ];

  const padCoords: [number, number][] = [
    [20, 32],
    [-20, 32],
    [20, -32],
    [-20, -32],
    [50, 32],
    [-50, 32],
    [50, -32],
    [-50, -32],
    [55, 0],
    [-55, 0],
    [0, 35],
    [0, -35],
  ];
  const pads: PowerPadData[] = padCoords.map(([x, z], i) => ({ id: `ipad_${i}`, x, z }));

  const hillSpots: HillZoneSpot[] = [
    { id: 'ih0', x: 0, z: 0, r: 10 },
    { id: 'ih1', x: 0, z: 32, r: 10 },
    { id: 'ih2', x: 0, z: -32, r: 10 },
    { id: 'ih3', x: 48, z: 0, r: 10 },
    { id: 'ih4', x: -48, z: 0, r: 10 },
  ];

  return {
    id: 'industrial_yard',
    name: 'Industrial Yard',
    description: 'Shipping container corridors, loading dock choke points, and ambush sightlines.',
    bestFor: 'Close fights',
    hazards: ['barrels'],
    width: 160,
    depth: 160,
    palette: {
      ground: '#647082',
      groundAccent: '#4E5868',
      skyTop: '#26344E',
      skyBottom: '#7E90A8',
      fog: '#7B8A9E',
      sunColor: '#DCE8F5',
      wallColor: '#475569',
      rockColor: '#6B7280',
    },
    sunElevationDeg: 48,
    walls,
    rocks: [],
    crates,
    barrels,
    trees: [],
    zones: [],
    spawns,
    pads,
    hillSpots,
    decorations: [
      { kind: 'crane', x: -102, z: -96, scale: 1.2, rot: 0.4 },
      { kind: 'crane', x: 104, z: 98, scale: 1.3, rot: 2.4 },
    ],
  };
}

function makeFrozenLake(): MapDefinition {
  const zones: TerrainZone[] = [
    { id: 'ice_center', type: 'ice', shape: 'circle', x: 0, z: 0, r: 45 },
  ];

  // Ring of 14 rocks around r=52 with 6 gaps for entry
  const rocks: RockObj[] = [];
  const gapAngles = new Set([0, 60, 120, 180, 240, 300]);
  let rockIdx = 0;
  for (let deg = 0; deg < 360; deg += 18) {
    if (Array.from(gapAngles).some((g) => Math.abs(deg - g) <= 10)) continue;
    if (rockIdx >= 14) break;
    const rad = (deg * Math.PI) / 180;
    const dist = 52 + (rockIdx % 2 === 0 ? 0 : 4);
    rocks.push({
      id: `fr_${rockIdx}`,
      x: Math.round(Math.cos(rad) * dist * 10) / 10,
      z: Math.round(Math.sin(rad) * dist * 10) / 10,
      r: rockIdx % 3 === 0 ? 4.5 : 3.5,
      h: 3.2,
    });
    rockIdx++;
  }

  // 6 ice blocks (4x4) inside the ice
  const iceBlockCoords: [number, number][] = [
    [12, 12],
    [-12, 12],
    [12, -12],
    [-12, -12],
    [25, 0],
    [-25, 0],
  ];
  const walls: WallObj[] = iceBlockCoords.map(([x, z], i) => ({
    id: `ice_blk_${i}`,
    x,
    z,
    w: 4,
    d: 4,
    h: 2.6,
    kind: 'wall',
  }));

  const barrels: { id: string; x: number; z: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const rad = ((i * 60 + 30) * Math.PI) / 180;
    barrels.push({
      id: `fb_${i}`,
      x: Math.round(Math.cos(rad) * 60 * 10) / 10,
      z: Math.round(Math.sin(rad) * 60 * 10) / 10,
    });
  }

  const spawns: SpawnPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const rad = ((i * 30) * Math.PI) / 180;
    const x = Math.cos(rad) * 68;
    const z = Math.sin(rad) * 68;
    spawns.push({ x, z, angle: Math.atan2(-x, -z), team: i % 2 === 0 ? 'red' : 'blue' });
  }

  const pads: PowerPadData[] = [
    { id: 'fp_0', x: 14, z: 0 },
    { id: 'fp_1', x: -14, z: 0 },
    { id: 'fp_2', x: 0, z: 14 },
    { id: 'fp_3', x: 0, z: -14 },
    { id: 'fp_4', x: 58, z: 22 },
    { id: 'fp_5', x: -58, z: 22 },
    { id: 'fp_6', x: 58, z: -22 },
    { id: 'fp_7', x: -58, z: -22 },
    { id: 'fp_8', x: 0, z: 62 },
    { id: 'fp_9', x: 0, z: -62 },
  ];

  const hillSpots: HillZoneSpot[] = [
    { id: 'fh0', x: 0, z: 0, r: 10 },
    { id: 'fh1', x: 24, z: 24, r: 10 },
    { id: 'fh2', x: -24, z: -24, r: 10 },
    { id: 'fh3', x: 0, z: 60, r: 10 },
    { id: 'fh4', x: 0, z: -60, r: 10 },
  ];

  return {
    id: 'frozen_lake',
    name: 'Frozen Lake',
    description: 'Slick drifting ice arena encircled by snowdrifts, glacial cover blocks, and rocky shore.',
    bestFor: 'Drift duels',
    hazards: ['ice', 'barrels'],
    width: 160,
    depth: 160,
    palette: {
      ground: '#DCEAF7',
      groundAccent: '#BBD6F2',
      skyTop: '#0F2547',
      skyBottom: '#7CD4E8',
      fog: '#CFE4F7',
      sunColor: '#E8F6FF',
      wallColor: '#7CC6EB',
      rockColor: '#69839E',
    },
    sunElevationDeg: 35,
    walls,
    rocks,
    crates: [
      { id: 'fc_0', x: 38, z: 38 },
      { id: 'fc_1', x: -38, z: -38 },
      { id: 'fc_2', x: 38, z: -38 },
      { id: 'fc_3', x: -38, z: 38 },
    ],
    barrels,
    trees: [],
    zones,
    spawns,
    pads,
    hillSpots,
    decorations: [],
  };
}

function makeForestMaze(): MapDefinition {
  // 18 symmetric hedge walls (24 x 2) forming loose 14m+ lanes with 4 clearings at (+-40, +-40)
  const walls: WallObj[] = [
    // 8 axial walls
    { id: 'mh_0', x: 30, z: 16, w: 24, d: 2, h: 3, kind: 'hedge' },
    { id: 'mh_1', x: -30, z: 16, w: 24, d: 2, h: 3, kind: 'hedge' },
    { id: 'mh_2', x: 30, z: -16, w: 24, d: 2, h: 3, kind: 'hedge' },
    { id: 'mh_3', x: -30, z: -16, w: 24, d: 2, h: 3, kind: 'hedge' },
    { id: 'mv_0', x: 16, z: 30, w: 2, d: 24, h: 3, kind: 'hedge' },
    { id: 'mv_1', x: -16, z: 30, w: 2, d: 24, h: 3, kind: 'hedge' },
    { id: 'mv_2', x: 16, z: -30, w: 2, d: 24, h: 3, kind: 'hedge' },
    { id: 'mv_3', x: -16, z: -30, w: 2, d: 24, h: 3, kind: 'hedge' },
    // 10 outer lane walls
    { id: 'mo_0', x: 60, z: 24, w: 24, d: 2, h: 3, kind: 'hedge' },
    { id: 'mo_1', x: -60, z: 24, w: 24, d: 2, h: 3, kind: 'hedge' },
    { id: 'mo_2', x: 60, z: -24, w: 24, d: 2, h: 3, kind: 'hedge' },
    { id: 'mo_3', x: -60, z: -24, w: 24, d: 2, h: 3, kind: 'hedge' },
    { id: 'mo_4', x: 24, z: 60, w: 2, d: 24, h: 3, kind: 'hedge' },
    { id: 'mo_5', x: -24, z: 60, w: 2, d: 24, h: 3, kind: 'hedge' },
    { id: 'mo_6', x: 24, z: -60, w: 2, d: 24, h: 3, kind: 'hedge' },
    { id: 'mo_7', x: -24, z: -60, w: 2, d: 24, h: 3, kind: 'hedge' },
    { id: 'mo_8', x: 0, z: 46, w: 24, d: 2, h: 3, kind: 'hedge' },
    { id: 'mo_9', x: 0, z: -46, w: 24, d: 2, h: 3, kind: 'hedge' },
  ];

  // 6 mud patches r9
  const mudCoords: [number, number][] = [
    [30, 0],
    [-30, 0],
    [0, 30],
    [0, -30],
    [55, 55],
    [-55, -55],
  ];
  const zones: TerrainZone[] = mudCoords.map(([x, z], i) => ({
    id: `mud_${i}`,
    type: 'mud',
    shape: 'circle',
    x,
    z,
    r: 9,
  }));

  // 40 trees along maze edges & clearings (r 0.8)
  const trees: TreeObj[] = [];
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2;
    const ring = i % 2 === 0 ? 69 : 50;
    const tx = Math.round(Math.cos(angle) * ring * 10) / 10;
    const tz = Math.round(Math.sin(angle) * ring * 10) / 10;
    trees.push({ id: `tr_${i}`, x: tx, z: tz, r: 0.8, h: 4.5 + (i % 3) * 0.8 });
  }

  const barrels: { id: string; x: number; z: number }[] = [
    { id: 'fb0', x: 34, z: 34 },
    { id: 'fb1', x: -34, z: 34 },
    { id: 'fb2', x: 34, z: -34 },
    { id: 'fb3', x: -34, z: -34 },
    { id: 'fb4', x: 46, z: 46 },
    { id: 'fb5', x: -46, z: 46 },
    { id: 'fb6', x: 46, z: -46 },
    { id: 'fb7', x: -46, z: -46 },
  ];

  const crates: { id: string; x: number; z: number }[] = [
    { id: 'mc0', x: 8, z: 0 },
    { id: 'mc1', x: -8, z: 0 },
    { id: 'mc2', x: 0, z: 8 },
    { id: 'mc3', x: 0, z: -8 },
    { id: 'mc4', x: 48, z: 0 },
    { id: 'mc5', x: -48, z: 0 },
    { id: 'mc6', x: 0, z: 64 },
    { id: 'mc7', x: 0, z: -64 },
    { id: 'mc8', x: 64, z: 40 },
    { id: 'mc9', x: -64, z: -40 },
  ];

  const spawns: SpawnPoint[] = [
    { x: 40, z: 40, angle: -Math.PI * 0.75, team: 'blue' },
    { x: -40, z: 40, angle: Math.PI * 0.75, team: 'red' },
    { x: 40, z: -40, angle: -Math.PI * 0.25, team: 'blue' },
    { x: -40, z: -40, angle: Math.PI * 0.25, team: 'red' },
    { x: 70, z: 0, angle: -Math.PI / 2, team: 'blue' },
    { x: -70, z: 0, angle: Math.PI / 2, team: 'red' },
    { x: 0, z: 70, angle: Math.PI, team: 'blue' },
    { x: 0, z: -70, angle: 0, team: 'red' },
    { x: 70, z: 50, angle: -Math.PI / 2, team: 'blue' },
    { x: -70, z: 50, angle: Math.PI / 2, team: 'red' },
    { x: 70, z: -50, angle: -Math.PI / 2, team: 'blue' },
    { x: -70, z: -50, angle: Math.PI / 2, team: 'red' },
  ];

  const pads: PowerPadData[] = [
    { id: 'mp0', x: 40, z: 40 },
    { id: 'mp1', x: -40, z: 40 },
    { id: 'mp2', x: 40, z: -40 },
    { id: 'mp3', x: -40, z: -40 },
    { id: 'mp4', x: 24, z: 0 },
    { id: 'mp5', x: -24, z: 0 },
    { id: 'mp6', x: 0, z: 24 },
    { id: 'mp7', x: 0, z: -24 },
    { id: 'mp8', x: 64, z: 12 },
    { id: 'mp9', x: -64, z: 12 },
    { id: 'mp10', x: 64, z: -12 },
    { id: 'mp11', x: -64, z: -12 },
  ];

  const hillSpots: HillZoneSpot[] = [
    { id: 'mh0', x: 0, z: 0, r: 10 },
    { id: 'mh1', x: 40, z: 40, r: 10 },
    { id: 'mh2', x: -40, z: 40, r: 10 },
    { id: 'mh3', x: 40, z: -40, r: 10 },
    { id: 'mh4', x: -40, z: -40, r: 10 },
  ];

  return {
    id: 'forest_maze',
    name: 'Forest Maze',
    description: 'Tall hedge lanes, boggy mud traps, and pine clearings built for ambush play.',
    bestFor: 'Stealth ambush',
    hazards: ['mud', 'barrels'],
    width: 160,
    depth: 160,
    palette: {
      ground: '#4C7C46',
      groundAccent: '#3C6637',
      skyTop: '#1F3A3D',
      skyBottom: '#88C48E',
      fog: '#74A97E',
      sunColor: '#FFF3C4',
      wallColor: '#2E5931',
      rockColor: '#6E7A6A',
    },
    sunElevationDeg: 40,
    walls,
    rocks: [],
    crates,
    barrels,
    trees,
    zones,
    spawns,
    pads,
    hillSpots,
    decorations: [],
  };
}

function makeTwinBases(): MapDefinition {
  // 200 x 120 CTF arena
  const walls: WallObj[] = [
    // Red base U-wall behind flag (-85, 0)
    { id: 'ru_back', x: -91, z: 0, w: 2, d: 14, h: 3, kind: 'wall' },
    { id: 'ru_top', x: -85, z: -7, w: 12, d: 2, h: 3, kind: 'wall' },
    { id: 'ru_bot', x: -85, z: 7, w: 12, d: 2, h: 3, kind: 'wall' },
    // Blue base U-wall behind flag (+85, 0)
    { id: 'bu_back', x: 91, z: 0, w: 2, d: 14, h: 3, kind: 'wall' },
    { id: 'bu_top', x: 85, z: -7, w: 12, d: 2, h: 3, kind: 'wall' },
    { id: 'bu_bot', x: 85, z: 7, w: 12, d: 2, h: 3, kind: 'wall' },
    // Center ridge wall along x=0 with 3 gaps (14m wide) at z=-35, 0, 35
    { id: 'cr_0', x: 0, z: -51, w: 2, d: 18, h: 3.4, kind: 'wall' },
    { id: 'cr_1', x: 0, z: -17.5, w: 2, d: 21, h: 3.4, kind: 'wall' },
    { id: 'cr_2', x: 0, z: 17.5, w: 2, d: 21, h: 3.4, kind: 'wall' },
    { id: 'cr_3', x: 0, z: 51, w: 2, d: 18, h: 3.4, kind: 'wall' },
    // Mid-field cover walls (+-25, +-45)
    { id: 'mw_0', x: -25, z: -42, w: 14, d: 2, h: 2.8, kind: 'wall' },
    { id: 'mw_1', x: -25, z: 42, w: 14, d: 2, h: 2.8, kind: 'wall' },
    { id: 'mw_2', x: 25, z: -42, w: 14, d: 2, h: 2.8, kind: 'wall' },
    { id: 'mw_3', x: 25, z: 42, w: 14, d: 2, h: 2.8, kind: 'wall' },
  ];

  const rocks: RockObj[] = [
    { id: 'tr_0', x: -40, z: 0, r: 5, h: 3.4 },
    { id: 'tr_1', x: 40, z: 0, r: 5, h: 3.4 },
    { id: 'tr_2', x: -6, z: -35, r: 2.6, h: 2.5 },
    { id: 'tr_3', x: 6, z: 35, r: 2.6, h: 2.5 },
    { id: 'tr_4', x: -6, z: 4, r: 2.4, h: 2.5 },
    { id: 'tr_5', x: 6, z: -4, r: 2.4, h: 2.5 },
  ];

  const crates: { id: string; x: number; z: number }[] = [
    { id: 'tc0', x: -35, z: -20 },
    { id: 'tc1', x: -35, z: -18 },
    { id: 'tc2', x: -35, z: 20 },
    { id: 'tc3', x: -35, z: 18 },
    { id: 'tc4', x: 35, z: -20 },
    { id: 'tc5', x: 35, z: -18 },
    { id: 'tc6', x: 35, z: 20 },
    { id: 'tc7', x: 35, z: 18 },
  ];

  const barrels: { id: string; x: number; z: number }[] = [
    { id: 'tb0', x: -55, z: -30 },
    { id: 'tb1', x: -55, z: 0 },
    { id: 'tb2', x: -55, z: 30 },
    { id: 'tb3', x: 55, z: -30 },
    { id: 'tb4', x: 55, z: 0 },
    { id: 'tb5', x: 55, z: 30 },
  ];

  const zones: TerrainZone[] = [
    { id: 'tsp0', type: 'speed_pad', shape: 'rect', x: -30, z: -50, w: 20, d: 5, dirX: 1, dirZ: 0 },
    { id: 'tsp1', type: 'speed_pad', shape: 'rect', x: 30, z: -50, w: 20, d: 5, dirX: -1, dirZ: 0 },
    { id: 'tsp2', type: 'speed_pad', shape: 'rect', x: -30, z: 50, w: 20, d: 5, dirX: 1, dirZ: 0 },
    { id: 'tsp3', type: 'speed_pad', shape: 'rect', x: 30, z: 50, w: 20, d: 5, dirX: -1, dirZ: 0 },
  ];

  const spawns: SpawnPoint[] = [
    // Red (left)
    { x: -72, z: -28, angle: Math.PI / 2, team: 'red' },
    { x: -72, z: -14, angle: Math.PI / 2, team: 'red' },
    { x: -72, z: 14, angle: Math.PI / 2, team: 'red' },
    { x: -72, z: 28, angle: Math.PI / 2, team: 'red' },
    { x: -84, z: -36, angle: Math.PI / 2, team: 'red' },
    { x: -84, z: 36, angle: Math.PI / 2, team: 'red' },
    // Blue (right)
    { x: 72, z: -28, angle: -Math.PI / 2, team: 'blue' },
    { x: 72, z: -14, angle: -Math.PI / 2, team: 'blue' },
    { x: 72, z: 14, angle: -Math.PI / 2, team: 'blue' },
    { x: 72, z: 28, angle: -Math.PI / 2, team: 'blue' },
    { x: 84, z: -36, angle: -Math.PI / 2, team: 'blue' },
    { x: 84, z: 36, angle: -Math.PI / 2, team: 'blue' },
  ];

  const pads: PowerPadData[] = [
    { id: 'tp0', x: -65, z: -20, team: 'red' },
    { id: 'tp1', x: -65, z: 20, team: 'red' },
    { id: 'tp2', x: -45, z: -40, team: 'red' },
    { id: 'tp3', x: -45, z: 40, team: 'red' },
    { id: 'tp4', x: -20, z: -16, team: 'red' },
    { id: 'tp5', x: -20, z: 16, team: 'red' },
    { id: 'tp6', x: 65, z: -20, team: 'blue' },
    { id: 'tp7', x: 65, z: 20, team: 'blue' },
    { id: 'tp8', x: 45, z: -40, team: 'blue' },
    { id: 'tp9', x: 45, z: 40, team: 'blue' },
    { id: 'tp10', x: 20, z: -16, team: 'blue' },
    { id: 'tp11', x: 20, z: 16, team: 'blue' },
    { id: 'tp12', x: 0, z: -35 },
    { id: 'tp13', x: 0, z: 35 },
  ];

  const hillSpots: HillZoneSpot[] = [
    { id: 'th0', x: 0, z: 0, r: 10 },
    { id: 'th1', x: 0, z: -35, r: 10 },
    { id: 'th2', x: 0, z: 35, r: 10 },
    { id: 'th3', x: -45, z: 0, r: 10 },
    { id: 'th4', x: 45, z: 0, r: 10 },
  ];

  return {
    id: 'twin_bases',
    name: 'Twin Bases',
    description: 'Symmetrical Red vs Blue stronghold split by a 3-gate ridge and fast flank rails.',
    bestFor: 'Flag battle',
    hazards: ['barrels', 'speed_pads'],
    width: 200,
    depth: 120,
    palette: {
      ground: '#7C8596',
      groundAccent: '#5C6577',
      skyTop: '#1A3463',
      skyBottom: '#9EC8F5',
      fog: '#8EB3DC',
      sunColor: '#FFF8E8',
      wallColor: '#4B5568',
      rockColor: '#667185',
    },
    sunElevationDeg: 55,
    walls,
    rocks,
    crates,
    barrels,
    trees: [],
    zones,
    spawns,
    pads,
    hillSpots,
    ctfBases: {
      red: { flagX: -85, flagZ: 0, capX: -80, capZ: 0 },
      blue: { flagX: 85, flagZ: 0, capX: 80, capZ: 0 },
    },
    decorations: [
      { kind: 'banner_red', x: -94, z: -18, scale: 1.2, rot: 0 },
      { kind: 'banner_red', x: -94, z: 18, scale: 1.2, rot: 0 },
      { kind: 'banner_blue', x: 94, z: -18, scale: 1.2, rot: Math.PI },
      { kind: 'banner_blue', x: 94, z: 18, scale: 1.2, rot: Math.PI },
    ],
  };
}

function makeCraterHill(): MapDefinition {
  // Raised circular crater rim around center r=30, thickness 3, 4 gaps 12m wide at N, E, S, W
  const walls: WallObj[] = [];
  const segCount = 24;
  const r = 30;
  for (let i = 0; i < segCount; i++) {
    const deg = i * (360 / segCount);
    // Leave 4 gaps around 0, 90, 180, 270
    if (
      Math.abs(deg - 0) < 16 ||
      Math.abs(deg - 360) < 16 ||
      Math.abs(deg - 90) < 16 ||
      Math.abs(deg - 180) < 16 ||
      Math.abs(deg - 270) < 16
    ) {
      continue;
    }
    const rad = (deg * Math.PI) / 180;
    const x = Math.round(Math.cos(rad) * r * 10) / 10;
    const z = Math.round(Math.sin(rad) * r * 10) / 10;
    // Axis-aligned segments approximating the arc
    const horiz = Math.abs(Math.sin(rad)) > Math.abs(Math.cos(rad));
    walls.push({
      id: `cr_rim_${i}`,
      x,
      z,
      w: horiz ? 8.2 : 3.2,
      d: horiz ? 3.2 : 8.2,
      h: 3.2,
      kind: 'crater_rim',
    });
  }

  const rocks: RockObj[] = [];
  for (let i = 0; i < 16; i++) {
    const rad = ((i * 22.5 + 11) * Math.PI) / 180;
    const dist = 42 + (i % 3) * 7;
    rocks.push({
      id: `ck_r_${i}`,
      x: Math.round(Math.cos(rad) * dist * 10) / 10,
      z: Math.round(Math.sin(rad) * dist * 10) / 10,
      r: 3.0 + (i % 3) * 0.6,
      h: 3.4,
    });
  }

  const crates: { id: string; x: number; z: number }[] = [
    { id: 'cc0', x: 18, z: 18 },
    { id: 'cc1', x: -18, z: 18 },
    { id: 'cc2', x: 18, z: -18 },
    { id: 'cc3', x: -18, z: -18 },
    { id: 'cc4', x: 56, z: 22 },
    { id: 'cc5', x: -56, z: 22 },
    { id: 'cc6', x: 56, z: -22 },
    { id: 'cc7', x: -56, z: -22 },
  ];

  const barrels: { id: string; x: number; z: number }[] = [
    { id: 'cb0', x: 0, z: 22 },
    { id: 'cb1', x: 0, z: -22 },
    { id: 'cb2', x: 22, z: 0 },
    { id: 'cb3', x: -22, z: 0 },
    { id: 'cb4', x: 38, z: 38 },
    { id: 'cb5', x: -38, z: 38 },
    { id: 'cb6', x: 38, z: -38 },
    { id: 'cb7', x: -38, z: -38 },
    { id: 'cb8', x: 64, z: 0 },
    { id: 'cb9', x: -64, z: 0 },
  ];

  const spawns: SpawnPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const rad = ((i * 30 + 15) * Math.PI) / 180;
    const x = Math.cos(rad) * 70;
    const z = Math.sin(rad) * 70;
    spawns.push({ x, z, angle: Math.atan2(-x, -z), team: i % 2 === 0 ? 'red' : 'blue' });
  }

  const pads: PowerPadData[] = [
    { id: 'cp0', x: 12, z: 12 },
    { id: 'cp1', x: -12, z: 12 },
    { id: 'cp2', x: 12, z: -12 },
    { id: 'cp3', x: -12, z: -12 },
    { id: 'cp4', x: 0, z: 48 },
    { id: 'cp5', x: 0, z: -48 },
    { id: 'cp6', x: 48, z: 0 },
    { id: 'cp7', x: -48, z: 0 },
    { id: 'cp8', x: 52, z: 52 },
    { id: 'cp9', x: -52, z: 52 },
    { id: 'cp10', x: 52, z: -52 },
    { id: 'cp11', x: -52, z: -52 },
  ];

  const hillSpots: HillZoneSpot[] = [
    { id: 'kh0', x: 0, z: 0, r: 10 },
    { id: 'kh1', x: 0, z: -48, r: 10 },
    { id: 'kh2', x: 48, z: 0, r: 10 },
    { id: 'kh3', x: 0, z: 48, r: 10 },
    { id: 'kh4', x: -48, z: 0, r: 10 },
  ];

  return {
    id: 'crater_hill',
    name: 'Crater Hill',
    description: 'Volcanic caldera rim with 4 fortress gates, ember glow, and rotating hill points.',
    bestFor: 'Hill control',
    hazards: ['barrels'],
    width: 160,
    depth: 160,
    palette: {
      ground: '#5A4640',
      groundAccent: '#7C3E2A',
      skyTop: '#23101E',
      skyBottom: '#D65A38',
      fog: '#7B4035',
      sunColor: '#FF9E6D',
      wallColor: '#46332E',
      rockColor: '#3D2F2D',
    },
    sunElevationDeg: 28,
    walls,
    rocks,
    crates,
    barrels,
    trees: [],
    zones: [],
    spawns,
    pads,
    hillSpots,
    decorations: [],
  };
}

const BASE_MAPS: Record<MapId, () => MapDefinition> = {
  desert_outpost: makeDesertOutpost,
  industrial_yard: makeIndustrialYard,
  frozen_lake: makeFrozenLake,
  forest_maze: makeForestMaze,
  twin_bases: makeTwinBases,
  crater_hill: makeCraterHill,
};

export const ALL_MAP_IDS: MapId[] = [
  'desert_outpost',
  'industrial_yard',
  'frozen_lake',
  'forest_maze',
  'twin_bases',
  'crater_hill',
];

export const MAPS: Record<MapId, MapDefinition> = {
  desert_outpost: makeDesertOutpost(),
  industrial_yard: makeIndustrialYard(),
  frozen_lake: makeFrozenLake(),
  forest_maze: makeForestMaze(),
  twin_bases: makeTwinBases(),
  crater_hill: makeCraterHill(),
};

export function buildMap(mapId: MapId, size: MapSizeId = 'medium'): MapDefinition {
  const base = BASE_MAPS[mapId]();
  const s = MAP_SIZE_SCALES[size].scale;
  if (s === 1) return base;

  const scaleVal = (v: number) => Math.round(v * s * 100) / 100;
  return {
    ...base,
    width: Math.round(base.width * s),
    depth: Math.round(base.depth * s),
    walls: base.walls.map((w) => ({
      ...w,
      x: scaleVal(w.x),
      z: scaleVal(w.z),
      w: scaleVal(w.w),
      d: scaleVal(w.d),
    })),
    rocks: base.rocks.map((r) => ({
      ...r,
      x: scaleVal(r.x),
      z: scaleVal(r.z),
      r: Math.max(1.5, scaleVal(r.r)),
    })),
    crates: base.crates.map((c) => ({ ...c, x: scaleVal(c.x), z: scaleVal(c.z) })),
    barrels: base.barrels.map((b) => ({ ...b, x: scaleVal(b.x), z: scaleVal(b.z) })),
    trees: base.trees.map((t) => ({ ...t, x: scaleVal(t.x), z: scaleVal(t.z) })),
    zones: base.zones.map((z) => ({
      ...z,
      x: scaleVal(z.x),
      z: scaleVal(z.z),
      r: z.r ? scaleVal(z.r) : undefined,
      w: z.w ? scaleVal(z.w) : undefined,
      d: z.d ? scaleVal(z.d) : undefined,
    })),
    spawns: base.spawns.map((sp) => ({ ...sp, x: scaleVal(sp.x), z: scaleVal(sp.z) })),
    pads: base.pads.map((p) => ({ ...p, x: scaleVal(p.x), z: scaleVal(p.z) })),
    hillSpots: base.hillSpots.map((h) => ({
      ...h,
      x: scaleVal(h.x),
      z: scaleVal(h.z),
      r: Math.max(7, scaleVal(h.r)),
    })),
    ctfBases: base.ctfBases
      ? {
          red: {
            flagX: scaleVal(base.ctfBases.red.flagX),
            flagZ: scaleVal(base.ctfBases.red.flagZ),
            capX: scaleVal(base.ctfBases.red.capX),
            capZ: scaleVal(base.ctfBases.red.capZ),
          },
          blue: {
            flagX: scaleVal(base.ctfBases.blue.flagX),
            flagZ: scaleVal(base.ctfBases.blue.flagZ),
            capX: scaleVal(base.ctfBases.blue.capX),
            capZ: scaleVal(base.ctfBases.blue.capZ),
          },
        }
      : undefined,
    decorations: base.decorations.map((d) => ({ ...d, x: scaleVal(d.x), z: scaleVal(d.z) })),
  };
}

// Path connectivity validator (checks all spawns can reach all power pads on a 2m grid)
export function validateMapConnectivity(map: MapDefinition): boolean {
  const step = 2.0;
  const cols = Math.floor(map.width / step);
  const rows = Math.floor(map.depth / step);
  const halfW = map.width / 2;
  const halfD = map.depth / 2;

  const isBlocked = (wx: number, wz: number): boolean => {
    const pad = 1.2;
    if (Math.abs(wx) > halfW - 2 || Math.abs(wz) > halfD - 2) return true;
    for (const w of map.walls) {
      if (Math.abs(wx - w.x) < w.w / 2 + pad && Math.abs(wz - w.z) < w.d / 2 + pad) return true;
    }
    for (const r of map.rocks) {
      const dx = wx - r.x;
      const dz = wz - r.z;
      if (dx * dx + dz * dz < (r.r + pad) * (r.r + pad)) return true;
    }
    return false;
  };

  const toCell = (wx: number, wz: number): [number, number] => [
    Math.max(0, Math.min(cols - 1, Math.floor((wx + halfW) / step))),
    Math.max(0, Math.min(rows - 1, Math.floor((wz + halfD) / step))),
  ];

  const start = map.spawns[0];
  if (!start) return false;
  const [sc, sr] = toCell(start.x, start.z);
  const visited = new Uint8Array(cols * rows);
  const queue: number[] = [sr * cols + sc];
  visited[sr * cols + sc] = 1;

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    const neighbors = [
      [c + 1, r],
      [c - 1, r],
      [c, r + 1],
      [c, r - 1],
    ];
    for (const [nc, nr] of neighbors) {
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const nIdx = nr * cols + nc;
      if (visited[nIdx]) continue;
      const wx = nc * step - halfW + step * 0.5;
      const wz = nr * step - halfD + step * 0.5;
      if (isBlocked(wx, wz)) continue;
      visited[nIdx] = 1;
      queue.push(nIdx);
    }
  }

  for (const sp of map.spawns) {
    const [c, r] = toCell(sp.x, sp.z);
    if (!visited[r * cols + c]) return false;
  }
  for (const p of map.pads) {
    const [c, r] = toCell(p.x, p.z);
    if (!visited[r * cols + c]) return false;
  }
  return true;
}
