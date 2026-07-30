import { describe, expect, test } from 'vitest'
import { formatFileSize } from './fileSize'
import { bibliography } from '../data/bibliography'

describe('formatFileSize', () => {
  test('keeps kilobytes below the megabyte threshold', () => {
    expect(formatFileSize(56)).toBe('56 KB')
    expect(formatFileSize(770)).toBe('770 KB')
  })

  test('switches to megabytes at 1000 KB', () => {
    expect(formatFileSize(999)).toBe('999 KB')
    expect(formatFileSize(1000)).toBe('1 MB')
  })

  test('rounds megabytes to one decimal', () => {
    expect(formatFileSize(1156)).toBe('1.2 MB')
    expect(formatFileSize(6700)).toBe('6.7 MB')
  })

  test('drops a trailing zero on whole megabytes', () => {
    expect(formatFileSize(2000)).toBe('2 MB')
  })

  test('formats every real bibliography entry as a KB or MB figure', () => {
    for (const entry of bibliography) {
      expect(formatFileSize(entry.sizeKb)).toMatch(/^\d+(\.\d)? (KB|MB)$/)
    }
  })
})
