import { describe, expect, it } from 'vitest'
import {
  calculateBookingGrandTotal,
  calculateBookingRemainingAmount,
  calculateVillaServiceTotal,
  calculateVillaServiceVendorCostTotal,
} from './villa-service-utils'

describe('villa-service-utils', () => {
  it('calculates service total from catalog prices and quantities', () => {
    const total = calculateVillaServiceTotal(
      [
        { serviceId: 1, quantity: 2 },
        { serviceId: 2, quantity: 1 },
      ],
      [
        { id: 1, name: 'BBQ', unitPrice: 500000, active: true, usageCount: 0, vendors: [], createdAt: '', updatedAt: '' },
        { id: 2, name: 'Airport transfer', unitPrice: 300000, active: true, usageCount: 0, vendors: [], createdAt: '', updatedAt: '' },
      ],
    )

    expect(total).toBe(1300000)
  })

  it('prefers order line prices and sums vendor costs separately', () => {
    const items = [
      { serviceId: 1, quantity: 2, unitPrice: 450000, vendorCost: 300000 },
      { serviceId: 2, quantity: 1, vendorCost: 120000 },
    ]
    const catalog = [
      { id: 1, name: 'BBQ', unitPrice: 500000, active: true, usageCount: 0, vendors: [], createdAt: '', updatedAt: '' },
      { id: 2, name: 'Airport transfer', unitPrice: 300000, active: true, usageCount: 0, vendors: [], createdAt: '', updatedAt: '' },
    ]

    expect(calculateVillaServiceTotal(items, catalog)).toBe(1200000)
    expect(calculateVillaServiceVendorCostTotal(items)).toBe(420000)
  })

  it('calculates booking grand total and remaining amount', () => {
    const grandTotal = calculateBookingGrandTotal(5000000, 800000)
    const remaining = calculateBookingRemainingAmount(grandTotal, 1000000, undefined)

    expect(grandTotal).toBe(5800000)
    expect(remaining).toBe(4800000)
  })

  it('falls back when total amount is missing', () => {
    expect(calculateBookingRemainingAmount(undefined, 100000, 250000)).toBe(250000)
  })
})
