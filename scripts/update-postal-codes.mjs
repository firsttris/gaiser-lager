#!/usr/bin/env node
// Downloads the German postal code list from GeoNames and writes the compact
// lookup table used to fill in the city from the postal code (P15).
//
//   node scripts/update-postal-codes.mjs
//
// Data: GeoNames (https://www.geonames.org), CC BY 4.0 — attribution is shown
// in the app footer. Postal codes change rarely; re-run about once a year.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const SOURCE_URL = 'https://download.geonames.org/export/zip/DE.zip'
const TARGET = path.resolve(import.meta.dirname, '../src/server/data/postal-codes-de.json')

// Read one file from the zip without extra dependencies. Sizes are taken from
// the central directory at the end of the archive (the local headers may
// leave them empty).
function extractFile(zip, wantedName) {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0) throw new Error('Not a zip archive')
  const entryCount = zip.readUInt16LE(eocd + 10)
  let offset = zip.readUInt32LE(eocd + 16)

  for (let i = 0; i < entryCount; i++) {
    const method = zip.readUInt16LE(offset + 10)
    const compressedSize = zip.readUInt32LE(offset + 20)
    const nameLength = zip.readUInt16LE(offset + 28)
    const extraLength = zip.readUInt16LE(offset + 30)
    const commentLength = zip.readUInt16LE(offset + 32)
    const localHeader = zip.readUInt32LE(offset + 42)
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength)

    if (name === wantedName) {
      const localNameLength = zip.readUInt16LE(localHeader + 26)
      const localExtraLength = zip.readUInt16LE(localHeader + 28)
      const dataStart = localHeader + 30 + localNameLength + localExtraLength
      const data = zip.subarray(dataStart, dataStart + compressedSize)
      return method === 8 ? zlib.inflateRawSync(data) : data
    }
    offset += 46 + nameLength + extraLength + commentLength
  }
  throw new Error(`${wantedName} not found in archive`)
}

const response = await fetch(SOURCE_URL)
if (!response.ok) throw new Error(`Download failed: ${response.status}`)
const text = extractFile(Buffer.from(await response.arrayBuffer()), 'DE.txt').toString('utf8')

// Columns: country, postal code, place name, … — one row per (code, place).
const placesByCode = {}
for (const line of text.split('\n')) {
  const [, code, place] = line.split('\t')
  if (!code || !place) continue
  const places = (placesByCode[code] ??= [])
  if (!places.includes(place)) places.push(place)
}

const sorted = Object.fromEntries(
  Object.keys(placesByCode)
    .sort()
    .map((code) => [code, placesByCode[code].sort((a, b) => a.localeCompare(b, 'de'))]),
)

fs.mkdirSync(path.dirname(TARGET), { recursive: true })
fs.writeFileSync(TARGET, JSON.stringify(sorted))
console.log(`${Object.keys(sorted).length} Postleitzahlen → ${path.relative(process.cwd(), TARGET)}`)
