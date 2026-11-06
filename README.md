# circuit-json-to-pnp-csv

Convert Circuit JSON into a Pick'n'Place CSV

## Installation

```bash
npm install circuit-json-to-pnp-csv
```

or

```bash
bun add circuit-json-to-pnp-csv
```

## Usage

This library provides two main functions:

1. `convertCircuitJsonToPickAndPlaceRows`: Converts Circuit JSON elements to an array of Pick'n'Place rows.
2. `convertCircuitJsonToPickAndPlaceCsv`: Converts Circuit JSON elements directly to a CSV string.

### Example

```typescript
import {
  convertCircuitJsonToPickAndPlaceCsv,
  convertCircuitJsonToPickAndPlaceRows,
} from "circuit-json-to-pnp-csv"
import type { AnyCircuitElement } from "circuit-json"

const circuitJson: AnyCircuitElement[] = [
  {
    type: "pcb_component",
    pcb_component_id: "R1",
    center: { x: 10, y: 20 },
    layer: "top",
    rotation: 0,
    width: 5,
    height: 2,
    source_component_id: "resistor1",
  },
  // ... more components
]

// Get Pick'n'Place rows
const rows = convertCircuitJsonToPickAndPlaceRows(circuitSoup)
console.log(rows)

// Get Pick'n'Place CSV
const csv = convertCircuitJsonToPickAndPlaceCsv(circuitSoup)
console.log(csv)
```

## API

### `convertCircuitJsonToPickAndPlaceRows(soup: AnyCircuitElement[], opts?: { flip_y_axis?: boolean }): PickAndPlaceRow[]`

Converts Circuit JSON elements to an array of Pick'n'Place rows.

- `circuitJson`: An array of Circuit JSON elements.
- `opts`: Optional configuration object.
  - `flip_y_axis`: If true, flips the Y-axis values. Default is `false`.

Returns an array of `PickAndPlaceRow` objects.

### `convertCircuitJsonToPickAndPlaceCsv`

Converts Circuit JSON elements directly to a CSV string. Passing a `supplier`
and `partsEngine` returns a promise that resolves to the CSV after looking up
any missing supplier orientation.

## Testing

This project uses Bun's built-in test runner. To run the tests, use the following command:

```bash
bun test
```

## License

[MIT License](LICENSE)

### Supplier rotations and unresolved metadata

Pass `{ supplier: "jlcpcb" }` to adjust rotations using
`pcb_component.pin1_location` and `supplier_pin1_location_map.jlcpcb`. These
fields describe the authored and supplier footprint frames used by the
synchronous converter. The async supplier export below can resolve missing frames.

If either field is missing, or the frames cannot be related by rotation, a
supplier-specific export **throws by default**. The PCB placement angle alone
does not establish the selected supplier's assembly angle. For example, a
DRV8452 footprint with lands rotated within the component needs a 90° supplier
placement even when its PCB component rotation is 0°.

For fabrication pipelines, prepare verified metadata and export for the supplier:

```ts
const csv = convertCircuitJsonToPickAndPlaceCsv(circuitJson, {
  supplier: "jlcpcb",
  requireSupplierRotation: true,
})
```

Do-not-place components and test points are excluded as usual. Without a
supplier, ordinary conversion retains PCB rotations without orientation warnings.
`requireSupplierRotation: true` requires a supplier. Supplier-specific callers
that intentionally need the previous warning-only behavior for an unverified
draft must explicitly pass `requireSupplierRotation: false`. In that mode,
`onRotationWarning` collects structured diagnostics (designator, PCB component
ID, supplier, reason and message) instead of logging them. Do not use that
fallback as a verified fabrication placement.

### Exporting saved boards with missing supplier metadata

Pass a parts engine and await the same CSV function.

```ts
import { convertCircuitJsonToPickAndPlaceCsv } from "circuit-json-to-pnp-csv"

const csv = await convertCircuitJsonToPickAndPlaceCsv(circuitJson, {
  supplier: "jlcpcb",
  partsEngine,
})
```

The export uses verified metadata where available. Otherwise it fetches the
selected supplier footprint through the parts engine and compares it with the
authored pad geometry. For footprints without a usable pin-1 frame, it matches
pad labels and checks for a unique quarter-turn alignment. An unresolved
rotation rejects the export with the affected component name. The synchronous
export remains available for callers that already have verified metadata.

### Preparing supplier orientation metadata

`populatePartOrientationMetadata` populates missing pin-1 metadata on a copy of routed
Circuit JSON before conversion. It recovers authored frames from top-side
numbered pads and looks up supplier frames using the supplied parts engine:

```ts
import {
  populatePartOrientationMetadata,
  convertCircuitJsonToPickAndPlaceCsv,
} from "circuit-json-to-pnp-csv"

const prepared = await populatePartOrientationMetadata(circuitJson, {
  partsEngine, // provides fetchPartCircuitJson({ supplierPartNumber, platformFetch })
  platformFetch: fetch,
})
const csv = convertCircuitJsonToPickAndPlaceCsv(prepared, { supplier: "jlcpcb" })
```

The helper accepts `PartOrientationOptions`, a minimal contract compatible with
a tscircuit platform config. It calls `partsEngine.fetchPartCircuitJson` with the
same `supplierPartNumber` and `platformFetch` arguments used by core, then writes
the analyzed frame to `supplier_pin1_location_map[supplier]`. No supplier client,
URL, or default parts engine is built into the helper.

By default it processes the first part number for every supplier listed in each
source component, matching core. Set `supplier` to restrict preparation to the
supplier selected for the PnP export. Lookup caching is scoped by both supplier
and part number. `partsEngineDisabled: true` prevents lookups; already
complete metadata works offline. It deduplicates supplier lookups and rejects
unresolved or incompatible frames with component-specific errors. It does not
move geometry, reroute, or mutate the input.

Qualification covers fitted components with supplier part numbers, excluding DNP
parts and test points. Bottom-side components need explicit `pin1_location`
metadata because prebuilt JSON does not record the original footprint layer
needed to undo mirroring safely. The helper does not fetch data for components
without supplier part numbers; use `requireSupplierRotation` during conversion to
require verified rotations for every included row.
