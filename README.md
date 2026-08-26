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

### `convertCircuitJsonToPickAndPlaceRows(soup: AnyCircuitElement[], opts?: PickAndPlaceConversionOptions): PickAndPlaceRow[]`

Converts Circuit JSON elements to an array of Pick'n'Place rows.

- `circuitJson`: An array of Circuit JSON elements.
- `opts`: Optional configuration object.
  - `flip_y_axis`: If true, flips the Y-axis values. Default is `false`.
  - `supplier`: Adjust rotations to the selected supplier's footprint orientation
    (for example, `"jlcpcb"`). Warns if orientation cannot be verified; see below.
  - `unverified_rotation`: `"warn"` (default) or `"error"`. With a supplier selected,
    choose whether unverified rotations produce warnings or prevent export.
  - `onWarning`: Optional `(message: string) => void` callback for displaying
    warnings in an export UI. Defaults to `console.warn`.

Returns an array of `PickAndPlaceRow` objects.

### `convertCircuitJsonToPickAndPlaceCsv(soup: AnyCircuitElement[], opts?: PickAndPlaceConversionOptions): string`

Converts Circuit JSON elements directly to a CSV string.

- `circuitJson`: An array of Circuit JSON elements.
- `opts`: The same options as `convertCircuitJsonToPickAndPlaceRows`.

Returns a string containing the CSV data.

### Supplier orientation validation

```typescript
const csv = convertCircuitJsonToPickAndPlaceCsv(circuitJson, {
  supplier: "jlcpcb",
  unverified_rotation: "error",
})
```

To verify a supplier rotation, each exported component needs both
`pcb_component.pin1_location` and the selected supplier's entry in
`pcb_component.supplier_pin1_location_map`. These describe the unrotated,
top-view pin-1 frames. If either frame is missing or they cannot be matched by
rotation, the default behavior is to warn with the component name, supplier,
reason, and raw PCB rotation being used as a fallback. No angles are guessed.
The raw rotation may not match the supplier's convention.

Use `unverified_rotation: "error"` to fail closed: the converter throws instead
of returning unchecked rows or a partial CSV. Do-not-place components and test
points remain excluded before validation. `onWarning` is not called for errors.

Existing Circuit JSON may lack this metadata, failed supplier lookups can leave
it incomplete, and the orientation analyzer cannot resolve every package
(including some two-pad parts and connectors). Re-render with
`platform.enablePartOrientationAnalysis` enabled and a working supplier parts
engine. If metadata remains unavailable, review orientation manually; absence
of metadata does **not** prove that a part is unpolarized or correctly oriented.
Incompatible frames require checking footprint pin numbering. CAD-model
rotation offsets are not assembly orientation metadata.

Calls without `supplier` continue to export raw PCB rotations. Those generic
rotations are not validated against any assembly supplier's footprint convention.
These checks validate orientation metadata only, not connectivity or pin polarity.

## Testing

This project uses Bun's built-in test runner. To run the tests, use the following command:

```bash
bun test
```

## License

[MIT License](LICENSE)
