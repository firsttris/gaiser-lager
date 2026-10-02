import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { postalCodeQueryOptions } from '../server/postal-codes'

// PLZ + Ort inputs. Once five digits are entered the place is looked up:
// a single match is filled in, several matches are offered to pick from.
// A city the user typed themselves is never overwritten.
export function PostalCodeCityFields({
  postalCode,
  city,
  onChange,
  inputClassName,
  labelClassName = 'text-sm font-semibold text-slate-700',
}: {
  postalCode: string
  city: string
  onChange: (update: { postalCode?: string; city?: string }) => void
  inputClassName: string
  labelClassName?: string
}) {
  const { data: places = [] } = useQuery(postalCodeQueryOptions(postalCode))
  // The last city value this component filled in itself; if the field still
  // shows it, a new postal code may replace it.
  const autoFilledCityRef = useRef<string | null>(null)
  const cityIsUserEntered = city.trim() !== '' && city !== autoFilledCityRef.current

  useEffect(() => {
    if (places.length !== 1 || cityIsUserEntered || city === places[0]) return
    autoFilledCityRef.current = places[0]
    onChange({ city: places[0] })
  }, [places, city, cityIsUserEntered, onChange])

  const suggestions = places.length > 1 && !places.includes(city) ? places : []

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className={labelClassName}>PLZ</label>
        <input
          value={postalCode}
          onChange={(event) => onChange({ postalCode: event.target.value.replace(/[^0-9]/g, '').slice(0, 5) })}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="z.B. 77815"
          className={inputClassName}
        />
      </div>
      <div>
        <label className={labelClassName}>Ort</label>
        <input
          value={city}
          onChange={(event) => onChange({ city: event.target.value })}
          autoComplete="address-level2"
          placeholder="z.B. Bühl"
          className={inputClassName}
        />
      </div>
      {suggestions.length > 0 && (
        <div className="col-span-2 -mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-700">Ort zur PLZ wählen:</span>
          {suggestions.map((place) => (
            <button
              key={place}
              type="button"
              onClick={() => {
                autoFilledCityRef.current = place
                onChange({ city: place })
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              {place}
            </button>
          ))}
        </div>
      )}
      {/* Attribution required by the CC BY license of the postal code data. */}
      <p className="col-span-2 -mt-2 text-xs text-slate-600">
        Ortsvorschläge:{' '}
        <a href="https://www.geonames.org" target="_blank" rel="noreferrer" className="underline">
          GeoNames
        </a>{' '}
        (CC BY 4.0)
      </p>
    </div>
  )
}
