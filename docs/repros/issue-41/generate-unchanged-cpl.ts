import { strict as assert } from "node:assert"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import type { AnyCircuitElement } from "circuit-json"

// Build this checkout first. No CSV values or orientation metadata are edited.
const exporter = (await import(
  new URL("../../../dist/index.js", import.meta.url).href
)) as typeof import("../../../src")
const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath)
  throw new Error(
    "Usage: bun generate-unchanged-cpl.ts input.circuit.json output.csv",
  )
const inputText = await Bun.file(inputPath).text()
const input = JSON.parse(inputText) as AnyCircuitElement[]
const original = structuredClone(input)
const warnings: unknown[] = []
const csv = exporter.convertCircuitJsonToPickAndPlaceCsv(input, {
  supplier: "jlcpcb",
  onRotationWarning: (warning) => warnings.push(warning),
})
assert.deepEqual(input, original)
// Audit the existing preparation helper too: with no selected supplier part
// numbers in the reporter input, it has nothing to look up and changes nothing.
const prepared = await exporter.populatePartOrientationMetadata(input, {
  supplier: "jlcpcb",
})
assert.deepEqual(prepared, input)
assert.equal(
  exporter.convertCircuitJsonToPickAndPlaceCsv(prepared, {
    supplier: "jlcpcb",
    onRotationWarning: () => {},
  }),
  csv,
)
await Bun.write(outputPath, csv)
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const provenance = {
  exporter_commit: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: new URL("../../../", import.meta.url),
  })
    .toString()
    .trim(),
  exporter_entrypoint: "dist/index.js",
  input_sha256: hash(inputText),
  csv_sha256: hash(csv),
  options: { supplier: "jlcpcb" },
  csv_postprocessing: false,
  input_mutated: false,
  metadata_helper_changes_without_supplier_part_numbers: false,
  warnings,
  csv,
}
await Bun.write(
  `${outputPath}.provenance.json`,
  JSON.stringify(provenance, null, 2),
)
console.log(JSON.stringify(provenance, null, 2))
