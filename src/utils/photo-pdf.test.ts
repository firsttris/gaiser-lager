import { describe, expect, it } from 'vitest'
import { fitIntoBox, photoPdfFileName } from './photo-pdf'

describe('fitIntoBox', () => {
  const box = { x: 10, y: 20, width: 100, height: 200 }

  it('fills the width of a landscape photo and centres it vertically', () => {
    expect(fitIntoBox({ width: 4000, height: 3000 }, box)).toEqual({ x: 10, y: 82.5, width: 100, height: 75 })
  })

  it('fills the height of a tall photo and centres it horizontally', () => {
    expect(fitIntoBox({ width: 1000, height: 4000 }, box)).toEqual({ x: 35, y: 20, width: 50, height: 200 })
  })
})

describe('photoPdfFileName', () => {
  it('names the file after the delivery note, or the Vorgang without one', () => {
    expect(photoPdfFileName({ id: 7, deliveryNoteId: 'LS-20261002-0003' })).toBe('LS-20261002-0003-Fotos.pdf')
    expect(photoPdfFileName({ id: 7, deliveryNoteId: undefined })).toBe('Vorgang-7-Fotos.pdf')
  })
})
