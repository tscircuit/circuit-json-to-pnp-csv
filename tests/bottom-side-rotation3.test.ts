import { expect, test } from "bun:test"
import {
  convertCircuitJsonToPickAndPlaceCsv,
  convertCircuitJsonToPickAndPlaceRows,
  type PickAndPlaceRotationWarning,
} from "../src"
import { circuit } from "./fixtures/bottom-side-rotation"

const unresolvedCases = [
  { reason: "missing_pin1_location", metadata: {} },
  {
    reason: "missing_supplier_pin1_location",
    metadata: { pin1_location: "leftside_top" },
  },
  {
    reason: "incompatible_pin1_locations",
    metadata: {
      pin1_location: "leftside_top",
      supplier_pin1_location_map: { jlcpcb: "leftside_bottom" },
    },
  },
] as const
for (const { reason, metadata } of unresolvedCases) {
  test.failing(`component-view fallback still diagnoses ${reason}`, () => {
    const warnings: PickAndPlaceRotationWarning[] = []
    const opts = {
      supplier: "jlcpcb" as const,
      onRotationWarning: (warning: PickAndPlaceRotationWarning) =>
        warnings.push(warning),
    }
    const input = circuit(metadata)
    expect(convertCircuitJsonToPickAndPlaceRows(input, opts)[0].rotation).toBe(
      270,
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({
      reason,
      designator: "U1",
      pcb_component_id: "pcb",
      supplier: "jlcpcb",
    })
    expect(warnings[0].message).toContain("270")
    expect(() =>
      convertCircuitJsonToPickAndPlaceCsv(input, {
        ...opts,
        requireSupplierRotation: true,
      }),
    ).toThrow(reason)
    expect(warnings).toHaveLength(1)
  })
}
