import { expect, test } from "bun:test"
import { convertCircuitJsonToPickAndPlaceRows } from "../src"
import { sampleSoup } from "./fixtures/basic"

test("convertCircuitJsonToPickAndPlaceRows with flip_y_axis option", () => {
  const rows = convertCircuitJsonToPickAndPlaceRows(sampleSoup, {
    flip_y_axis: true,
  })
  expect(rows).toEqual([
    { designator: "R1", mid_x: 10, mid_y: -20, layer: "top", rotation: 0 },
    {
      designator: "C1",
      mid_x: 30,
      mid_y: -40,
      layer: "bottom",
      rotation: 90,
    },
  ])
})
