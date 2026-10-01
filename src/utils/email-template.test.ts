import { describe, expect, it } from 'vitest'
import { fillTemplate, SAMPLE_INVOICE_EMAIL_VALUES, unknownPlaceholders } from './email-template'

describe('fillTemplate', () => {
  it('replaces every known placeholder, also repeatedly', () => {
    expect(fillTemplate('{RECHNUNGSNUMMER} an {KUNDE} ({RECHNUNGSNUMMER})', SAMPLE_INVOICE_EMAIL_VALUES)).toBe(
      'RG-20261001-0001 an Muster Bau GmbH (RG-20261001-0001)',
    )
  })

  it('leaves unknown tokens visible', () => {
    expect(fillTemplate('Hallo {NAME}', SAMPLE_INVOICE_EMAIL_VALUES)).toBe('Hallo {NAME}')
  })
})

describe('unknownPlaceholders', () => {
  it('finds typos once', () => {
    expect(unknownPlaceholders('{KUNDE} {BETRAG} {Betrag} {RECHNUNGNUMMER} {Betrag}')).toEqual([
      '{Betrag}',
      '{RECHNUNGNUMMER}',
    ])
  })
})
