import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch, HttpError } from '../lib/api'
import type { LazHostVillaTypeDashboardItem, LazHostVillaTypeDashboardResponse } from '../types'
import './pages.css'

type DraftItem = LazHostVillaTypeDashboardItem & {
  pmsPriceInput: string
  otaPriceInput: string
  lazHostRoomCodeInput: string
  lazHostRatePlanCodeInput: string
  currencyInput: string
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    if (error.body?.fields) return Object.values(error.body.fields).join(', ')
    return error.message
  }
  return fallback
}

function toPriceInput(value: number | null) {
  if (value === null || value === undefined) return ''
  if (Number.isFinite(value)) return String(value)
  return ''
}

function parsePrice(input: string) {
  const normalized = input.trim()
  if (!normalized) return null
  const asNumber = Number(normalized)
  if (!Number.isFinite(asNumber)) return null
  return asNumber
}

function toDraftItem(item: LazHostVillaTypeDashboardItem): DraftItem {
  return {
    ...item,
    pmsPriceInput: toPriceInput(item.pmsPrice),
    otaPriceInput: toPriceInput(item.otaPrice),
    lazHostRoomCodeInput: item.lazHostRoomCode ?? '',
    lazHostRatePlanCodeInput: item.lazHostRatePlanCode ?? '',
    currencyInput: item.currency ?? 'VND',
  }
}

export default function AdminOtaVillaTypesPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const canSave = useMemo(() => !loading && !saving && items.length > 0, [items.length, loading, saving])

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const query = new URLSearchParams()
      if (from) query.set('from', from)
      if (to) query.set('to', to)
      const url = query.toString()
        ? `/api/admin/integrations/lazhost/villa-type-dashboard?${query.toString()}`
        : '/api/admin/integrations/lazhost/villa-type-dashboard'
      const data = await apiFetch<LazHostVillaTypeDashboardResponse>(url)
      setFrom(data.from)
      setTo(data.to)
      setItems(data.items.map(toDraftItem))
      setError(null)
    } catch (e: unknown) {
      if (!opts?.silent) setError(getErrorMessage(e, 'Could not load villa type mapping'))
    } finally {
      if (!opts?.silent) setLoading(false)
      loadingRef.current = false
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await apiFetch<LazHostVillaTypeDashboardResponse>('/api/admin/integrations/lazhost/villa-type-dashboard', {
        method: 'PUT',
        body: JSON.stringify({
          from,
          to,
          items: items.map((item) => ({
            villaTypeCode: item.villaTypeCode,
            mappingActive: item.mappingActive,
            lazHostRoomCode: item.lazHostRoomCodeInput.trim(),
            lazHostRatePlanCode: item.lazHostRatePlanCodeInput.trim(),
            pmsPrice: parsePrice(item.pmsPriceInput),
            otaPrice: parsePrice(item.otaPriceInput),
            currency: item.currencyInput.trim() || 'VND',
          })),
        }),
      })
      await load({ silent: true })
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Could not save villa type mapping'))
    } finally {
      setSaving(false)
    }
  }

  function updateItem(villaTypeCode: string, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) => (item.villaTypeCode === villaTypeCode ? { ...item, ...patch } : item)),
    )
  }

  return (
    <section className="section">
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 className="title" style={{ marginBottom: 4 }}>
              OTA villa types
            </h2>
            <div className="muted">Map PMS villa types to OTA roomCode/ratePlanCode and set prices by date range.</div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn" type="button" onClick={() => void load()} disabled={loading || saving}>
              Reload
            </button>
            <button className="btn primary" type="button" onClick={() => void save()} disabled={!canSave}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <label className="field" style={{ minWidth: 180 }}>
              <div className="label">From</div>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={loading || saving} />
            </label>
            <label className="field" style={{ minWidth: 180 }}>
              <div className="label">To</div>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={loading || saving} />
            </label>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <button className="btn" type="button" onClick={() => void load()} disabled={loading || saving}>
                Apply range
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="card error" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>Villa type</th>
                <th>Total</th>
                <th>Booked</th>
                <th>Available</th>
                <th style={{ minWidth: 70 }}>Active</th>
                <th style={{ minWidth: 180 }}>OTA roomCode</th>
                <th style={{ minWidth: 180 }}>OTA ratePlanCode</th>
                <th style={{ minWidth: 130 }}>PMS price</th>
                <th style={{ minWidth: 130 }}>OTA price</th>
                <th style={{ minWidth: 90 }}>Currency</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.villaTypeCode}>
                  <td>{item.villaTypeCode}</td>
                  <td>{item.totalUnits}</td>
                  <td>{item.bookedUnits}</td>
                  <td>{item.availableUnits}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={item.mappingActive}
                      onChange={(e) => updateItem(item.villaTypeCode, { mappingActive: e.target.checked })}
                      disabled={saving}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      value={item.lazHostRoomCodeInput}
                      onChange={(e) => updateItem(item.villaTypeCode, { lazHostRoomCodeInput: e.target.value })}
                      disabled={saving}
                      placeholder="room_demo_deluxe"
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      value={item.lazHostRatePlanCodeInput}
                      onChange={(e) => updateItem(item.villaTypeCode, { lazHostRatePlanCodeInput: e.target.value })}
                      disabled={saving}
                      placeholder="rate_demo_flexible"
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      inputMode="decimal"
                      value={item.pmsPriceInput}
                      onChange={(e) => updateItem(item.villaTypeCode, { pmsPriceInput: e.target.value })}
                      disabled={saving}
                      placeholder="1200000"
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      inputMode="decimal"
                      value={item.otaPriceInput}
                      onChange={(e) => updateItem(item.villaTypeCode, { otaPriceInput: e.target.value })}
                      disabled={saving}
                      placeholder="1200000"
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      value={item.currencyInput}
                      onChange={(e) => updateItem(item.villaTypeCode, { currencyInput: e.target.value })}
                      disabled={saving}
                      placeholder="VND"
                    />
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={10} className="muted">
                    No villa types found.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={10} className="muted">
                    Loading...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

