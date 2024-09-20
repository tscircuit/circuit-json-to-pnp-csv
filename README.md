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

### `convertCircuitJsonToPickAndPlaceCsv(soup: AnyCircuitElement[]): string`

Converts Circuit JSON elements directly to a CSV string.

- `circuitJson`: An array of Circuit JSON elements.

Returns a string containing the CSV data.

## Testing

This project uses Bun's built-in test runner. To run the tests, use the following command:

```bash
bun test
```

## License

[MIT License](LICENSE)
