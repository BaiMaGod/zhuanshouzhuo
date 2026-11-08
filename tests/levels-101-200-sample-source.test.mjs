import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = JSON.parse(readFileSync(new URL('../docs/levels-101-200-sample-source.json', import.meta.url), 'utf8'));
const level107 = JSON.parse(readFileSync(new URL('../docs/levels-101-200-level107-source.json', import.meta.url), 'utf8'));
const expectedLevels = [107, 131, 151, 161, 171, 191, 200];
const allSourceLevels = Array.from({ length: 100 }, (_, i) => i + 101);
const byLevel = new Map(source.levels.map(level => [level.level, level]));

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

test('七个样板关的源数据覆盖按原始工作簿更正为101–200完整覆盖', () => {
  assert.equal(source.status, 'authoritative_workbook_source_with_topology_geometry_and_physics_pending');
  assert.deepEqual(source.levels.map(level => level.level), expectedLevels);
  for (const sheet of ['镯子分配', '背景扣端点', '属性交叉', '复核记录']) {
    assert.deepEqual(source.sourceCoverage[sheet].levels, allSourceLevels, sheet);
  }
  assert.equal(source.sourceCoverage['镯子分配'].coverage.includes('complete mounted Owner→Receiver edge list is not present'), true);
  assert.equal(source.sourceCoverage['背景扣端点'].coverage.includes('world anchors'), true);
});

test('七关逐镯配额、属性、背景扣件数和端点数与汇总表交叉一致', () => {
  for (const level of source.levels) {
    assert.equal(level.ownedClaspRingCounts.length, 7, 'M0–M6: ' + level.level);
    assert.equal(level.ownedClaspRingCounts.reduce((a, b) => a + b, 0), level.ringCount, 'M count: ' + level.level);
    assert.equal(level.ownedClaspRingCounts.reduce((sum, count, i) => sum + count * i, 0), level.ownedClaspCount, 'M weighted count: ' + level.level);
    assert.equal(Object.values(level.attributeCounts).reduce((a, b) => a + b, 0), level.ringCount, 'attribute count: ' + level.level);
    assert.equal(Object.values(level.backgroundPieceCountsByHeads).reduce((a, b) => a + b, 0), level.backgroundPieceCount, 'background piece count: ' + level.level);
    const headValues = { two: 2, three: 3, four: 4, five: 5, six: 6 };
    assert.equal(Object.entries(level.backgroundPieceCountsByHeads).reduce((sum, [heads, count]) => sum + headValues[heads] * count, 0), level.backgroundEndpointCount, 'background endpoint count: ' + level.level);
    assert.deepEqual(level.staticDifferences, { ringCount: 0, attribute: 0, silk: 0 }, 'static differences: ' + level.level);
    assert.equal(level.ownedClaspCountCrossCheck, level.ownedClaspCount, 'summary cross-check: ' + level.level);
  }
});

test('七关逐镯源记录与背景端点目标编号都存在于原始工作簿', () => {
  for (const level of source.levels) {
    const rings = level.ringAssignments;
    assert.equal(rings.status, 'per_ring_records_present_full_owner_receiver_graph_missing', 'ring assignments: ' + level.level);
    assert.equal(rings.recordsPresent, level.ringCount, 'per-ring row count: ' + level.level);
    assert.deepEqual(rings.availableLevels, allSourceLevels);
    assert.equal(rings.completeOwnerReceiverGraph, false, 'do not mistake partial prerequisite notes for the full edge list');

    const endpoints = level.backgroundEndpointAssignments;
    assert.equal(endpoints.status, 'target_ring_ID_assignments_present_geometry_missing', 'background endpoints: ' + level.level);
    assert.equal(endpoints.expectedPieceCount, level.backgroundPieceCount);
    assert.equal(endpoints.expectedEndpointCount, level.backgroundEndpointCount);
    if (endpoints.itemsEmbedded) {
      assert.equal(endpoints.items.length, level.backgroundPieceCount, 'embedded piece rows: ' + level.level);
      assert.equal(endpoints.items.reduce((sum, piece) => sum + piece.heads, 0), level.backgroundEndpointCount, 'embedded head rows: ' + level.level);
      const targets = endpoints.items.flatMap(piece => {
        assert.equal(piece.targetRingIds.length, piece.heads, piece.id);
        return piece.targetRingIds;
      });
      assert.equal(new Set(targets).size, targets.length, 'unique embedded endpoint targets: ' + level.level);
      for (const id of targets) {
        const match = /^R(\\d+)$/.exec(id);
        assert.ok(match && Number(match[1]) >= 1 && Number(match[1]) <= level.ringCount, 'valid target ' + id);
      }
    } else {
      assert.deepEqual(endpoints.items, [], 'unembedded rows are still present in the workbook: ' + level.level);
    }
  }
  assert.deepEqual(source.levels.filter(l => l.backgroundEndpointAssignments.itemsEmbedded).map(l => l.level), [107, 131]);
});

test('七关M0–M6属性交叉行均存在；191和200的行尚未复制进JSON快照', () => {
  for (const level of source.levels) {
    const cross = level.attributeCrossBreakdown;
    if (cross.rowsEmbedded) {
      assert.equal(cross.status, 'present_in_workbook');
      assert.equal(cross.rows.length, 7);
      const totals = cross.rows.reduce((sum, row) => {
        for (const [key, value] of Object.entries(row.attributeCounts)) sum[key] += value;
        return sum;
      }, { ordinary: 0, burstOnly: 0, silkOnly: 0, both: 0 });
      assert.deepEqual(totals, level.attributeCounts, 'M0–M6 attribute cross: ' + level.level);
    } else {
      assert.equal(cross.status, 'present_in_workbook_not_embedded');
      assert.deepEqual(cross.rows, []);
    }
  }
  assert.deepEqual(source.levels.filter(l => l.attributeCrossBreakdown.rowsEmbedded).map(l => l.level), [107, 131, 151, 161, 171]);
});

test('第107关逐镯与背景扣快照逐行哈希匹配原始工作簿', () => {
  assert.equal(level107.status, 'verified_against_authoritative_workbook_records_geometry_and_full_owner_receiver_graph_pending');
  const sample = level107.levels.find(level => level.level === 107);
  assert.ok(sample);
  assert.equal(sample.rings.length, 109);
  assert.equal(sample.rings.reduce((sum, ring) => sum + ring.ownedClaspQuota, 0), 125);
  assert.equal(sample.backgroundPieces.length, 14);
  assert.equal(sample.backgroundPieces.reduce((sum, piece) => sum + piece.heads, 0), 28);
  const ringRows = sample.rings.map(ring => JSON.stringify([
    ring.id, ring.ownedClaspQuota, ring.attribute, ring.silkLayers, ring.role, ring.silkSources,
    ring.expectedPrerequisites, ring.backgroundPieceId, ring.burstNeighborCandidates,
    ring.burstHitBackgroundPieces, ring.backgroundRemovalAffects, ring.designLayer,
    ring.listedAdjacencyCount
  ])).join('\n');
  const backgroundRows = sample.backgroundPieces.map(piece => JSON.stringify([
    piece.id, piece.heads, piece.targetRingIds, piece.hitByBurstRingIds,
    piece.ordinaryRemoval, piece.burstRemoval
  ])).join('\n');
  assert.equal(fnv1a32(ringRows), sample.sourceVerification.checks.canonicalRingRecordsFnv1a32);
  assert.equal(fnv1a32(backgroundRows), sample.sourceVerification.checks.canonicalBackgroundRecordsFnv1a32);
  assert.equal(fnv1a32(ringRows), 'cd043048');
  assert.equal(fnv1a32(backgroundRows), '13b318d7');
});

test('七关物理回放仍为待测；第200关不能在无路线S时提前生成倒计时', () => {
  for (const level of source.levels) {
    assert.equal(level.audit.fullPhysicsReplay, '待测', 'physics replay: ' + level.level);
    assert.equal(level.audit.minimumMovesProof, '待测', 'minimum moves: ' + level.level);
  }
  const level = byLevel.get(200);
  assert.ok(level.timedChallenge);
  assert.equal(level.timedChallenge.referenceSteps, '');
  assert.equal(level.timedChallenge.routeValidation, '待验证');
  assert.equal(level.timedChallenge.formulaSeconds, '');
  assert.equal(level.timedChallenge.calibratedSeconds, '');
});
