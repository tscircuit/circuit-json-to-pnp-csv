import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbComponent } from "circuit-json"
import {
  convertCircuitJsonToPickAndPlaceCsv,
  type PickAndPlaceRotationWarning,
} from "../src"

// CAD reference and placement from NEMA 23 v1.4.26. The production
// review image does not establish the angle JLCPCB used to render it.
const circuit = (
  metadata: {
    supplier_assembly_rotation_offset_map?: { jlcpcb: number }
  } = {},
): AnyCircuitElement[] => [
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
    ...metadata,
  } satisfies PcbComponent,
]

test("the TPS26632RGER fixture exports the EasyEDA CAD angle", () => {
  expect(
    convertCircuitJsonToPickAndPlaceCsv(circuit(), { supplier: "jlcpcb" }),
  ).toBe("Designator,Mid X,Mid Y,Layer,Rotation\r\nU_EFUSE,13.000,12.500,top,0")
})

test.failing(
  "CAD alignment alone is reported as an unverified assembly angle",
  () => {
    const warnings: PickAndPlaceRotationWarning[] = []
    convertCircuitJsonToPickAndPlaceCsv(circuit(), {
      supplier: "jlcpcb",
      onRotationWarning: (warning) => warnings.push(warning),
    })
    expect(warnings).toMatchObject([
      { designator: "U_EFUSE", reason: "missing_supplier_assembly_rotation" },
    ])
  },
)

test.failing(
  "supplier assembly zero is used separately from CAD alignment",
  () => {
    // A synthetic offset exercises conversion without asserting JLCPCB's
    // actual rotation for this order.
    expect(
      convertCircuitJsonToPickAndPlaceCsv(
        circuit({ supplier_assembly_rotation_offset_map: { jlcpcb: 180 } }),
        { supplier: "jlcpcb" },
      ),
    ).toBe(
      "Designator,Mid X,Mid Y,Layer,Rotation\r\nU_EFUSE,13.000,12.500,top,180",
    )
  },
)
