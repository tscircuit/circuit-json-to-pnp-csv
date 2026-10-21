import { createHash } from "node:crypto"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPickAndPlaceRows } from "../src/index"

// Synthetic boards with 24 pads per component. Run with `bun benchmarks/large-board.ts`.
for (const componentCount of [100, 1000]) {
  const circuitJson: AnyCircuitElement[] = []
  for (let i = 0; i < componentCount; i++) {
    circuitJson.push(
      {
        type: "source_component",
        ftype: "simple_chip",
        source_component_id: `source_component_${i}`,
        name: `U${i + 1}`,
      },
      {
        type: "pcb_component",
        pcb_component_id: `pcb_component_${i}`,
        source_component_id: `source_component_${i}`,
        center: { x: i % 100, y: Math.floor(i / 100) },
        width: 4,
        height: 4,
        layer: "top",
        rotation: 0,
        obstructs_within_bounds: true,
      },
    )
    for (let pad = 0; pad < 24; pad++) {
      circuitJson.push({
        type: "pcb_smtpad",
        pcb_smtpad_id: `pad_${i}_${pad}`,
        pcb_component_id: `pcb_component_${i}`,
        shape: "rect",
        x: i % 100,
        y: Math.floor(i / 100) + pad / 10,
        width: 0.2,
        height: 0.4,
        layer: "top",
      })
    }
  }
  for (let warmup = 0; warmup < 3; warmup++) {
    convertCircuitJsonToPickAndPlaceRows(circuitJson)
  }
  const elapsed: number[] = []
  for (let run = 0; run < 7; run++) {
    const start = performance.now()
    convertCircuitJsonToPickAndPlaceRows(circuitJson)
    elapsed.push(performance.now() - start)
  }
  elapsed.sort((a, b) => a - b)
  const rows = convertCircuitJsonToPickAndPlaceRows(circuitJson)
  if (rows.length !== componentCount) throw new Error("Unexpected row count")
  console.log(
    JSON.stringify({
      components: componentCount,
      elements: circuitJson.length,
      median_ms: Number(elapsed[3]!.toFixed(3)),
      rows_sha256: createHash("sha256")
        .update(JSON.stringify(rows))
        .digest("hex"),
    }),
  )
}
