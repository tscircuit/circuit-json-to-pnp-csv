import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPickAndPlaceCsv } from "../src"
import { fixture } from "./fixtures/bottom-side-rotation"

test("exports the exact calibrated CPL verified in JLCPCB's 3D preview", async () => {
  // The reporter supplied no supplier frames. Encode the measured constant
  // offsets as synthetic frame pairs; preserve all saved geometry/CAD records.
  // These are experiment calibration values, not metadata from the reporter.
  const input = structuredClone(fixture).map((element) => {
    if (element.type !== "pcb_component") return element
    const source = fixture.find(
      (s) =>
        s.type === "source_component" &&
        s.source_component_id === element.source_component_id,
    )
    const isSot23 =
      source?.type === "source_component" && source.name?.startsWith("U")
    return {
      ...element,
      pin1_location: isSot23 ? "leftside_top" : "topside_left",
      supplier_pin1_location_map: {
        jlcpcb: isSot23 ? "rightside_bottom" : "topside_left",
      },
    }
  }) as AnyCircuitElement[]
  const original = structuredClone(input)
  const csv = convertCircuitJsonToPickAndPlaceCsv(input, {
    supplier: "jlcpcb",
    requireSupplierRotation: true,
  })
  const expected = await Bun.file(
    new URL(
      "../docs/repros/issue-41/CPL-proposed-U-offset-180.csv",
      import.meta.url,
    ),
  ).text()
  expect(csv).toBe(expected.trimEnd())
  expect(input).toEqual(original)
})
