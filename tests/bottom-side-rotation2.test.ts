import { expect, test } from "bun:test"
import { convertCircuitJsonToPickAndPlaceRows } from "../src"
import { fixture } from "./fixtures/bottom-side-rotation"

test("recorded JLCPCB bottom/90 rows export 270 before supplier adjustment", () => {
  const rows = convertCircuitJsonToPickAndPlaceRows(fixture, {
    supplier: "jlcpcb",
    onRotationWarning: () => {},
  })
  expect(
    rows.map(({ designator, rotation }) => [designator, rotation]),
  ).toEqual([
    ["D1", 0],
    ["D2", 90],
    ["D3", 0],
    ["D4", 270],
    ["U1", 0],
    ["U2", 90],
    ["U3", 0],
    ["U4", 270],
  ])
})
