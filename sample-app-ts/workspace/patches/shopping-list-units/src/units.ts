// Unit conversion helpers for the shopping list endpoint.
// Supported unit families: volume (ml, l, tsp, tbsp, cup) and weight (g, kg).

type VolumeUnit = 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup'
type WeightUnit = 'g' | 'kg'
type Unit = VolumeUnit | WeightUnit | string

const toMl: Record<VolumeUnit, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 236.588,
}

const toG: Record<WeightUnit, number> = {
  g: 1,
  kg: 1000,
}

// TODO: call unitConvert() in the shopping-list route when scaling ingredients
export function unitConvert(quantity: number, from: Unit, to: Unit): number | null {
  const fromVol = toMl[from as VolumeUnit]
  const toVol = toMl[to as VolumeUnit]
  if (fromVol !== undefined && toVol !== undefined) {
    return (quantity * fromVol) / toVol
  }

  const fromWt = toG[from as WeightUnit]
  const toWt = toG[to as WeightUnit]
  if (fromWt !== undefined && toWt !== undefined) {
    return (quantity * fromWt) / toWt
  }

  return null
}
