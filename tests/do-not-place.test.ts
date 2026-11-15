import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import Papa from "papaparse"
import {
  convertCircuitJsonToPickAndPlaceRows,
  convertCircuitJsonToPickAndPlaceCsv,
} from "../src"

const circuitJson: AnyCircuitElement[] = [true, false, undefined].flatMap(
  (doNotPlace, index): AnyCircuitElement[] => [
    {
      type: "source_component",
      source_component_id: `source_${index}`,
      name: `R${index + 1}`,
      ftype: "simple_resistor",
      resistance: 1000,
      supplier_part_numbers: { jlcpcb: ["C123"] },
    },
    {
      type: "pcb_component",
      pcb_component_id: `pcb_${index}`,
      source_component_id: `source_${index}`,
      center: { x: 10, y: 20 },
      width: 2,
      height: 1,
      layer: "top",
      rotation: 90,
      obstructs_within_bounds: true,
      ...(doNotPlace === undefined ? {} : { do_not_place: doNotPlace }),
    },
  ],
)

const allDnp = circuitJson.map((element) =>
  element.type === "pcb_component"
    ? { ...element, do_not_place: true }
    : element,
)

test("DNP parts are omitted from PnP rows and CSV while false and omitted flags remain", () => {
  const original = structuredClone(circuitJson)
  const options = { supplier: "jlcpcb" as const, flip_y_axis: true }
  expect(convertCircuitJsonToPickAndPlaceRows(circuitJson, options)).toEqual(
    ["R2", "R3"].map((designator) => ({
      designator,
      mid_x: 10,
      mid_y: -20,
      layer: "top",
      rotation: 90,
    })),
  )
  expect(
    Papa.parse(convertCircuitJsonToPickAndPlaceCsv(circuitJson, options), {
      header: true,
    }).data,
  ).toEqual(
    ["R2", "R3"].map((Designator) => ({
      Designator,
      "Mid X": "10.000",
      "Mid Y": "-20.000",
      Layer: "top",
      Rotation: "90",
    })),
  )
  expect(circuitJson).toEqual(original)
})

test("all-DNP boards produce no PnP entries", () => {
  expect(convertCircuitJsonToPickAndPlaceRows(allDnp)).toEqual([])
  expect(convertCircuitJsonToPickAndPlaceCsv(allDnp)).toBe("")
})
