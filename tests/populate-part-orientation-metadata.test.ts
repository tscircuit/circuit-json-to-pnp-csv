import { expect, mock, test } from "bun:test"
import type { AnyCircuitElement, PcbComponent } from "circuit-json"
import {
  convertCircuitJsonToPickAndPlaceRows,
  populatePartOrientationMetadata,
  type PartOrientationOptions,
} from "../src"
import fixture from "./assets/sk9822-routed-without-orientation.circuit.json"

const circuit = () => structuredClone(fixture) as AnyCircuitElement[]
const pcb = (elements: AnyCircuitElement[]) =>
  elements.find(
    (element): element is PcbComponent => element.type === "pcb_component",
  )!
// Controlled supplier frame: pin 1 bottom-left, pin 2 bottom-right.
// This fixture tests conversion, not JLCPCB's physical SK9822 reel orientation.
const supplierPads: AnyCircuitElement[] = [
  [1, -1, -2],
  [2, 1, -2],
  [3, 1, 2],
  [4, -1, 2],
].map(([pin, x, y]) => ({
  type: "pcb_smtpad",
  pcb_smtpad_id: `pad${pin}`,
  pcb_component_id: "supplier",
  shape: "rect",
  layer: "top",
  x: x!,
  y: y!,
  width: 1,
  height: 1,
  port_hints: [`pin${pin}`],
}))
const withSupplier = (
  fetchPartCircuitJson = mock(async () => supplierPads),
): PartOrientationOptions => ({
  partsEngine: { fetchPartCircuitJson },
})
const stripMetadata = (elements: AnyCircuitElement[]) =>
  elements.map((element) => {
    if (element.type !== "pcb_component") return element
    const { pin1_location, supplier_pin1_location_map, ...rest } = element
    return rest
  })

test("recovers SK9822 authored frame from routed pads without moving any geometry", async () => {
  const original = circuit()
  const before = structuredClone(original)
  const fetchPartCircuitJson = mock(async () => supplierPads)
  const platformFetch = fetch
  const prepared = await populatePartOrientationMetadata(original, {
    ...withSupplier(fetchPartCircuitJson),
    platformFetch,
  })
  expect(original).toEqual(before)
  expect(stripMetadata(prepared)).toEqual(before)
  expect(pcb(prepared).pin1_location).toBe("leftside_top")
  expect(pcb(prepared).supplier_pin1_location_map?.jlcpcb).toBe(
    "bottomside_left",
  )
  expect(fetchPartCircuitJson).toHaveBeenCalledWith({
    supplierPartNumber: "C5378730",
    platformFetch,
  })
  expect(
    convertCircuitJsonToPickAndPlaceRows(prepared, { supplier: "jlcpcb" })[0]!
      .rotation,
  ).toBe(90)
})

test("preserves explicit metadata, including bottom-side frames, without fetching", async () => {
  const original = circuit()
  Object.assign(pcb(original), {
    layer: "bottom",
    pin1_location: "leftside_top",
    supplier_pin1_location_map: {
      jlcpcb: "bottomside_left",
      pcbway: "leftside_top",
    },
  })
  expect(
    await populatePartOrientationMetadata(original, {
      partsEngineDisabled: true,
    }),
  ).toEqual(original)
})

test("does not infer bottom-side frames when original footprint mirroring is unknown", async () => {
  const original = circuit()
  pcb(original).layer = "bottom"
  await expect(
    populatePartOrientationMetadata(original, withSupplier()),
  ).rejects.toThrow("bottom-side JSON requires explicit pin1_location")
})

test("reports disabled lookup instead of exporting an unverified rotation", async () => {
  const fetchPartCircuitJson = mock(async () => supplierPads)
  await expect(
    populatePartOrientationMetadata(circuit(), {
      ...withSupplier(fetchPartCircuitJson),
      partsEngineDisabled: true,
    }),
  ).rejects.toThrow(
    "D_RGB (jlcpcb:C5378730): supplier pin-1 orientation is missing",
  )
  expect(fetchPartCircuitJson).not.toHaveBeenCalled()
})

test("reports failed supplier lookups with component identity", async () => {
  await expect(
    populatePartOrientationMetadata(
      circuit(),
      withSupplier(
        mock(async () => {
          throw new Error("supplier offline")
        }),
      ),
    ),
  ).rejects.toThrow(
    "D_RGB (jlcpcb:C5378730): supplier orientation lookup failed: supplier offline",
  )
})

test("rejects absent supplier geometry and incompatible frames", async () => {
  await expect(
    populatePartOrientationMetadata(
      circuit(),
      withSupplier(mock(async () => [])),
    ),
  ).rejects.toThrow("cannot determine supplier pin-1 orientation")
  const original = circuit()
  pcb(original).supplier_pin1_location_map = { jlcpcb: "leftside_bottom" }
  await expect(populatePartOrientationMetadata(original, {})).rejects.toThrow(
    "cannot be matched by rotation",
  )
})

test("rejects missing numbered pads rather than fabricating local orientation metadata", async () => {
  const original = circuit().filter((element) => element.type !== "pcb_smtpad")
  await expect(
    populatePartOrientationMetadata(original, withSupplier()),
  ).rejects.toThrow("cannot determine authored pin-1 orientation")
})

test("fetches repeated supplier part numbers only once", async () => {
  const original = circuit()
  original.push({
    ...pcb(original),
    pcb_component_id: "second",
    pin1_location: "leftside_top",
  })
  const fetchPartCircuitJson = mock(async () => supplierPads)
  await populatePartOrientationMetadata(
    original,
    withSupplier(fetchPartCircuitJson),
  )
  expect(fetchPartCircuitJson).toHaveBeenCalledTimes(1)
})

test("excludes DNP parts, test points, and components without supplier part numbers", async () => {
  for (const kind of ["dnp", "testpoint", "no-supplier"]) {
    const original = circuit()
    const source = original.find(
      (element) => element.type === "source_component",
    )!
    if (kind === "dnp") pcb(original).do_not_place = true
    if (source.type === "source_component") {
      if (kind === "testpoint")
        Object.assign(source, { ftype: "simple_test_point" })
      if (kind === "no-supplier") delete source.supplier_part_numbers
    }
    expect(await populatePartOrientationMetadata(original, {})).toEqual(
      original,
    )
  }
})

for (const shape of ["polygon", "plated-hole"] as const) {
  test(`recovers orientation from ${shape} pads without changing them`, async () => {
    const original = circuit().map((element): AnyCircuitElement => {
      if (element.type !== "pcb_smtpad" || element.shape !== "rect")
        return element
      const { x, y, port_hints, pcb_component_id } = element
      if (shape === "polygon")
        return {
          type: "pcb_smtpad",
          pcb_smtpad_id: element.pcb_smtpad_id,
          pcb_component_id,
          port_hints,
          shape: "polygon",
          layer: "top",
          points: [
            { x: x - 0.5, y: y - 0.5 },
            { x: x + 0.5, y: y - 0.5 },
            { x: x + 0.5, y: y + 0.5 },
            { x: x - 0.5, y: y + 0.5 },
          ],
        }
      return {
        type: "pcb_plated_hole",
        pcb_plated_hole_id: element.pcb_smtpad_id,
        pcb_component_id,
        port_hints,
        shape: "circle",
        layers: ["top", "bottom"],
        x,
        y,
        hole_diameter: 0.5,
        outer_diameter: 1,
      }
    })
    const prepared = await populatePartOrientationMetadata(
      original,
      withSupplier(),
    )
    expect(pcb(prepared).pin1_location).toBe("leftside_top")
    expect(stripMetadata(prepared)).toEqual(original)
  })
}

test("populates a non-JLCPCB supplier through the injected parts engine", async () => {
  const original = circuit()
  const source = original.find(
    (element) => element.type === "source_component",
  )!
  if (source.type !== "source_component") throw new Error("missing source")
  source.supplier_part_numbers = { pcbway: ["PCBWAY-LED", "UNSELECTED"] }
  const fetchPartCircuitJson = mock(async () => supplierPads)
  const prepared = await populatePartOrientationMetadata(
    original,
    withSupplier(fetchPartCircuitJson),
  )
  expect(fetchPartCircuitJson).toHaveBeenCalledWith({
    supplierPartNumber: "PCBWAY-LED",
    platformFetch: undefined,
  })
  expect(fetchPartCircuitJson).toHaveBeenCalledTimes(1)
  expect(pcb(prepared).supplier_pin1_location_map).toEqual({
    pcbway: "bottomside_left",
  })
  expect(
    convertCircuitJsonToPickAndPlaceRows(prepared, {
      supplier: "pcbway",
      requireSupplierRotation: true,
    })[0]!.rotation,
  ).toBe(90)
  expect(stripMetadata(prepared)).toEqual(original)
})

test("processes the first candidate for each supplier by default, matching core", async () => {
  const original = circuit()
  const source = original.find(
    (element) => element.type === "source_component",
  )!
  if (source.type !== "source_component") throw new Error("missing source")
  source.supplier_part_numbers = {
    pcbway: ["PCBWAY-LED", "OTHER-LED"],
    jlcpcb: ["C5378730"],
  }
  const fetched: string[] = []
  const prepared = await populatePartOrientationMetadata(original, {
    partsEngine: {
      fetchPartCircuitJson: ({ supplierPartNumber }) => {
        fetched.push(supplierPartNumber!)
        return supplierPads
      },
    },
  })
  expect(fetched).toEqual(["PCBWAY-LED", "C5378730"])
  expect(pcb(prepared).supplier_pin1_location_map).toEqual({
    pcbway: "bottomside_left",
    jlcpcb: "bottomside_left",
  })
})

test("a supplier filter skips other suppliers' lookups and validation", async () => {
  const original = circuit()
  const source = original.find(
    (element) => element.type === "source_component",
  )!
  if (source.type !== "source_component") throw new Error("missing source")
  source.supplier_part_numbers = {
    jlcpcb: ["C5378730"],
    pcbway: ["PCBWAY-LED"],
  }
  pcb(original).supplier_pin1_location_map = { jlcpcb: "leftside_bottom" }
  const fetched: string[] = []
  const prepared = await populatePartOrientationMetadata(original, {
    supplier: "pcbway",
    partsEngine: {
      fetchPartCircuitJson: ({ supplierPartNumber }) => {
        fetched.push(supplierPartNumber!)
        return supplierPads
      },
    },
  })
  expect(fetched).toEqual(["PCBWAY-LED"])
  expect(pcb(prepared).supplier_pin1_location_map).toEqual({
    pcbway: "bottomside_left",
    jlcpcb: "leftside_bottom",
  })
})

test("does not share cached results across suppliers with the same part number", async () => {
  const original = circuit()
  const source = original.find(
    (element) => element.type === "source_component",
  )!
  if (source.type !== "source_component") throw new Error("missing source")
  source.supplier_part_numbers = {
    pcbway: ["SHARED-ID"],
    jlcpcb: ["SHARED-ID"],
  }
  const fetchPartCircuitJson = mock(async () => supplierPads)
  await populatePartOrientationMetadata(
    original,
    withSupplier(fetchPartCircuitJson),
  )
  expect(fetchPartCircuitJson).toHaveBeenCalledTimes(2)
})

test("reports non-JLCPCB lookup failures and deduplicates synchronous failures", async () => {
  const original = circuit()
  const source = original.find(
    (element) => element.type === "source_component",
  )!
  if (source.type !== "source_component") throw new Error("missing source")
  source.supplier_part_numbers = { pcbway: ["PCBWAY-LED"] }
  original.push({
    ...pcb(original),
    pcb_component_id: "second",
    pin1_location: "leftside_top",
  })
  const fetchPartCircuitJson = mock(() => {
    throw new Error("offline")
  })
  const before = structuredClone(original)
  await expect(
    populatePartOrientationMetadata(original, {
      partsEngine: { fetchPartCircuitJson },
    }),
  ).rejects.toThrow(
    "D_RGB (pcbway:PCBWAY-LED): supplier orientation lookup failed: offline",
  )
  expect(fetchPartCircuitJson).toHaveBeenCalledTimes(1)
  expect(original).toEqual(before)
})
