import { expect, mock, test } from "bun:test"
import type { AnyCircuitElement, PcbComponent } from "circuit-json"
import {
  convertCircuitJsonToPickAndPlaceCsv,
  convertCircuitJsonToPickAndPlaceRows,
  populatePartOrientationMetadata,
} from "../src"
import supplierFixture from "./assets/jst-ph-c131334-supplier.circuit.json"
import routedFixture from "./assets/jst-ph-routed-without-orientation.circuit.json"

// J1 (B4B-PH-K-S(LF)(SN)) from the routed motor controller and the
// unrotated C131334 JLCsearch footprint. Their numbered pad rows are reversed.
test("exports JST PH J1 at its supplier rotation without changing PCB or CAD", async () => {
  const routed = structuredClone(routedFixture) as AnyCircuitElement[]
  const supplier = structuredClone(supplierFixture) as AnyCircuitElement[]
  const original = structuredClone(routed)
  const fetchPartCircuitJson = mock(async () => supplier)
  const prepared = await populatePartOrientationMetadata(routed, {
    supplier: "jlcpcb",
    partsEngine: { fetchPartCircuitJson },
  })
  expect(fetchPartCircuitJson).toHaveBeenCalledWith({
    supplierPartNumber: "C131334",
    platformFetch: undefined,
  })
  const pcb = prepared.find(
    (e): e is PcbComponent => e.type === "pcb_component",
  )!
  expect(pcb.pin1_location).toBe("topside_left")
  expect(pcb.supplier_pin1_location_map?.jlcpcb).toBe("bottomside_right")
  const options = { supplier: "jlcpcb", requireSupplierRotation: true } as const
  expect(convertCircuitJsonToPickAndPlaceRows(prepared, options)).toEqual([
    { designator: "J1", mid_x: 17, mid_y: -4.7, layer: "top", rotation: 270 },
  ])
  expect(convertCircuitJsonToPickAndPlaceCsv(prepared, options)).toBe(
    "Designator,Mid X,Mid Y,Layer,Rotation\r\nJ1,17.000,-4.700,top,270",
  )
  expect(convertCircuitJsonToPickAndPlaceRows(prepared)[0]!.rotation).toBe(90)
  expect(routed).toEqual(original)
  expect(
    prepared.map((e) => {
      if (e.type !== "pcb_component") return e
      const { pin1_location, supplier_pin1_location_map, ...geometry } = e
      return geometry
    }),
  ).toEqual(original)
})
