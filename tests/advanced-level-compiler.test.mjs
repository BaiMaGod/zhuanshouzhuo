import test from 'node:test';
import assert from 'node:assert/strict';
import { compileApprovedSample } from '../src/advanced-level-compiler.js';

function makeSpec() {
  const rings = Array.from({ length: 109 }, (_, i) => ({
    id: 'R' + String(i + 1).padStart(3, '0'),
    center: { x: i * 92.0001, y: 0 },
    radius: 40,
    ringWidth: 12,
    gapLocalAngle: 0,
    initialRotation: 0,
    mountedClaspQuota: i === 0 ? 1 : 0,
    attribute: '普通',
    silkLayers: 0
  }));
  return {
    level: 107,
    ringCount: 109,
    rings,
    mountedRods: [{
      id: 'M001',
      ownerId: 'R001',
      receiverId: 'R002',
      anchorLocal: { x: 40, y: 0 },
      angleLocal: 0,
      length: 92.0001,
      endpointWidth: 7
    }],
    backgroundPieceCount: 0,
    backgroundEndpointCount: 0,
    backgroundPieces: [],
    silkEdges: [],
    burstCandidates: [],
    validation: { source: true, geometry: true, physics: true },
    verifiedRoute: {
      replayReport: { passed: true },
      initialStateHash: 'unit-test-initial',
      finalStateHash: 'unit-test-final',
      stepsS: 1,
      orderedSteps: [{ id: 'R001', delta: 10, rod: 'M001' }]
    }
  };
}

test('compiler accepts per-owner mounted-clasp quotas that exactly match the source counts', () => {
  const level = compileApprovedSample(makeSpec());
  assert.equal(level.mountedRods.length, 1);
  assert.equal(level.mountedRods[0].owner, 'R001');
});

test('compiler rejects a correct global clasp total with the wrong Owner distribution', () => {
  const spec = makeSpec();
  spec.mountedRods[0].ownerId = 'R002';
  assert.throws(() => compileApprovedSample(spec), /Owner自带扣数量不匹配/);
});

test('compiler rejects background piece and endpoint totals that disagree with the source quota', () => {
  const spec = makeSpec();
  spec.backgroundPieceCount = 1;
  spec.backgroundEndpointCount = 2;
  assert.throws(() => compileApprovedSample(spec), /背景扣件数/);
});

test('compiler requires each silk layer to have one validated adjacent source edge', () => {
  const spec = makeSpec();
  spec.rings[2].attribute = '仅缠丝';
  spec.rings[2].silkLayers = 1;
  spec.silkEdges = [{ sourceId: 'R002', targetId: 'R003', validatedAdjacent: true }];
  assert.equal(compileApprovedSample(spec).special.silkEdges.length, 1);

  spec.silkEdges = [];
  assert.throws(() => compileApprovedSample(spec), /缠丝来源数量不匹配 R003/);
});

test('compiler verifies burst candidate source attributes and actual neighbor distance', () => {
  const spec = makeSpec();
  spec.rings[0].attribute = '仅爆裂';
  spec.burstCandidates = [{ sourceId: 'R001', neighborId: 'R002', validatedAdjacent: true }];
  assert.equal(compileApprovedSample(spec).special.rings[0].attribute, 'burst');

  spec.rings[0].attribute = '普通';
  assert.throws(() => compileApprovedSample(spec), /爆裂来源属性 R001/);

  spec.rings[0].attribute = '仅爆裂';
  spec.burstCandidates[0].neighborId = 'R004';
  assert.throws(() => compileApprovedSample(spec), /爆裂邻镯不是真实相邻/);
});


test('compiler permits multiple incoming rods only when the single receiver gap can align them together', () => {
  const spec = makeSpec();
  const length = Math.hypot(52, 40);
  const angleA = Math.atan2(40, 52) * 180 / Math.PI;
  const angleB = Math.atan2(40, -52) * 180 / Math.PI;
  spec.rings[1].center = { x: 92.0001, y: 0 }; // R002 receiver
  spec.rings[2].center = { x: 10000, y: 10000 }; // keep unused R003 out of this local test
  spec.rings[3].center = { x: 184.0002, y: 0 }; // R004 second owner
  spec.rings[3].mountedClaspQuota = 1;
  spec.mountedRods = [
    { id: 'M001', ownerId: 'R001', receiverId: 'R002', anchorLocal: { x: 40, y: 0 }, angleLocal: angleA, length, endpointWidth: 7 },
    { id: 'M002', ownerId: 'R004', receiverId: 'R002', anchorLocal: { x: -40, y: 0 }, angleLocal: angleB, length, endpointWidth: 7 }
  ];
  assert.equal(compileApprovedSample(spec).mountedRods.length, 2);
});

test('compiler rejects two incoming mounted rods that occupy different directions on one single-gap receiver', () => {
  const spec = makeSpec();
  const length = Math.hypot(52, 40);
  const angleA = Math.atan2(40, 52) * 180 / Math.PI;
  const angleB = Math.atan2(-40, -52) * 180 / Math.PI;
  spec.rings[1].center = { x: 92.0001, y: 0 };
  spec.rings[2].center = { x: 10000, y: 10000 };
  spec.rings[3].center = { x: 184.0002, y: 0 };
  spec.rings[3].mountedClaspQuota = 1;
  spec.mountedRods = [
    { id: 'M001', ownerId: 'R001', receiverId: 'R002', anchorLocal: { x: 40, y: 0 }, angleLocal: angleA, length, endpointWidth: 7 },
    { id: 'M002', ownerId: 'R004', receiverId: 'R002', anchorLocal: { x: -40, y: 0 }, angleLocal: angleB, length, endpointWidth: 7 }
  ];
  assert.throws(() => compileApprovedSample(spec), /同一接收镯的活动扣无法由单缺口同时对齐 R002/);
});


test('compiler rejects a background endpoint that conflicts with a mounted clasp on the same receiver', () => {
  const spec = makeSpec();
  spec.backgroundPieceCount = 1;
  spec.backgroundEndpointCount = 2;
  spec.backgroundPieces = [{
    id: 'F001',
    heads: 2,
    anchorWorld: { x: 0, y: 100 },
    endpoints: [
      { id: 'F001-H1', receiverId: 'R002', pointWorld: { x: 92.0001, y: 40 }, endpointWorldAngle: 90, endpointWidth: 7 },
      { id: 'F001-H2', receiverId: 'R003', pointWorld: { x: 224.0002, y: 0 }, endpointWorldAngle: 0, endpointWidth: 7 }
    ],
    branchPaths: [
      [{ x: 0, y: 100 }, { x: 92.0001, y: 40 }],
      [{ x: 0, y: 100 }, { x: 224.0002, y: 0 }]
    ]
  }];
  assert.throws(() => compileApprovedSample(spec), /背景扣与活动扣无法由同一缺口同时对齐 R002/);
});

test('compiler rejects duplicate background receiver targets even when the head count matches', () => {
  const spec = makeSpec();
  spec.backgroundPieceCount = 1;
  spec.backgroundEndpointCount = 2;
  spec.backgroundPieces = [{
    id: 'F001',
    heads: 2,
    anchorWorld: { x: 0, y: 0 },
    endpoints: [
      { id: 'F001-H1', receiverId: 'R003', pointWorld: { x: 224.0002, y: 0 }, endpointWorldAngle: 0, endpointWidth: 7 },
      { id: 'F001-H2', receiverId: 'R003', pointWorld: { x: 224.0002, y: 0 }, endpointWorldAngle: 0, endpointWidth: 7 }
    ],
    branchPaths: [
      [{ x: 0, y: 0 }, { x: 224.0002, y: 0 }],
      [{ x: 0, y: 0 }, { x: 224.0002, y: 0 }]
    ]
  }];
  assert.throws(() => compileApprovedSample(spec), /背景扣端点目标/);
});
