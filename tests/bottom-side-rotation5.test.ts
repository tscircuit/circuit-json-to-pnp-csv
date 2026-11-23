import { expect, test } from "bun:test"
import Papa from "papaparse"
import {
  convertCircuitJsonToPickAndPlaceCsv,
  convertCircuitJsonToPickAndPlaceRows,
  type PickAndPlaceRow,
} from "../src"
import { fixture } from "./fixtures/bottom-side-rotation"
import { renderBottomSideRotation } from "./fixtures/render-bottom-side-rotation"

test("raw CSV placement over recorded pads", async () => {
  const csv = convertCircuitJsonToPickAndPlaceCsv(fixture, {
    supplier: "jlcpcb",
    onRotationWarning: () => {},
  })
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true })
  expect(parsed.errors).toEqual([])
  const rows: PickAndPlaceRow[] = parsed.data.map((row) => ({
    designator: row.Designator,
    mid_x: Number(row["Mid X"]),
    mid_y: Number(row["Mid Y"]),
    layer: row.Layer as "top" | "bottom",
    rotation: Number(row.Rotation),
  }))
  expect(rows).toEqual(
    convertCircuitJsonToPickAndPlaceRows(fixture, {
      supplier: "jlcpcb",
      onRotationWarning: () => {},
    }),
  )
  const svg = renderBottomSideRotation(fixture, rows)
  const snapshot = new URL(
    "./__snapshots__/bottom-side-rotation.snap.svg",
    import.meta.url,
  )
  if (process.env.BUN_UPDATE_SNAPSHOTS === "1") await Bun.write(snapshot, svg)
  expect(svg).toBe(await Bun.file(snapshot).text())
})
