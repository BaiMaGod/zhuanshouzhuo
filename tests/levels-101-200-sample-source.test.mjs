import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = JSON.parse(readFileSync(new URL('../docs/levels-101-200-sample-source.json', import.meta.url), 'utf8'));
const expectedLevels = [107, 131, 151, 161, 171, 191, 200];
const byLevel = new Map(source.levels.map(level => [level.level, level]));

test('七个样板关的来源数据范围明确且完整列出', () => {
  assert.equal(source.status, 'authoritative_partial_source_data_only');
  assert.deepEqual(source.levels.map(level => level.level), expectedLevels);
  assert.deepEqual(source.sourceCoverage['镯子分配'].levels, [101, 102, 103, 104, 105, 106]);
  assert.deepEqual(source.sourceCoverage['背景扣端点'].levels, Array.from({ length: 36 }, (_, i) => 101 + i));
  assert.deepEqual(source.sourceCoverage['属性交叉'].levels, Array.from({ length: 86 }, (_, i) => 101 + i));
});

test('七关汇总配额与自带扣、属性、背景扣头数交叉一致', () => {
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

test('背景扣端点编号仅在工作簿有逐件记录的关卡启用', () => {
  for (const level of source.levels) {
    const endpoints = level.backgroundEndpointAssignments;
    if (endpoints.status === 'ids_present_geometry_missing') {
      assert.equal(endpoints.items.length, level.backgroundPieceCount, 'piece rows: ' + level.level);
      assert.equal(endpoints.items.reduce((sum, piece) => sum + piece.heads, 0), level.backgroundEndpointCount, 'head rows: ' + level.level);
      const targets = endpoints.items.flatMap(piece => {
        assert.equal(piece.targetRingIds.length, piece.heads, piece.id);
        return piece.targetRingIds;
      });
      assert.equal(new Set(targets).size, targets.length, 'unique endpoint targets: ' + level.level);
      for (const id of targets) {
        const match = /^R(\d+)$/.exec(id);
        assert.ok(match && Number(match[1]) >= 1 && Number(match[1]) <= level.ringCount, 'valid target ' + id);
      }
    } else {
      assert.equal(endpoints.status, 'missing_in_workbook');
      assert.deepEqual(endpoints.items, []);
    }
  }
  assert.deepEqual(source.levels.filter(l => l.backgroundEndpointAssignments.items.length).map(l => l.level), [107, 131]);
});

test('属性交叉明细缺失时不伪造M0–M6分类', () => {
  for (const level of source.levels) {
    const cross = level.attributeCrossBreakdown;
    if (cross.status === 'present_in_workbook') {
      assert.equal(cross.rows.length, 7);
      const totals = cross.rows.reduce((sum, row) => {
        for (const [key, value] of Object.entries(row.attributeCounts)) sum[key] += value;
        return sum;
      }, { ordinary: 0, burstOnly: 0, silkOnly: 0, both: 0 });
      assert.deepEqual(totals, level.attributeCounts, 'M0–M6 attribute cross: ' + level.level);
    } else {
      assert.equal(cross.status, 'missing_in_workbook');
      assert.deepEqual(cross.rows, []);
    }
  }
  assert.deepEqual(source.levels.filter(l => l.attributeCrossBreakdown.status === 'missing_in_workbook').map(l => l.level), [191, 200]);
});

test('七关均明确缺少逐镯分配，且物理回放仍为待测', () => {
  for (const level of source.levels) {
    assert.equal(level.ringAssignments.status, 'missing_in_workbook', 'ring assignments: ' + level.level);
    assert.equal(level.audit.fullPhysicsReplay, '待测', 'physics replay: ' + level.level);
    assert.equal(level.audit.minimumMovesProof, '待测', 'minimum moves: ' + level.level);
  }
});

test('第200关不能在无路线S时提前生成倒计时', () => {
  const level = byLevel.get(200);
  assert.ok(level.timedChallenge);
  assert.equal(level.timedChallenge.referenceSteps, '');
  assert.equal(level.timedChallenge.routeValidation, '待验证');
  assert.equal(level.timedChallenge.formulaSeconds, '');
  assert.equal(level.timedChallenge.calibratedSeconds, '');
});
