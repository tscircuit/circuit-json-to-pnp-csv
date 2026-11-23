import { expect, test } from "bun:test"
import type { PcbComponent } from "circuit-json"
import {
  convertCircuitJsonToPickAndPlaceCsv,
  convertCircuitJsonToPickAndPlaceRows,
  type PickAndPlaceRotationWarning,
} from "../src"
import { circuit } from "./fixtures/bottom-side-rotation"

const metadataCases: {
  label: string
  offset: number
  metadata: Partial<PcbComponent>
}[] = [
  { label: "unverified", offset: 0, metadata: {} },
  {
    label: "zero offset",
    offset: 0,
    metadata: {
      pin1_location: "leftside_top",
      supplier_pin1_location_map: { jlcpcb: "leftside_top" },
    },
  },
  {
    label: "+90 offset",
    offset: 90,
    metadata: {
      pin1_location: "leftside_top",
      supplier_pin1_location_map: { jlcpcb: "topside_right" },
    },
  },
  {
    label: "-90 offset",
    offset: 270,
    metadata: {
      pin1_location: "leftside_top",
      supplier_pin1_location_map: { jlcpcb: "bottomside_left" },
    },
  },
]
// Also exercise the real SOT-23 CAD frame difference (+180 degrees).
metadataCases.push({
  label: "+180 offset",
  offset: 180,
  metadata: {
    pin1_location: "leftside_top",
    supplier_pin1_location_map: { jlcpcb: "rightside_bottom" },
  },
})
const cases = [
  [90, 270],
  [270, 90],
  [-90, 90],
  [450, 270],
  [22.5, 337.5],
].flatMap(([rotation, mirrored]) =>
  metadataCases.flatMap((metadata) =>
    [false, true].map((flip_y_axis) => ({
      rotation,
      mirrored,
      flip_y_axis,
      ...metadata,
    })),
  ),
)

for (const {
  rotation,
  mirrored,
  flip_y_axis,
  metadata,
  offset,
  label,
} of cases) {
  test(`JLCPCB bottom component view: bottom ${rotation} degrees, ${label}, flip=${flip_y_axis}`, () => {
    const input = circuit({ rotation, ...metadata })
    const original = structuredClone(input)
    const warnings: PickAndPlaceRotationWarning[] = []
    const opts = {
      supplier: "jlcpcb" as const,
      flip_y_axis,
      requireSupplierRotation: label !== "unverified",
      onRotationWarning: (warning: PickAndPlaceRotationWarning) =>
        warnings.push(warning),
    }
    const expectedRotation = (mirrored + offset) % 360
    expect(convertCircuitJsonToPickAndPlaceRows(input, opts)).toEqual([
      {
        designator: "U1",
        mid_x: 12.5,
        mid_y: flip_y_axis ? 4.25 : -4.25,
        layer: "bottom",
        rotation: expectedRotation,
      },
    ])
    expect(warnings.map(({ reason }) => reason)).toEqual([
      label === "unverified"
        ? "missing_pin1_location"
        : "missing_supplier_assembly_rotation",
    ])
    expect(convertCircuitJsonToPickAndPlaceCsv(input, opts)).toBe(
      `Designator,Mid X,Mid Y,Layer,Rotation\r\nU1,12.500,${flip_y_axis ? "4.250" : "-4.250"},bottom,${expectedRotation}`,
    )
    expect(input).toEqual(original)
  })
}
