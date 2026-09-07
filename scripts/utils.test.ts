// Run: pnpm test  (Node 24 strips types natively)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPhasesInRange } from '../src/shared/utils.ts'

const session = {
  startTime: 0,
  phases: [
    { id: 'a', name: 'A', duration: 10, color: '#a' },
    { id: 'b', name: 'B', duration: 20, color: '#b' },
  ],
}
const names = (start: number, end: number) =>
  getPhasesInRange(session, start, end).map((p) => [p.phase.name, p.from, p.to])

test('track inside one phase', () => {
  assert.deepEqual(names(2, 6), [['A', 0, 1]])
})

test('track straddling two phases splits at the boundary', () => {
  assert.deepEqual(names(8, 12), [
    ['A', 0, 0.5],
    ['B', 0.5, 1],
  ])
})

test('track ending exactly on a boundary belongs only to the first phase', () => {
  assert.deepEqual(names(6, 10), [['A', 0, 1]])
})

test('track past every phase has none', () => {
  assert.deepEqual(names(30, 34), [])
})
