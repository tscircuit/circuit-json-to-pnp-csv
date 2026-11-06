import type { AnyCircuitElement, SupplierName } from "circuit-json"

/** Minimal parts-engine contract; compatible with a tscircuit platform config. */
export interface PartOrientationOptions {
  /** Restrict preparation to one supplier; otherwise process each supplier on the source component. */
  supplier?: SupplierName
  partsEngine?: {
    fetchPartCircuitJson?: (params: {
      supplierPartNumber?: string
      manufacturerPartNumber?: string
      platformFetch?: typeof fetch
    }) =>
      | AnyCircuitElement[]
      | undefined
      | Promise<AnyCircuitElement[] | undefined>
  }
  partsEngineDisabled?: boolean
  platformFetch?: typeof fetch
}

export const createSupplierFootprintLookup = (
  options: PartOrientationOptions,
):
  | ((
      supplier: SupplierName,
      partNumber: string,
    ) => Promise<AnyCircuitElement[] | undefined>)
  | undefined => {
  const engine = options.partsEngine
  if (options.partsEngineDisabled || !engine?.fetchPartCircuitJson) return

  const fetchPart = engine.fetchPartCircuitJson.bind(engine)
  const pendingFootprints = new Map<
    string,
    Promise<AnyCircuitElement[] | undefined>
  >()
  return (supplier: SupplierName, partNumber: string) => {
    const key = `${supplier}:${partNumber}`
    let pending = pendingFootprints.get(key)
    if (!pending) {
      pending = Promise.resolve().then(() =>
        fetchPart({
          supplierPartNumber: partNumber,
          platformFetch: options.platformFetch,
        }),
      )
      pendingFootprints.set(key, pending)
    }
    return pending
  }
}
