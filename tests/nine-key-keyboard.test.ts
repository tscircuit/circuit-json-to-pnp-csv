import { test, expect } from "bun:test"
import { convertCircuitJsonToPickAndPlaceRows } from "../src/index"
import nine_key_keyboard from "./assets/nine-key-keyboard.json"

test("nine-key-keyboard", () => {
  const rows = convertCircuitJsonToPickAndPlaceRows(nine_key_keyboard as any)

  // Assert the total number of rows
  expect(rows.length).toBe(46)

  // Assert specific components
  expect(rows).toContainEqual({
    designator: "U1",
    mid_x: -30,
    mid_y: 0,
    layer: "top",
    rotation: 0,
  })

  expect(rows).toContainEqual({
    designator: "K1",
    mid_x: 0.9499999999999993,
    mid_y: -19.05,
    layer: "bottom",
    rotation: 0,
  })

  expect(rows).toContainEqual({
    designator: "D1",
    mid_x: 0.9499999999999993,
    mid_y: -32.05,
    layer: "bottom",
    rotation: 0,
  })

  // Assert the presence of all 9 keys and their shafts
  for (let i = 1; i <= 9; i++) {
    expect(rows).toContainEqual(
      expect.objectContaining({
        designator: `K${i}`,
        layer: "bottom",
        rotation: 0,
      }),
    )
    expect(rows).toContainEqual(
      expect.objectContaining({
        designator: `K${i}_shaft`,
        layer: "top",
        rotation: 0,
      }),
    )
  }

  // Assert the presence of all 9 diodes
  for (let i = 1; i <= 9; i++) {
    expect(rows).toContainEqual(
      expect.objectContaining({
        designator: `D${i}`,
        layer: "bottom",
        rotation: 0,
      }),
    )
  }

  // Assert that all components have valid coordinates
  for (const row of rows) {
    expect(typeof row.mid_x).toBe("number")
    expect(typeof row.mid_y).toBe("number")
    expect(Number.isNaN(row.mid_x)).toBe(false)
    expect(Number.isNaN(row.mid_y)).toBe(false)
  }

  // Assert that all components have valid layers
  for (const row of rows) {
    expect(["top", "bottom"]).toContain(row.layer)
  }

  // Assert that all components have valid rotations
  for (const row of rows) {
    expect(typeof row.rotation).toBe("number")
    expect(row.rotation).toBe(0) // In this case, all rotations are 0
  }
})
