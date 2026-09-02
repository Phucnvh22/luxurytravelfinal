import type { VillaServiceCatalog, VillaServiceOrderItemRequest } from '../types'

export function calculateVillaServiceTotal(
  items: VillaServiceOrderItemRequest[],
  catalog: VillaServiceCatalog[],
) {
  const priceById = new Map(catalog.map((service) => [service.id, service.unitPrice]))
  return items.reduce((sum, item) => {
    const unitPrice = item.unitPrice ?? priceById.get(item.serviceId) ?? 0
    return sum + unitPrice * Math.max(item.quantity, 0)
  }, 0)
}

export function calculateVillaServiceVendorCostTotal(items: VillaServiceOrderItemRequest[]) {
  return items.reduce((sum, item) => sum + Math.max(item.vendorCost ?? 0, 0), 0)
}

export function calculateBookingGrandTotal(villaRate?: number, serviceTotal?: number) {
  const total = (villaRate ?? 0) + (serviceTotal ?? 0)
  return total > 0 ? total : undefined
}

export function calculateBookingRemainingAmount(totalAmount?: number, depositAmount?: number, fallbackAmount?: number) {
  if (totalAmount === undefined || totalAmount === null || Number.isNaN(totalAmount)) {
    return fallbackAmount
  }
  return Math.max(totalAmount - (depositAmount ?? 0), 0)
}
