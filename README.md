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

### Supplier rotations and unresolved metadata

Pass `{ supplier: "jlcpcb" }` to adjust rotations using
`pcb_component.pin1_location` and `supplier_pin1_location_map.jlcpcb` to match
the authored and supplier CAD footprint frames. If the parts engine supplies an
entry in `supplier_assembly_rotation_offset_map`, the converter adds that
supplier's offset to the CAD angle. The offset is the counterclockwise machine
angle that matches the supplier's unrotated CAD footprint; an explicit zero
means the two references agree.
The map applies to the selected supplier for that export.

For JLCPCB bottom-side components, convert the board-view angle to the
component-view angle, `((360 - rotation) % 360 + 360) % 360`, then add the
supplier pin-1 alignment offset. A bottom-side 90° part exports 270° before
supplier adjustment; 0° and 180° are unchanged. Top-side parts and other
suppliers retain their existing conventions. `flip_y_axis` changes placement
Y coordinates only.

The [automatic same-board JLCPCB 3D verification](docs/repros/issue-41/README.md)
uses real C81598/C916374 supplier data, exact generated CSV rows and annotations.
The helper computes the SOT-23's 180° CAD-frame difference from numbered pads;
no manual rotation offset is supplied. CLI fabrication export prepares metadata
for TSX and prebuilt JSON, including stale authored frames in older JSON. Its
unchanged generated CSV aligns the tested top and bottom placements.

The catalog responses contain no separate factory assembly offset. That remains
unknown and is diagnosed; CAD alignment does not establish every part's factory
zero. Native CAD Euler z is also not the final supplier CSV angle. The
[earlier manually calibrated experiment](docs/repros/issue-41/HISTORICAL.md)
is retained as history, separate from the automatic verification.

[kicad-jlcpcb-tools](https://github.com/Bouni/kicad-jlcpcb-tools/blob/main/fabrication.py)
and [Fabrication Toolkit](https://github.com/bennymeg/Fabrication-Toolkit/blob/master/plugins/process.py)
also convert bottom angles before adding footprint corrections.
[JLCPCB's file guidance](https://jlcpcb.com/help/article/pick-place-file-for-pcb-assembly)
defines positive rotations as counterclockwise without specifying the bottom-side rule;
the linked real preview supplies the fixture-specific evidence here.

If either field is missing, or the frames cannot be related by rotation, the
converter exports the side-adjusted PCB rotation **and emits a warning**; the
part-specific supplier alignment remains unverified. Supply
`onRotationWarning` to collect structured diagnostics (designator, PCB component
ID, supplier, reason and message) instead of logging them. With a callback,
`missing_supplier_assembly_rotation` identifies orientation-sensitive parts
whose rows use the CAD angle without a factory reference. The converter cannot
derive the factory zero from footprint pads or the 3D model.

For fabrication pipelines, reject unresolved rotations:

```ts
const csv = convertCircuitJsonToPickAndPlaceCsv(circuitJson, {
  supplier: "jlcpcb",
  requireSupplierRotation: true,
})
```

`requireSupplierRotation` requires a supplier and throws before returning rows
or CSV when any included component cannot be aligned to supplier CAD. It does
not require a separate factory reference. Do-not-place
components and test points are excluded as usual. Without a supplier, ordinary
conversion retains PCB rotations without orientation warnings.

### Preparing supplier orientation metadata

`populatePartOrientationMetadata` prepares pin-1 metadata on a copy of routed
Circuit JSON before conversion. It recovers the canonical unrotated top-facing
authored frame from numbered pads on either PCB side and looks up supplier
frames using the supplied parts engine:

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
the analyzed frame to `supplier_pin1_location_map[supplier]`. When the catalog
supplies an assembly offset for that same frame, it is copied into
`supplier_assembly_rotation_offset_map[supplier]`. No supplier client,
URL, or default parts engine is built into the helper.

By default it processes the first part number for every supplier listed in each
source component, matching core. Set `supplier` to restrict preparation to the
supplier selected for the PnP export. Lookup caching is scoped by both supplier
and part number. `partsEngineDisabled: true` prevents lookups; already
complete metadata works offline. It deduplicates supplier lookups and rejects
unresolved or incompatible frames with component-specific errors. It does not
move geometry, reroute, or mutate the input.

Qualification covers fitted components with supplier part numbers, excluding DNP
parts and test points. Numbered physical pads take precedence over cached
`pin1_location` values, including incorrect bottom-side frames emitted by older
Core versions. Explicit frames remain a fallback when the geometry cannot be
analyzed. The helper does not fetch data for components without supplier part
numbers; use `requireSupplierRotation` during conversion to require CAD
alignment for every included row.
