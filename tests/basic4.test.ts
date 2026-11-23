import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPickAndPlaceRows } from "../src"
import { sampleSoup } from "./fixtures/basic"

test("skips do-not-place components", () => {
  const circuitJson = sampleSoup.map((element) => {
    if (
      element.type === "pcb_component" &&
      element.pcb_component_id === "pcb_component_2"
    ) {
      return { ...element, do_not_place: true }
    }

    return element
  }) as AnyCircuitElement[]

  const rows = convertCircuitJsonToPickAndPlaceRows(circuitJson)

  expect(rows.map((row) => row.designator)).toEqual(["R1"])
})
