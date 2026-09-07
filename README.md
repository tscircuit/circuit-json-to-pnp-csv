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
