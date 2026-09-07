import { expect, test } from 'vitest'
import { getPhasesInRange, phaseWindows, resolveStartTimestamp } from './utils'

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
  expect(names(2, 6)).toEqual([['A', 0, 1]])
})

test('track straddling two phases splits at the boundary', () => {
  expect(names(8, 12)).toEqual([
    ['A', 0, 0.5],
    ['B', 0.5, 1],
  ])
})

test('track ending exactly on a boundary belongs only to the first phase', () => {
  expect(names(6, 10)).toEqual([['A', 0, 1]])
})

test('track past every phase has none', () => {
  expect(names(30, 34)).toEqual([])
})

test('resolveStartTimestamp keeps a start a few minutes ago today', () => {
  const now = new Date(2026, 8, 7, 21, 5).getTime()
  expect(resolveStartTimestamp('21:00', 720, now)).toBe(new Date(2026, 8, 7, 21, 0).getTime())
})

test('resolveStartTimestamp rolls a journey that would already be over to tomorrow', () => {
  const now = new Date(2026, 8, 7, 20, 20).getTime()
  expect(resolveStartTimestamp('04:30', 720, now)).toBe(new Date(2026, 8, 8, 4, 30).getTime())
})

test('phaseWindows chains phase end to next start', () => {
  const w = phaseWindows(session.phases, 1000)
  expect(w.map((x) => [x.start, x.end])).toEqual([[1000, 601000], [601000, 1801000]])
})
