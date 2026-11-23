import { expect, test } from "bun:test"
import {
  convertCircuitJsonToPickAndPlaceCsv,
  convertCircuitJsonToPickAndPlaceRows,
} from "../src"
import { sampleSoup } from "./fixtures/basic"

test("adjusts top and bottom rotations for the selected supplier", () => {
  const orientationAwareSoup = sampleSoup.map((element) => {
    if (element.type !== "pcb_component") return element
    return {
      ...element,
      pin1_location: "leftside_top" as const,
      supplier_pin1_location_map: {
        jlcpcb: "bottomside_left" as const,
        pcbway: "leftside_top" as const,
      },
    }
  })

  expect(
    convertCircuitJsonToPickAndPlaceRows(orientationAwareSoup, {
      supplier: "jlcpcb",
    }).map((row) => row.rotation),
  ).toEqual([270, 0])
  expect(
    convertCircuitJsonToPickAndPlaceRows(orientationAwareSoup, {
      supplier: "pcbway",
    }).map((row) => row.rotation),
  ).toEqual([0, 90])
  expect(
    convertCircuitJsonToPickAndPlaceCsv(orientationAwareSoup, {
      supplier: "jlcpcb",
    }),
  ).toContain("C1,30.000,40.000,bottom,0")
})
