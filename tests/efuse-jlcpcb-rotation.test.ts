import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import {
  convertCircuitJsonToPickAndPlaceCsv,
  convertCircuitJsonToPickAndPlaceRows,
} from "../src"

// The source and placement metadata are from NEMA 23 v1.4.26.
const circuit: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "source_component_46",
    ftype: "simple_chip",
    name: "U_EFUSE",
    manufacturer_part_number: "TPS26632RGER",
    supplier_part_numbers: { jlcpcb: ["C1850278"] },
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_49",
    source_component_id: "source_component_46",
    footprint_origin: { x: 13, y: 12.5 },
    center: { x: 13, y: 12.5 },
    width: 4.799990399999999,
    height: 4.799990399999999,
    layer: "top",
    rotation: 270,
    obstructs_within_bounds: true,
    pin1_location: "bottomside_left",
    supplier_pin1_location_map: { jlcpcb: "leftside_top" },
  },
]

test("places the JLCPCB TPS26632RGER pin 1 on the board's pin 1", () => {
  // JLCPCB's assembly preview put the package dot at the lower left for
  // the exported 0°. The routed board has pad 1 at the upper left, so the
  // top-side package needs a clockwise quarter-turn (270° in the CPL).
  expect(
    convertCircuitJsonToPickAndPlaceCsv(circuit, {
      supplier: "jlcpcb",
      requireSupplierRotation: true,
    }),
  ).toBe(
    "Designator,Mid X,Mid Y,Layer,Rotation\r\nU_EFUSE,13.000,12.500,top,270",
  )
})

test("converts a differently authored footprint without an EasyEDA frame", () => {
  const rotatedCircuit = circuit.map((element) =>
    element.type === "pcb_component"
      ? {
          ...element,
          rotation: 45,
          pin1_location: "leftside_top" as const,
          supplier_pin1_location_map: undefined,
        }
      : element,
  )
  expect(
    convertCircuitJsonToPickAndPlaceRows(rotatedCircuit, {
      supplier: "jlcpcb",
      requireSupplierRotation: true,
    })[0]?.rotation,
  ).toBe(315)
})

test("keeps the footprint conversion for a different selected JLCPCB part", () => {
  const otherPartCircuit = circuit.map((element) =>
    element.type === "source_component"
      ? {
          ...element,
          supplier_part_numbers: { jlcpcb: ["C1850276", "C1850278"] },
        }
      : element,
  )
  expect(
    convertCircuitJsonToPickAndPlaceRows(otherPartCircuit, {
      supplier: "jlcpcb",
      requireSupplierRotation: true,
    })[0]?.rotation,
  ).toBe(0)
})
