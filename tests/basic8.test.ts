import { expect, test } from "bun:test"
import { convertCircuitJsonToPickAndPlaceRows } from "../src"
import { sampleSoup } from "./fixtures/basic"

test("preserves rotation when semantic pin-1 frames cannot be rotated into each other", () => {
  const incompatibleOrientationSoup = sampleSoup.map((element) => {
    if (element.type !== "pcb_component") return element
    return {
      ...element,
      pin1_location: "leftside_top" as const,
      supplier_pin1_location_map: {
        jlcpcb: "leftside_bottom" as const,
      },
    }
  })

  expect(
    convertCircuitJsonToPickAndPlaceRows(incompatibleOrientationSoup, {
      supplier: "jlcpcb",
    }).map((row) => row.rotation),
  ).toEqual([0, 90])
})
