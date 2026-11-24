import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import {
  convertCircuitJsonToPickAndPlaceCsv,
  convertCircuitJsonToPickAndPlaceRows,
} from "../src"

const circuit = (rotation: number): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "source_r1",
    ftype: "simple_resistor",
    name: "R1",
    resistance: 1000,
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_r1",
    source_component_id: "source_r1",
    center: { x: 10, y: 20 },
    width: 2,
    height: 1,
    layer: "top",
    rotation,
    obstructs_within_bounds: true,
  } as AnyCircuitElement,
]

test("normalizes negative rotations into the 0-360 range", () => {
  expect(convertCircuitJsonToPickAndPlaceRows(circuit(-90))[0]?.rotation).toBe(
    270,
  )
})

test("normalizes rotations above 360 into the 0-360 range", () => {
  const rows = convertCircuitJsonToPickAndPlaceRows(circuit(450))
  expect(rows[0]?.rotation).toBe(90)
  expect(convertCircuitJsonToPickAndPlaceCsv(circuit(450))).toContain(
    "R1,10.000,20.000,top,90",
  )
})
