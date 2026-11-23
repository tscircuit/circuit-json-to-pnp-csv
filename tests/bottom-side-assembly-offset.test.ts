import { expect, test } from "bun:test"
import { convertCircuitJsonToPickAndPlaceRows } from "../src"
import { circuit } from "./fixtures/bottom-side-rotation"

test("JLCPCB converts the bottom angle before CAD and independent factory offsets", () => {
  // Synthetic factory data tests composition; the real C916374 response does
  // not provide a factory offset. A non-half-turn value distinguishes signs.
  const rotations = [0, 90, 180, 270].map((rotation) => {
    const metadata = {
      rotation,
      pin1_location: "leftside_top" as const,
      supplier_pin1_location_map: { jlcpcb: "topside_right" as const },
      supplier_assembly_rotation_offset_map: { jlcpcb: -30 },
    }
    const warnings: string[] = []
    const [row] = convertCircuitJsonToPickAndPlaceRows(circuit(metadata), {
      supplier: "jlcpcb",
      onRotationWarning: ({ reason }) => warnings.push(reason),
    })
    expect(warnings).toEqual([])
    return row!.rotation
  })
  expect(rotations).toEqual([60, 330, 240, 150])
})
