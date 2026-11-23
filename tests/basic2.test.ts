import { expect, test } from "bun:test"
import { convertCircuitJsonToPickAndPlaceCsv } from "../src"
import { sampleSoup } from "./fixtures/basic"

test("convertCircuitJsonToPickAndPlaceCsv", () => {
  const csv = convertCircuitJsonToPickAndPlaceCsv(sampleSoup)
  const expectedCsv =
    "Designator,Mid X,Mid Y,Layer,Rotation\r\nR1,10.000,20.000,top,0\r\nC1,30.000,40.000,bottom,90"
  expect(csv).toBe(expectedCsv)
})
