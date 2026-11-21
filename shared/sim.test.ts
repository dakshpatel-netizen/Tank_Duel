import test from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, TANK_CLASSES } from './config';
import { ALL_MAP_IDS, buildMap, validateMapConnectivity } from './maps/index';
import { deduplicateNickname, sanitizeNickname } from './protocol';
import {
  applyDamageToTank,
  createSimState,
  stepSim,
  stepTank,
} from './sim';
import type { LobbyPlayerInfo, MatchSettings, PlayerInput, SimEvent } from './types';

function makeSettings(overrides: Partial<MatchSettings> = {}): MatchSettings {
  return {
    mode: 'ffa',
    mapId: 'desert_outpost',
    mapSize: 'medium',
    timeLimitSec: 480,
    scoreLimit: 15,
    powerBoxesEnabled: true,
    botCount: 0,
    botDifficulty: 'medium',
    friendlyFire: false,
    tankRule: 'classes',
    classicHp: 100,
    shrinkingZone: false,
    password: '',
    ...overrides,
  };
}

function makePlayer(id: string, name: string, classId: 'scout' | 'standard' | 'heavy' = 'standard', team: 'red' | 'blue' | 'none' = 'none'): LobbyPlayerInfo {
  return {
    id,
    name,
    isHost: id === 'p1',
    isBot: false,
    ready: true,
    team,
    custom: { classId, colorId: 'red', turretStyle: 'dome', decal: 'stripes' },
    pingMs: 20,
    joinedAt: 1,
  };
}

function neutralInput(seq = 1): PlayerInput {
  return {
    seq,
    clientTime: 0,
    forward: 0,
    turn: 0,
    aimX: 0,
    aimZ: 10,
    fire: false,
    useWeapon: false,
    turbo: false,
    handbrake: false,
    dashDir: 0,
  };
}

test('all 6 maps and sizes pass connectivity validation', () => {
  for (const mapId of ALL_MAP_IDS) {
    for (const size of ['small', 'medium', 'large'] as const) {
      const map = buildMap(mapId, size);
      assert.equal(validateMapConnectivity(map), true, `${mapId} (${size}) failed connectivity check`);
      assert.equal(map.spawns.length, 12, `${mapId} should have 12 spawns`);
    }
  }
});

test('stepTank is deterministic and respects Scout, Standard, Heavy class speeds and dash', () => {
  const settings = makeSettings({ tankRule: 'classes' });
  const state = createSimState(
    [makePlayer('p1', 'Scout', 'scout'), makePlayer('p2', 'Heavy', 'heavy')],
    settings,
    12345
  );
  const scout = state.tanks[0];
  const heavy = state.tanks[1];
  scout.x = 45;
  scout.z = -10;
  scout.hullAngle = 0;
  heavy.x = 20;
  heavy.z = 20;
  heavy.hullAngle = 0;

  const fwdIn: PlayerInput = { ...neutralInput(1), forward: 1, aimX: 45, aimZ: 40 };
  for (let i = 0; i < 45; i++) {
    stepTank(scout, fwdIn, PHYSICS.fixedDt, state.map, state.destructibles, settings, false);
    stepTank(heavy, fwdIn, PHYSICS.fixedDt, state.map, state.destructibles, settings, false);
  }
  assert.ok(scout.speed > heavy.speed, 'Scout should reach higher speed than Heavy');
  assert.ok(scout.speed <= TANK_CLASSES.scout.forwardSpeed + 0.05);
  assert.ok(heavy.speed <= TANK_CLASSES.heavy.forwardSpeed + 0.05);

  // Scout sideways dash
  const prevX = scout.x;
  stepTank(scout, { ...neutralInput(2), dashDir: 1 }, PHYSICS.fixedDt, state.map, state.destructibles, settings, false);
  assert.ok(scout.dashTimer > 0, 'Scout dash should activate');
  assert.notEqual(scout.x, prevX, 'Scout dash should displace sideways');
});

test('Heavy frontal armor reduces damage by 15% from front arc', () => {
  const settings = makeSettings({ tankRule: 'classes' });
  const state = createSimState(
    [makePlayer('p1', 'Heavy', 'heavy'), makePlayer('p2', 'Attacker', 'standard')],
    settings,
    99
  );
  const heavy = state.tanks[0];
  heavy.spawnShieldTimer = 0;
  heavy.x = 0;
  heavy.z = 0;
  heavy.hullAngle = 0; // facing +Z
  const events: SimEvent[] = [];

  // Shot from front (+Z)
  applyDamageToTank(state, heavy, 100, 'p2', 0, 10, 'Cannon', events);
  assert.equal(heavy.hp, 150 - 85, 'Front hit should be reduced by 15% (85 dmg)');

  // Shot from rear (-Z)
  heavy.hp = 150;
  applyDamageToTank(state, heavy, 100, 'p2', 0, -10, 'Cannon', events);
  assert.equal(heavy.hp, 50, 'Rear hit should take full 100 dmg');
});

test('Spawn shield blocks damage and safe zone bypasses shield', () => {
  const settings = makeSettings();
  const state = createSimState([makePlayer('p1', 'Alpha'), makePlayer('p2', 'Beta')], settings, 7);
  const t = state.tanks[0];
  t.spawnShieldTimer = 2.0;
  const events: SimEvent[] = [];

  applyDamageToTank(state, t, 30, 'p2', 0, 0, 'Cannon', events);
  assert.equal(t.hp, t.maxHp, 'Spawn shield should block cannon damage');

  applyDamageToTank(state, t, 5, null, 0, 0, 'Safe Zone', events, true);
  assert.equal(t.hp, t.maxHp - 5, 'Safe zone should bypass shield');
});

test('LTS mutual kill replay and draw tiebreaker', () => {
  const settings = makeSettings({ mode: 'lts', scoreLimit: 3 });
  const state = createSimState([makePlayer('p1', 'A'), makePlayer('p2', 'B')], settings, 42);
  state.tanks[0].spawnShieldTimer = 0;
  state.tanks[1].spawnShieldTimer = 0;
  const events: SimEvent[] = [];

  applyDamageToTank(state, state.tanks[0], 200, 'p2', 0, 0, 'Cannon', events);
  applyDamageToTank(state, state.tanks[1], 200, 'p1', 0, 0, 'Cannon', events);
  stepSim(state, {}, events);

  assert.equal(state.roundDraws, 1, 'Mutual kill in LTS should count as a draw round');
  assert.ok(events.some((e) => e.type === 'round_end' && e.draw === true));
  assert.ok(state.roundOverTimer > 0);
});

test('CTF rules: cannot capture if own flag is taken, dropped flag returns on teammate touch', () => {
  const settings = makeSettings({ mode: 'ctf', mapId: 'twin_bases' });
  const state = createSimState(
    [makePlayer('p1', 'Red1', 'standard', 'red'), makePlayer('p2', 'Blue1', 'standard', 'blue')],
    settings,
    11
  );
  assert.ok(state.flags);
  const redTank = state.tanks[0];
  const blueFlag = state.flags.blue;
  const redFlag = state.flags.red;

  // Red carries blue flag, but red flag is also away from home
  blueFlag.carrierId = redTank.id;
  blueFlag.atHome = false;
  redFlag.atHome = false;
  redFlag.droppedTimer = 15;
  redFlag.x = 10;
  redFlag.z = 10;
  redTank.x = redFlag.homeX;
  redTank.z = redFlag.homeZ;

  const events: SimEvent[] = [];
  stepSim(state, {}, events);
  assert.equal(state.teamScores.red, 0, 'Cannot score while own flag is taken');

  // Red tank touches dropped red flag -> returns home -> next step at base scores!
  redFlag.x = redTank.x;
  redFlag.z = redTank.z;
  stepSim(state, {}, events);
  assert.equal(redFlag.atHome, true, 'Touching own dropped flag returns it home');
  assert.equal(state.teamScores.red, 1, 'Now Red scores capture');
});

test('Nickname sanitization and deduplication follow Section 31 rules', () => {
  assert.equal(sanitizeNickname('<script>Bob</script>'), 'scriptBob/scri');
  assert.match(sanitizeNickname('   '), /^Player\d{3}$/);
  const existing = [{ name: 'Sam' }, { name: 'Sam (2)' }];
  assert.equal(deduplicateNickname('Sam', existing), 'Sam (3)');
});
