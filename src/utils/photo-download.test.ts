import { describe, expect, it } from 'vitest'
import { photoFileName } from './photo-download'

describe('photoFileName', () => {
  it('names photos after the delivery note, numbered from 1, with the right extension', () => {
    expect(photoFileName({ id: 7, deliveryNoteId: 'LS-20261002-0003' }, 0, 'image/jpeg')).toBe('LS-20261002-0003-Foto-1.jpg')
    expect(photoFileName({ id: 7, deliveryNoteId: 'LS-20261002-0003' }, 2, 'image/webp')).toBe('LS-20261002-0003-Foto-3.webp')
  })

  it('falls back to the Vorgang and to jpg', () => {
    expect(photoFileName({ id: 7, deliveryNoteId: undefined }, 0, 'application/octet-stream')).toBe('Vorgang-7-Foto-1.jpg')
  })
})
