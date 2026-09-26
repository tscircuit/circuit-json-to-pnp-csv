import { expect, test } from "bun:test"
import {
  convertCircuitJsonToPickAndPlaceRows,
  convertCircuitJsonToPickAndPlaceCsv,
} from "../src"
import { mountingHoleCircuit } from "./fixtures/mounting-hole-circuit"

test("excludes bare MH mounting-hole footprints from placement rows and CSV", () => {
  const rows = convertCircuitJsonToPickAndPlaceRows(mountingHoleCircuit)
  expect(rows).toEqual([
    { designator: "R1", mid_x: 0, mid_y: 5, layer: "top", rotation: 90 },
  ])
  const csv = convertCircuitJsonToPickAndPlaceCsv(mountingHoleCircuit)
  for (const name of ["MH1", "MH2", "MH3", "MH4"])
    expect(csv).not.toContain(name)
  expect(csv).toContain("R1,0.000,5.000,top,90")
})
