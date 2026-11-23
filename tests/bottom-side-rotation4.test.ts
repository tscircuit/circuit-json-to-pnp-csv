import { expect, test } from "bun:test"
import { convertCircuitJsonToPickAndPlaceRows } from "../src"
import { circuit } from "./fixtures/bottom-side-rotation"

test("top, generic and other-supplier angles retain their conventions", () => {
  for (const rotation of [-450, -90, 0, 90, 180, 270, 450, 22.5]) {
    for (const layer of ["top", "bottom"] as const) {
      const input = circuit({ rotation, layer })
      expect(convertCircuitJsonToPickAndPlaceRows(input)[0].rotation).toBe(
        rotation,
      )
      expect(
        convertCircuitJsonToPickAndPlaceRows(input, {
          supplier: "pcbway",
          onRotationWarning: () => {},
        })[0].rotation,
      ).toBe(rotation)
      if (layer === "top" || rotation === 0 || rotation === 180) {
        expect(
          convertCircuitJsonToPickAndPlaceRows(input, {
            supplier: "jlcpcb",
            onRotationWarning: () => {},
          })[0].rotation,
        ).toBe(rotation)
      }
      const verified = circuit({
        rotation,
        layer,
        pin1_location: "leftside_top",
        supplier_pin1_location_map: {
          pcbway: "topside_right",
          jlcpcb: "topside_right",
        },
      })
      const expected = (((rotation + 90) % 360) + 360) % 360
      expect(
        convertCircuitJsonToPickAndPlaceRows(verified, {
          supplier: "pcbway",
          requireSupplierRotation: true,
        })[0].rotation,
      ).toBe(expected)
      if (layer === "top")
        expect(
          convertCircuitJsonToPickAndPlaceRows(verified, {
            supplier: "jlcpcb",
            requireSupplierRotation: true,
          })[0].rotation,
        ).toBe(expected)
    }
  }
})
