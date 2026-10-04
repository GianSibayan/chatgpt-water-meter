import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtMl, levelFor } from '../src/lib/widget.js';

test('fmtMl keeps readable precision and flags approximation with ~', () => {
  assert.equal(fmtMl(2.071), '~2.07 mL');
  assert.equal(fmtMl(10.87), '~10.9 mL');
  assert.equal(fmtMl(150.4), '~150 mL');
  assert.equal(fmtMl(1250), '~1.25 L');
});

test('levelFor starts visible, grows with usage, never drains or overflows', () => {
  assert.equal(levelFor(0), 0.1);
  assert.ok(levelFor(10) > levelFor(2));
  assert.ok(levelFor(100) > levelFor(10));
  assert.ok(levelFor(1000) <= 0.92 && levelFor(1e6) <= 0.92);
});
