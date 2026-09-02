import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type {
  VillaServiceCatalog,
  VillaServiceCatalogUpsertRequest,
  VillaServiceOrder,
  VillaServiceOrderItemRequest,
  VillaServiceOrderStatus,
  VillaServiceOrderType,
  VillaServiceOrderUpsertRequest,
} from '../types'
import {
  calculateBookingRemainingAmount,
  calculateVillaServiceTotal,
  calculateVillaServiceVendorCostTotal,
} from './villa-service-utils'
import './pages.css'
import './admin-villa-services.css'

type PageTab = 'orders' | 'catalog'
type ViewMode = 'list' | 'calendar'

type ServiceFormState = {
  name: string
  unitPrice: string
  active: boolean
  vendorNames: string[]
  vendorInput: string
}

type OrderLineFormState = {
  serviceId: number
  vendorId: number
  quantity: number
  unitPrice: string
  vendorCost: string
}

type OrderFormState = {
  customerName: string
  customerPhone: string
  serviceDate: string
  status: VillaServiceOrderStatus
  depositEnabled: boolean
  depositAmount: string
  notes: string
  items: OrderLineFormState[]
}

const DEFAULT_SERVICE_FORM: ServiceFormState = {
  name: '',
  unitPrice: '',
  active: true,
  vendorNames: [],
  vendorInput: '',
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toMoneyInput(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return ''
  return String(Math.round(value))
}

function toMoneyValue(value: string) {
  const normalized = value.replace(/[^\d]/g, '')
  return normalized ? Number(normalized) : undefined
}

function createEmptyOrderLine(): OrderLineFormState {
  return {
    serviceId: 0,
    vendorId: 0,
    quantity: 1,
    unitPrice: '',
    vendorCost: '',
  }
}

function buildDefaultOrderForm(): OrderFormState {
  return {
    customerName: '',
    customerPhone: '',
    serviceDate: toDateInputValue(new Date()),
    status: 'OPEN',
    depositEnabled: false,
    depositAmount: '',
    notes: '',
    items: [createEmptyOrderLine()],
  }
}

function mapOrderToForm(order: VillaServiceOrder): OrderFormState {
  const depositAmount = toMoneyInput(order.depositAmount)
  return {
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    serviceDate: order.serviceDate ?? toDateInputValue(new Date()),
    status: order.status,
    depositEnabled: Boolean(order.depositAmount && order.depositAmount > 0),
    depositAmount,
    notes: order.notes,
    items: order.items.length > 0
      ? order.items.map((item) => ({
          serviceId: item.serviceId,
          vendorId: item.vendorId ?? 0,
          quantity: item.quantity,
          unitPrice: toMoneyInput(item.unitPrice),
          vendorCost: toMoneyInput(item.vendorCost),
        }))
      : [createEmptyOrderLine()],
  }
}

function formatMoney(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return 'TBA'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateLabel(value?: string | null) {
  if (!value) return 'Not set'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB')
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    if (error.body?.fields) return Object.values(error.body.fields).join(', ')
    return error.message
  }
  return fallback
}

function getOrderPrimaryLabel(order: VillaServiceOrder) {
  if (order.orderType === 'BOOKING') {
    return `${order.bookingRoomCode ?? 'Villa'} • ${order.bookingGuestName ?? order.customerName ?? 'Guest'}`
  }
  return order.customerName || 'Standalone order'
}

function getOrderSecondaryLabel(order: VillaServiceOrder) {
  return order.items
    .map((item) => {
      const vendorLabel = item.vendorName ? ` • ${item.vendorName}` : ''
      return `${item.serviceName} × ${item.quantity}${vendorLabel}`
    })
    .join(', ') || 'No services selected'
}

function statusToneClass(status: VillaServiceOrderStatus) {
  if (status === 'COMPLETED') return 'is-completed'
  if (status === 'CANCELLED') return 'is-cancelled'
  return 'is-open'
}

function getServiceOrderGuestTotal(order: VillaServiceOrder) {
  return order.serviceTotal ?? 0
}

function getServiceOrderOutstanding(order: VillaServiceOrder) {
  return calculateBookingRemainingAmount(order.serviceTotal, order.depositAmount ?? 0, order.serviceTotal ?? 0) ?? 0
}

export default function AdminVillaServicesPage() {
  const [activeTab, setActiveTab] = useState<PageTab>('orders')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [services, setServices] = useState<VillaServiceCatalog[]>([])
  const [orders, setOrders] = useState<VillaServiceOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const [serviceForm, setServiceForm] = useState<ServiceFormState>(DEFAULT_SERVICE_FORM)
  const [serviceEditingId, setServiceEditingId] = useState<number | null>(null)
  const [serviceSaving, setServiceSaving] = useState(false)
  const [serviceSaveError, setServiceSaveError] = useState<string | null>(null)
  const [serviceSearch, setServiceSearch] = useState('')
  const [serviceUsageFilter, setServiceUsageFilter] = useState<'ALL' | 'USED' | 'UNUSED'>('ALL')

  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderForm, setOrderForm] = useState<OrderFormState>(() => buildDefaultOrderForm())
  const [orderEditingId, setOrderEditingId] = useState<number | null>(null)
  const [orderSaving, setOrderSaving] = useState(false)
  const [orderSaveError, setOrderSaveError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actingOrderId, setActingOrderId] = useState<number | null>(null)

  const [orderQuery, setOrderQuery] = useState('')
  const [orderTypeFilter, setOrderTypeFilter] = useState<'ALL' | VillaServiceOrderType>('ALL')
  const [orderStatusFilter, setOrderStatusFilter] = useState<'ALL' | VillaServiceOrderStatus>('ALL')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const activeServiceOptions = useMemo(
    () => services.filter((service) => service.active || orderForm.items.some((item) => item.serviceId === service.id)),
    [services, orderForm.items],
  )

  const orderDraftItems = useMemo<VillaServiceOrderItemRequest[]>(
    () =>
      orderForm.items
        .filter((item) => item.serviceId > 0 && item.quantity > 0)
        .map((item) => ({
          serviceId: item.serviceId,
          quantity: item.quantity,
          unitPrice: toMoneyValue(item.unitPrice),
          vendorId: item.vendorId > 0 ? item.vendorId : undefined,
          vendorCost: toMoneyValue(item.vendorCost),
        })),
    [orderForm.items],
  )

  const orderDraftTotal = useMemo(
    () => calculateVillaServiceTotal(orderDraftItems, services),
    [orderDraftItems, services],
  )

  const orderDraftVendorCost = useMemo(
    () => calculateVillaServiceVendorCostTotal(orderDraftItems),
    [orderDraftItems],
  )

  const orderDraftDeposit = orderForm.depositEnabled ? toMoneyValue(orderForm.depositAmount) ?? 0 : 0
  const orderDraftOutstanding = calculateBookingRemainingAmount(orderDraftTotal, orderDraftDeposit, orderDraftTotal) ?? orderDraftTotal

  const filteredServices = useMemo(() => {
    const keyword = serviceSearch.trim().toLowerCase()
    return services.filter((service) => {
      if (serviceUsageFilter === 'USED' && service.usageCount <= 0) return false
      if (serviceUsageFilter === 'UNUSED' && service.usageCount > 0) return false
      if (!keyword) return true
      return (
        service.name.toLowerCase().includes(keyword)
        || service.vendors.some((vendor) => vendor.name.toLowerCase().includes(keyword))
      )
    })
  }, [serviceSearch, serviceUsageFilter, services])

  const filteredOrders = useMemo(() => {
    const keyword = orderQuery.trim().toLowerCase()
    return orders.filter((order) => {
      if (orderTypeFilter !== 'ALL' && order.orderType !== orderTypeFilter) return false
      if (orderStatusFilter === 'ALL' && order.status === 'CANCELLED') return false
      if (orderStatusFilter !== 'ALL' && order.status !== orderStatusFilter) return false
      if (fromDate && order.serviceDate && order.serviceDate < fromDate) return false
      if (toDate && order.serviceDate && order.serviceDate > toDate) return false
      if (!keyword) return true

      const haystack = [
        order.bookingRoomCode,
        order.bookingGuestName,
        order.customerName,
        order.customerPhone,
        order.notes,
        ...order.items.flatMap((item) => [item.serviceName, item.vendorName ?? '']),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(keyword)
    })
  }, [fromDate, orderQuery, orderStatusFilter, orderTypeFilter, orders, toDate])

  const calendarGroups = useMemo(() => {
    const grouped = new Map<string, VillaServiceOrder[]>()
    filteredOrders.forEach((order) => {
      const key = order.serviceDate ?? 'unscheduled'
      grouped.set(key, [...(grouped.get(key) ?? []), order])
    })
    return Array.from(grouped.entries()).sort(([left], [right]) => left.localeCompare(right))
  }, [filteredOrders])

  const topServices = useMemo(() => {
    const counts = new Map<string, number>()
    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        counts.set(item.serviceName, (counts.get(item.serviceName) ?? 0) + item.quantity)
      })
    })
    return Array.from(counts.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((left, right) => right.quantity - left.quantity || left.name.localeCompare(right.name))
      .slice(0, 5)
  }, [filteredOrders])

  const outstandingTotal = useMemo(
    () => filteredOrders.reduce((sum, order) => sum + getServiceOrderOutstanding(order), 0),
    [filteredOrders],
  )

  const vendorCostTotal = useMemo(
    () => filteredOrders.reduce((sum, order) => sum + (order.vendorCostTotal ?? 0), 0),
    [filteredOrders],
  )

  async function load() {
    setLoading(true)
    setPageError(null)
    try {
      const [servicesData, ordersData] = await Promise.all([
        apiFetch<VillaServiceCatalog[]>('/api/admin/villa-services'),
        apiFetch<VillaServiceOrder[]>('/api/admin/villa-service-orders'),
      ])
      setServices(servicesData)
      setOrders(ordersData)
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, 'Could not load villa service data'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreateOrder() {
    setOrderForm(buildDefaultOrderForm())
    setOrderEditingId(null)
    setOrderSaveError(null)
    setShowOrderModal(true)
  }

  function openEditOrder(order: VillaServiceOrder) {
    setOrderForm(mapOrderToForm(order))
    setOrderEditingId(order.id ?? null)
    setOrderSaveError(null)
    setShowOrderModal(true)
  }

  function openCreateService() {
    setActiveTab('catalog')
    setServiceEditingId(null)
    setServiceForm(DEFAULT_SERVICE_FORM)
    setServiceSaveError(null)
  }

  function handleAddVendorTag() {
    const vendorName = serviceForm.vendorInput.trim()
    if (!vendorName) return
    setServiceForm((current) => ({
      ...current,
      vendorInput: '',
      vendorNames: current.vendorNames.includes(vendorName)
        ? current.vendorNames
        : [...current.vendorNames, vendorName],
    }))
  }

  async function handleSaveService() {
    setServiceSaving(true)
    setServiceSaveError(null)
    try {
      const payload: VillaServiceCatalogUpsertRequest = {
        name: serviceForm.name.trim(),
        unitPrice: toMoneyValue(serviceForm.unitPrice),
        active: serviceForm.active,
        vendorNames: serviceForm.vendorNames,
      }
      if (serviceEditingId) {
        await apiFetch<VillaServiceCatalog>(`/api/admin/villa-services/${serviceEditingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch<VillaServiceCatalog>('/api/admin/villa-services', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      setServiceForm(DEFAULT_SERVICE_FORM)
      setServiceEditingId(null)
      await load()
    } catch (error: unknown) {
      setServiceSaveError(getErrorMessage(error, 'Could not save service'))
    } finally {
      setServiceSaving(false)
    }
  }

  async function handleDeleteService(service: VillaServiceCatalog) {
    if (!window.confirm(`Delete service "${service.name}"?`)) return
    try {
      await apiFetch<void>(`/api/admin/villa-services/${service.id}`, { method: 'DELETE' })
      await load()
    } catch (error: unknown) {
      setPageError(getErrorMessage(error, 'Could not delete service'))
    }
  }

  async function handleSaveOrder() {
    setOrderSaving(true)
    setOrderSaveError(null)
    try {
      const payload: VillaServiceOrderUpsertRequest = {
        customerName: orderForm.customerName.trim(),
        customerPhone: orderForm.customerPhone.trim(),
        serviceDate: orderForm.serviceDate,
        depositAmount: orderForm.depositEnabled ? toMoneyValue(orderForm.depositAmount) : undefined,
        status: orderForm.status,
        notes: orderForm.notes.trim(),
        items: orderDraftItems,
      }
      if (orderEditingId) {
        await apiFetch<VillaServiceOrder>(`/api/admin/villa-service-orders/${orderEditingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch<VillaServiceOrder>('/api/admin/villa-service-orders', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      setShowOrderModal(false)
      setOrderForm(buildDefaultOrderForm())
      setOrderEditingId(null)
      await load()
    } catch (error: unknown) {
      setOrderSaveError(getErrorMessage(error, 'Could not save service order'))
    } finally {
      setOrderSaving(false)
    }
  }

  async function handleUpdateOrderStatus(order: VillaServiceOrder, status: VillaServiceOrderStatus) {
    if (!order.id) return
    setActingOrderId(order.id)
    setActionError(null)
    try {
      await apiFetch<VillaServiceOrder>(`/api/admin/villa-service-orders/${order.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      await load()
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, 'Could not update service status'))
    } finally {
      setActingOrderId(null)
    }
  }

  async function handleCancelService(order: VillaServiceOrder) {
    if (!order.id) return
    const label = getOrderPrimaryLabel(order)
    const confirmMessage = order.orderType === 'BOOKING'
      ? `Delete service booking for "${label}"? This will remove the service from the booking and recalculate totals.`
      : `Delete service order for "${label}"? This item will disappear from the list.`
    if (!window.confirm(confirmMessage)) {
      return
    }

    setActingOrderId(order.id)
    setActionError(null)
    try {
      await apiFetch<void>(`/api/admin/villa-service-orders/${order.id}`, {
        method: 'DELETE',
      })
      await load()
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, 'Could not cancel service booking'))
    } finally {
      setActingOrderId(null)
    }
  }

  function updateOrderLine(index: number, patch: Partial<OrderLineFormState>) {
    setOrderForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const nextItem = { ...item, ...patch }
        if (patch.serviceId !== undefined) {
          const selectedService = services.find((service) => service.id === nextItem.serviceId)
          if (selectedService && !nextItem.unitPrice) {
            nextItem.unitPrice = toMoneyInput(selectedService.unitPrice)
          }
          if (selectedService && nextItem.vendorId > 0 && !selectedService.vendors.some((vendor) => vendor.id === nextItem.vendorId)) {
            nextItem.vendorId = 0
          }
        }
        return nextItem
      }),
    }))
  }

  if (loading) {
    return (
      <section className="section">
        <div className="container">
          <div className="card">Loading villa services...</div>
        </div>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="container villa-service-page">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <Link to="/admin" className="btn">Dashboard</Link>
            <Link to="/admin/room-bookings" className="btn">Villa schedule</Link>
          </div>
          <div className="row">
            <button className="btn" type="button" onClick={openCreateService}>Create service</button>
            <button className="btn primary" type="button" onClick={openCreateOrder}>Create order service</button>
            <button className="btn" type="button" onClick={() => void load()}>Reload</button>
          </div>
        </div>

        <div className="villa-service-hero">
          <div>
            <div className="badge">Villa Operations</div>
            <h2>Service Booking Management</h2>
            <p className="muted villa-service-hero-copy">
              Manage service catalog, linked vendors, flexible pricing, deposits, and vendor payout tracking in one responsive flow.
            </p>
          </div>
          <div className="villa-service-summary-cards">
            <div className="villa-service-summary-card">
              <span>Outstanding</span>
              <strong>{formatMoney(outstandingTotal)}</strong>
            </div>
            <div className="villa-service-summary-card">
              <span>Vendor cost</span>
              <strong>{formatMoney(vendorCostTotal)}</strong>
            </div>
            <div className="villa-service-summary-card villa-service-summary-card--top-services">
              <span>Top services</span>
              <div className="villa-service-top-list">
                {topServices.length === 0 ? (
                  <div className="muted">No service usage yet.</div>
                ) : (
                  topServices.map((item, index) => (
                    <div key={item.name} className="villa-service-top-item">
                      <strong>{index + 1}</strong>
                      <span>{item.name}</span>
                      <b>x{item.quantity}</b>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="villa-service-tabs">
          <button
            className={`villa-service-tab ${activeTab === 'orders' ? 'is-active' : ''}`}
            type="button"
            onClick={() => setActiveTab('orders')}
          >
            Service Orders
          </button>
          <button
            className={`villa-service-tab ${activeTab === 'catalog' ? 'is-active' : ''}`}
            type="button"
            onClick={() => setActiveTab('catalog')}
          >
            Service Catalog
          </button>
        </div>

        {pageError ? (
          <div className="card error">
            <div className="error-title">Could not load data</div>
            <div className="muted">{pageError}</div>
          </div>
        ) : null}

        {activeTab === 'orders' ? (
          <>
            <div className="card villa-service-toolbar">
              <div className="villa-service-toolbar-main">
                <label className="field">
                  <div className="field-label">Search</div>
                  <input
                    className="input"
                    value={orderQuery}
                    onChange={(e) => setOrderQuery(e.target.value)}
                    placeholder="Guest, villa, vendor, service..."
                  />
                </label>
                <label className="field">
                  <div className="field-label">From date</div>
                  <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </label>
                <label className="field">
                  <div className="field-label">To date</div>
                  <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </label>
                <label className="field">
                  <div className="field-label">Type</div>
                  <select
                    className="select"
                    value={orderTypeFilter}
                    onChange={(e) => setOrderTypeFilter(e.target.value as 'ALL' | VillaServiceOrderType)}
                  >
                    <option value="ALL">All</option>
                    <option value="BOOKING">Booking</option>
                    <option value="STANDALONE">Standalone</option>
                  </select>
                </label>
                <label className="field">
                  <div className="field-label">Status</div>
                  <select
                    className="select"
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value as 'ALL' | VillaServiceOrderStatus)}
                  >
                    <option value="ALL">All</option>
                    <option value="OPEN">Open</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </label>
              </div>

              <div className="villa-service-toolbar-actions">
                <div className="villa-service-toggle">
                  <button
                    className={`villa-service-toggle-btn ${viewMode === 'list' ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => setViewMode('list')}
                  >
                    Danh sách
                  </button>
                  <button
                    className={`villa-service-toggle-btn ${viewMode === 'calendar' ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => setViewMode('calendar')}
                  >
                    Lịch
                  </button>
                </div>
                <button className="btn primary" type="button" onClick={openCreateOrder}>
                  Add New
                </button>
              </div>
            </div>

            {actionError ? <div className="muted" style={{ color: '#b42318' }}>{actionError}</div> : null}

            {viewMode === 'list' ? (
              <div className="villa-service-order-list">
                {filteredOrders.map((order) => (
                  <article key={`${order.orderType}-${order.id ?? 'draft'}`} className="villa-service-order-card">
                    <div className="villa-service-order-card-head">
                      <div>
                        <div className="villa-service-order-title">{getOrderPrimaryLabel(order)}</div>
                        <div className="muted">{getOrderSecondaryLabel(order)}</div>
                      </div>
                      <div className="villa-service-order-badges">
                        <span className={`villa-service-status ${statusToneClass(order.status)}`}>{order.status}</span>
                        <span className="villa-service-kind">{order.orderType}</span>
                      </div>
                    </div>

                    <div className="villa-service-order-grid">
                      <div className="villa-service-order-cell">
                        <span>Service date</span>
                        <strong>{formatDateLabel(order.serviceDate)}</strong>
                      </div>
                      <div className="villa-service-order-cell">
                        <span>Guest total</span>
                        <strong>{formatMoney(getServiceOrderGuestTotal(order))}</strong>
                      </div>
                      <div className="villa-service-order-cell">
                        <span>Deposit</span>
                        <strong>{formatMoney(order.depositAmount ?? 0)}</strong>
                      </div>
                      <div className="villa-service-order-cell">
                        <span>Outstanding</span>
                        <strong>{formatMoney(getServiceOrderOutstanding(order))}</strong>
                      </div>
                      <div className="villa-service-order-cell">
                        <span>Vendor cost</span>
                        <strong>{formatMoney(order.vendorCostTotal ?? 0)}</strong>
                      </div>
                      <div className="villa-service-order-cell">
                        <span>Phone</span>
                        <strong>{order.customerPhone || 'N/A'}</strong>
                      </div>
                    </div>

                    {order.notes ? <div className="villa-service-order-note">{order.notes}</div> : null}

                    <div className="villa-service-order-actions">
                      <button
                        className="btn"
                        type="button"
                        onClick={() => void handleUpdateOrderStatus(order, order.status === 'COMPLETED' ? 'OPEN' : 'COMPLETED')}
                        disabled={actingOrderId === order.id}
                      >
                        {order.status === 'COMPLETED' ? 'Re-open' : 'Update Payment'}
                      </button>
                      <button
                        className="btn danger"
                        type="button"
                        onClick={() => void handleCancelService(order)}
                        disabled={actingOrderId === order.id}
                      >
                        Cancel Service
                      </button>
                      <button className="btn" type="button" onClick={() => openEditOrder(order)}>
                        Edit
                      </button>
                      {order.orderType === 'BOOKING' && order.bookingId ? (
                        <Link className="btn" to="/admin/room-bookings">Open booking</Link>
                      ) : null}
                    </div>
                  </article>
                ))}
                {filteredOrders.length === 0 ? <div className="card">No matching service orders.</div> : null}
              </div>
            ) : (
              <div className="villa-service-calendar">
                {calendarGroups.map(([date, items]) => (
                  <section key={date} className="villa-service-calendar-day">
                    <div className="villa-service-calendar-day-head">
                      <strong>{date === 'unscheduled' ? 'Unscheduled' : formatDateLabel(date)}</strong>
                      <span>{items.length} order(s)</span>
                    </div>
                    <div className="villa-service-calendar-day-list">
                      {items.map((order) => (
                        <div key={`${order.orderType}-${order.id ?? 'draft'}`} className="villa-service-calendar-item">
                          <div className="villa-service-calendar-item-title">{getOrderPrimaryLabel(order)}</div>
                          <div className="muted">{getOrderSecondaryLabel(order)}</div>
                          <div className="villa-service-calendar-item-foot">
                            <span className={`villa-service-status ${statusToneClass(order.status)}`}>{order.status}</span>
                            <strong>{formatMoney(getServiceOrderOutstanding(order))}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
                {calendarGroups.length === 0 ? <div className="card">No service orders in this range.</div> : null}
              </div>
            )}
          </>
        ) : (
          <div className="villa-service-grid">
            <div className="card detail-card">
              <div className="villa-service-panel-title">{serviceEditingId ? 'Edit service' : 'Create service'}</div>
              <label className="field">
                <div className="field-label">Service name</div>
                <input
                  className="input"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Airport transfer"
                />
              </label>
              <label className="field">
                <div className="field-label">Default guest price (optional)</div>
                <input
                  className="input"
                  inputMode="numeric"
                  value={serviceForm.unitPrice}
                  onChange={(e) => setServiceForm((current) => ({ ...current, unitPrice: e.target.value }))}
                  placeholder="Leave blank for flexible pricing"
                />
              </label>
              <label className="field">
                <div className="field-label">Linked vendors</div>
                <div className="villa-service-vendor-editor">
                  <input
                    className="input"
                    value={serviceForm.vendorInput}
                    onChange={(e) => setServiceForm((current) => ({ ...current, vendorInput: e.target.value }))}
                    placeholder="Add vendor name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddVendorTag()
                      }
                    }}
                  />
                  <button className="btn" type="button" onClick={handleAddVendorTag}>Add vendor</button>
                </div>
                <div className="villa-service-chip-list">
                  {serviceForm.vendorNames.map((vendorName) => (
                    <button
                      key={vendorName}
                      className="villa-service-chip"
                      type="button"
                      onClick={() =>
                        setServiceForm((current) => ({
                          ...current,
                          vendorNames: current.vendorNames.filter((item) => item !== vendorName),
                        }))
                      }
                    >
                      {vendorName} <span>x</span>
                    </button>
                  ))}
                </div>
              </label>
              <label className="villa-service-checkbox">
                <input
                  type="checkbox"
                  checked={serviceForm.active}
                  onChange={(e) => setServiceForm((current) => ({ ...current, active: e.target.checked }))}
                />
                <span>Available for new orders</span>
              </label>

              {serviceSaveError ? <div className="muted" style={{ color: '#b42318' }}>{serviceSaveError}</div> : null}

              <div className="row">
                <button className="btn primary" type="button" onClick={() => void handleSaveService()} disabled={serviceSaving}>
                  {serviceSaving ? 'Saving...' : serviceEditingId ? 'Update service' : 'Create service'}
                </button>
                {serviceEditingId ? (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setServiceEditingId(null)
                      setServiceForm(DEFAULT_SERVICE_FORM)
                      setServiceSaveError(null)
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>

            <div className="card detail-card">
              <div className="villa-service-panel-title">Service Catalog</div>
              <div className="row">
                <label className="field" style={{ flex: 1 }}>
                  <div className="field-label">Search services</div>
                  <input
                    className="input"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Search service or vendor..."
                  />
                </label>
                <label className="field" style={{ width: 190 }}>
                  <div className="field-label">Catalog filter</div>
                  <select
                    className="select"
                    value={serviceUsageFilter}
                    onChange={(e) => setServiceUsageFilter(e.target.value as 'ALL' | 'USED' | 'UNUSED')}
                  >
                    <option value="ALL">All services</option>
                    <option value="USED">Used in orders</option>
                    <option value="UNUSED">Unused</option>
                  </select>
                </label>
              </div>

              <div className="villa-service-list">
                {filteredServices.map((service) => (
                  <div key={service.id} className="villa-service-item">
                    <div>
                      <div className="villa-service-item-title">{service.name}</div>
                      <div className="muted">
                        {service.unitPrice ? formatMoney(service.unitPrice) : 'Flexible price'} • {service.active ? 'Active' : 'Inactive'} • {service.usageCount} order lines
                      </div>
                      <div className="villa-service-chip-list">
                        {service.vendors.length > 0 ? service.vendors.map((vendor) => (
                          <span key={vendor.id} className="villa-service-chip is-static">{vendor.name}</span>
                        )) : <span className="muted">No linked vendors</span>}
                      </div>
                    </div>
                    <div className="row">
                      <button
                        className="btn"
                        type="button"
                        onClick={() => {
                          setServiceEditingId(service.id)
                          setServiceForm({
                            name: service.name,
                            unitPrice: toMoneyInput(service.unitPrice),
                            active: service.active,
                            vendorNames: service.vendors.map((vendor) => vendor.name),
                            vendorInput: '',
                          })
                        }}
                      >
                        Edit
                      </button>
                      <button className="btn danger" type="button" onClick={() => void handleDeleteService(service)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {filteredServices.length === 0 ? <div className="muted">No matching services.</div> : null}
              </div>
            </div>
          </div>
        )}

        {showOrderModal ? (
          <div className="villa-service-modal-overlay" role="dialog" aria-modal="true" onClick={() => setShowOrderModal(false)}>
            <div className="villa-service-modal" onClick={(e) => e.stopPropagation()}>
              <div className="villa-service-modal-head">
                <div>
                  <h3>{orderEditingId ? 'Edit service order' : 'Create service order'}</h3>
                  <div className="muted">Flexible guest pricing, optional deposit, and vendor payout tracking.</div>
                </div>
                <button className="btn" type="button" onClick={() => setShowOrderModal(false)}>Close</button>
              </div>

              <div className="villa-service-modal-body">
                <div className="villa-service-modal-grid">
                  <label className="field">
                    <div className="field-label">Guest name / booking</div>
                    <input
                      className="input"
                      value={orderForm.customerName}
                      onChange={(e) => setOrderForm((current) => ({ ...current, customerName: e.target.value }))}
                      placeholder="Guest name or villa..."
                    />
                  </label>
                  <label className="field">
                    <div className="field-label">Phone</div>
                    <input
                      className="input"
                      value={orderForm.customerPhone}
                      onChange={(e) => setOrderForm((current) => ({ ...current, customerPhone: e.target.value }))}
                      placeholder="Phone number"
                    />
                  </label>
                  <label className="field">
                    <div className="field-label">Service date</div>
                    <input
                      className="input"
                      type="date"
                      value={orderForm.serviceDate}
                      onChange={(e) => setOrderForm((current) => ({ ...current, serviceDate: e.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <div className="field-label">Status</div>
                    <select
                      className="select"
                      value={orderForm.status}
                      onChange={(e) => setOrderForm((current) => ({ ...current, status: e.target.value as VillaServiceOrderStatus }))}
                    >
                      <option value="OPEN">Open</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </label>
                </div>

                <div className="villa-service-deposit-row">
                  <label className="villa-service-checkbox">
                    <input
                      type="checkbox"
                      checked={orderForm.depositEnabled}
                      onChange={(e) =>
                        setOrderForm((current) => ({
                          ...current,
                          depositEnabled: e.target.checked,
                          depositAmount: e.target.checked ? current.depositAmount : '',
                        }))
                      }
                    />
                    <span>Customer places a deposit</span>
                  </label>
                  {orderForm.depositEnabled ? (
                    <label className="field villa-service-deposit-field">
                      <div className="field-label">Deposit amount</div>
                      <input
                        className="input"
                        inputMode="numeric"
                        value={orderForm.depositAmount}
                        onChange={(e) => setOrderForm((current) => ({ ...current, depositAmount: e.target.value }))}
                        placeholder="0"
                      />
                    </label>
                  ) : null}
                </div>

                <div className="villa-service-line-panel">
                  <div className="villa-service-line-head">
                    <strong>Selected services</strong>
                    <button
                      className="btn"
                      type="button"
                      onClick={() =>
                        setOrderForm((current) => ({
                          ...current,
                          items: [...current.items, createEmptyOrderLine()],
                        }))
                      }
                    >
                      Add service line
                    </button>
                  </div>

                  <div className="villa-service-list">
                    {orderForm.items.map((item, index) => {
                      const selectedService = services.find((service) => service.id === item.serviceId)
                      const vendorOptions = selectedService?.vendors ?? []
                      const lineTotal = (toMoneyValue(item.unitPrice) ?? 0) * Math.max(item.quantity, 0)

                      return (
                        <div key={`${item.serviceId}-${index}`} className="villa-service-order-line villa-service-order-line--wide">
                          <select
                            className="select"
                            value={item.serviceId}
                            onChange={(e) => updateOrderLine(index, { serviceId: Number(e.target.value) })}
                          >
                            <option value={0}>Select service</option>
                            {activeServiceOptions.map((service) => (
                              <option key={service.id} value={service.id}>
                                {service.name}
                              </option>
                            ))}
                          </select>
                          <select
                            className="select"
                            value={item.vendorId}
                            onChange={(e) => updateOrderLine(index, { vendorId: Number(e.target.value) })}
                          >
                            <option value={0}>Vendor</option>
                            {vendorOptions.map((vendor) => (
                              <option key={vendor.id} value={vendor.id}>
                                {vendor.name}
                              </option>
                            ))}
                          </select>
                          <input
                            className="input"
                            inputMode="numeric"
                            value={item.unitPrice}
                            onChange={(e) => updateOrderLine(index, { unitPrice: e.target.value })}
                            placeholder="Guest price"
                          />
                          <input
                            className="input"
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateOrderLine(index, { quantity: Number(e.target.value) })}
                          />
                          <input
                            className="input"
                            inputMode="numeric"
                            value={item.vendorCost}
                            onChange={(e) => updateOrderLine(index, { vendorCost: e.target.value })}
                            placeholder="Vendor cost"
                          />
                          <div className="villa-service-line-total">{formatMoney(lineTotal)}</div>
                          <button
                            className="btn"
                            type="button"
                            onClick={() =>
                              setOrderForm((current) => ({
                                ...current,
                                items: current.items.length > 1
                                  ? current.items.filter((_, itemIndex) => itemIndex !== index)
                                  : [createEmptyOrderLine()],
                              }))
                            }
                          >
                            Remove
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <label className="field">
                  <div className="field-label">Notes</div>
                  <textarea
                    className="textarea"
                    value={orderForm.notes}
                    onChange={(e) => setOrderForm((current) => ({ ...current, notes: e.target.value }))}
                    placeholder="Booking or service notes..."
                  />
                </label>

                <div className="villa-service-modal-summary">
                  <div className="villa-service-total-box">
                    <span>Guest total</span>
                    <strong>{formatMoney(orderDraftTotal)}</strong>
                  </div>
                  <div className="villa-service-total-box">
                    <span>Deposit</span>
                    <strong>{formatMoney(orderDraftDeposit)}</strong>
                  </div>
                  <div className="villa-service-total-box">
                    <span>Outstanding</span>
                    <strong>{formatMoney(orderDraftOutstanding)}</strong>
                  </div>
                  <div className="villa-service-total-box">
                    <span>Vendor cost</span>
                    <strong>{formatMoney(orderDraftVendorCost)}</strong>
                  </div>
                </div>

                <div className="villa-service-modal-footer">
                  <div className="muted">You can leave service price blank in catalog and decide it per order line.</div>
                  <div className="row">
                    <button className="btn" type="button" onClick={() => setShowOrderModal(false)}>Cancel</button>
                    <button className="btn primary" type="button" onClick={() => void handleSaveOrder()} disabled={orderSaving}>
                      {orderSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>

                {orderSaveError ? <div className="muted" style={{ color: '#b42318' }}>{orderSaveError}</div> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
