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
    type: "source_component",
    ftype: "simple_resistor",
    source_component_id: "resistor1",
    name: "R1",
    resistance: 1000,
  },
  {
    type: "pcb_component",
    pcb_component_id: "R1",
    center: { x: 10, y: 20 },
    layer: "top",
    rotation: 0,
    width: 5,
    height: 2,
    source_component_id: "resistor1",
    obstructs_within_bounds: true,
  },
]

// Get Pick'n'Place rows
const rows = convertCircuitJsonToPickAndPlaceRows(circuitJson)
console.log(rows)

// Get Pick'n'Place CSV
const csv = convertCircuitJsonToPickAndPlaceCsv(circuitJson)
console.log(csv)
```

The CSV output is:

```csv
Designator,Mid X,Mid Y,Layer,Rotation
R1,10.000,20.000,top,0
```

Each placeable `pcb_component` needs a matching `source_component`, linked by
`source_component_id`. Its source name becomes the CSV designator. Components
without a matching source, components marked `do_not_place`, and test points are
skipped.

## API

### `convertCircuitJsonToPickAndPlaceRows(circuitJson: AnyCircuitElement[], opts?: PickAndPlaceConversionOptions): PickAndPlaceRow[]`

Converts Circuit JSON elements to an array of Pick'n'Place rows.

- `circuitJson`: An array of Circuit JSON elements.
- `opts`: Optional configuration object.
  - `flip_y_axis`: If true, negates the Y coordinates. Default is `false`. This does not change rotations.
  - `supplier`: Optional supplier name, such as `"jlcpcb"`. Adjusts rotation from the authored `pin1_location` to the selected entry in `supplier_pin1_location_map`. If either location is missing or the frames cannot be rotated into each other, the original rotation is preserved.

Returns an array of `PickAndPlaceRow` objects.

### `convertCircuitJsonToPickAndPlaceCsv(circuitJson: AnyCircuitElement[], opts?: PickAndPlaceConversionOptions): string`

Converts Circuit JSON elements directly to a CSV string.

- `circuitJson`: An array of Circuit JSON elements.
- `opts`: The same conversion options accepted by `convertCircuitJsonToPickAndPlaceRows`.

Returns a string containing the CSV data, with X and Y coordinates formatted to three decimal places.

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
fields must describe the authored and supplier footprint frames; the converter
does not fetch supplier footprints or analyze pad geometry.

If either field is missing, or the frames cannot be related by rotation, the
converter keeps the PCB rotation **and emits a warning**. Supply
`onRotationWarning` to collect structured diagnostics (designator, PCB component
ID, supplier, reason and message) instead of logging them.

For fabrication pipelines, reject unresolved rotations:

```ts
const csv = convertCircuitJsonToPickAndPlaceCsv(circuitJson, {
  supplier: "jlcpcb",
  requireSupplierRotation: true,
})
```

`requireSupplierRotation` requires a supplier and throws before returning rows
or CSV when any included component has unresolved rotation metadata. Do-not-place
components and test points are excluded as usual. Without a supplier, ordinary
conversion retains PCB rotations without orientation warnings.

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
