import { useState } from 'react'

// Shared date range picker — used by PostListing and Dashboard Edit modal

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

export function sod(date) {
  if (!date) return null
  const d = new Date(date); d.setHours(0,0,0,0); return d
}
function same(a, b) {
  if (!a || !b) return false
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function before(a, b) { return a && b && a.getTime() < b.getTime() }
function buildCells(year, month) {
  const first = new Date(year, month, 1).getDay()
  const total = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < first; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d))
  return cells
}
export function fmtDate(d) {
  if (!d) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Parse a stored dates string like "May 1, 2024 to Aug 15, 2024" → [startDate, endDate]
export function parseDateRange(str) {
  if (!str) return [null, null]
  const parts = str.split(' to ')
  if (parts.length !== 2) return [null, null]
  const s = sod(new Date(parts[0]))
  const e = sod(new Date(parts[1]))
  return [isNaN(s?.getTime()) ? null : s, isNaN(e?.getTime()) ? null : e]
}

export function RangeDatePicker({ startDate, endDate, onStart, onEnd, dm }) {
  const today = sod(new Date())
  const [vy, setVy] = useState(startDate ? startDate.getFullYear() : today.getFullYear())
  const [vm, setVm] = useState(startDate ? startDate.getMonth() : today.getMonth())
  const [picking, setPicking] = useState('start')
  const [hover, setHover] = useState(null)

  const ry = vm === 11 ? vy + 1 : vy
  const rm = vm === 11 ? 0 : vm + 1

  const prev = () => { if (vm === 0) { setVm(11); setVy(y => y-1) } else setVm(m => m-1) }
  const next = () => { if (vm === 11) { setVm(0); setVy(y => y+1) } else setVm(m => m+1) }

  const handleClick = (date) => {
    const d = sod(date)
    if (before(d, today) && !same(d, today)) return
    if (picking === 'start' || !startDate || before(d, startDate)) {
      onStart(d); onEnd(null); setPicking('end')
    } else {
      onEnd(d); setPicking('start')
    }
  }

  const effEnd = endDate || (picking === 'end' && hover && startDate && !before(hover, startDate) ? hover : null)
  const isStart = (d) => same(d, startDate)
  const isEnd = (d) => {
    if (same(d, endDate)) return true
    if (!endDate && picking === 'end' && hover && startDate && !before(hover, startDate)) return same(d, hover)
    return false
  }
  const inRange = (d) => {
    if (!d || !startDate || !effEnd) return false
    const t = d.getTime(), s = startDate.getTime(), e = effEnd.getTime()
    return t > Math.min(s,e) && t < Math.max(s,e)
  }

  const bgCard = dm ? '#1c1c1e' : '#fff'
  const borderColor = dm ? 'rgba(255,255,255,0.1)' : 'rgba(0,39,76,0.12)'
  const divider = dm ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
  const tp = dm ? '#f5f5f7' : '#1d1d1f'
  const ts = dm ? '#8e8e93' : '#6e6e73'
  const tf = dm ? '#636366' : '#aeaeb2'
  const rangeBg = dm ? 'rgba(255,203,5,0.12)' : 'rgba(0,39,76,0.07)'

  const renderMonth = (year, month, showL, showR) => {
    const cells = buildCells(year, month)
    while (cells.length % 7 !== 0) cells.push(null)
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={prev} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'none', cursor: showL ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: showL ? ts : 'transparent', transition: 'background 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { if (showL) e.currentTarget.style.background = dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: tp, letterSpacing: '-0.01em' }}>{MONTHS[month]} {year}</span>
          <button onClick={next} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'none', cursor: showR ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: showR ? ts : 'transparent', transition: 'background 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { if (showR) e.currentTarget.style.background = dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
          {WDAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: tf, padding: '4px 0', letterSpacing: '0.04em' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((date, idx) => {
            if (!date) return <div key={`e-${month}-${idx}`} style={{ height: 38 }} />
            const isPast = before(date, today) && !same(date, today)
            const start = isStart(date), end = isEnd(date), range = inRange(date), isToday = same(date, today)
            const bandRight = start && effEnd && !same(date, effEnd)
            const bandLeft = end && startDate && !same(date, startDate)
            let circleBg = 'transparent'
            let textCol = isPast ? (dm ? '#3a3a3c' : '#d2d2d7') : tp
            if (start) { circleBg = '#00274C'; textCol = '#FFCB05' }
            if (end) { circleBg = '#FFCB05'; textCol = '#00274C' }
            return (
              <div key={`${year}-${month}-${date.getDate()}`}
                style={{ position: 'relative', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isPast ? 'default' : 'pointer' }}
                onMouseEnter={() => !isPast && setHover(sod(date))}
                onMouseLeave={() => setHover(null)}
                onClick={() => handleClick(date)}>
                {(range || bandRight || bandLeft) && (
                  <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', height: 34, left: bandLeft ? 0 : (range ? 0 : '50%'), right: bandRight ? 0 : (range ? 0 : '50%'), background: rangeBg, pointerEvents: 'none' }} />
                )}
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: circleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, transition: 'background 0.1s' }}>
                  <span style={{ fontSize: 13, fontWeight: start || end ? 700 : (isToday ? 600 : 400), color: textCol, lineHeight: 1 }}>{date.getDate()}</span>
                  {isToday && !start && !end && <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: dm ? '#FFCB05' : '#00274C' }} />}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const days = startDate && endDate ? Math.round((endDate - startDate) / 86400000) : null

  return (
    <div style={{ background: bgCard, border: `1.5px solid ${borderColor}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1.5px solid ${divider}` }}>
        {[{ key: 'start', label: 'FROM', value: startDate ? fmtDate(startDate) : null }, { key: 'end', label: 'TO', value: endDate ? fmtDate(endDate) : null }].map((tab, i) => (
          <button key={tab.key} onClick={() => setPicking(tab.key)} style={{ padding: '12px 18px', background: picking === tab.key ? (dm ? 'rgba(255,203,5,0.05)' : 'rgba(0,39,76,0.025)') : 'transparent', border: 'none', borderRight: i === 0 ? `1px solid ${divider}` : 'none', borderBottom: `2.5px solid ${picking === tab.key ? (dm ? '#FFCB05' : '#00274C') : 'transparent'}`, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 3, color: picking === tab.key ? (dm ? '#FFCB05' : '#00274C') : tf }}>{tab.label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: tab.value ? tp : tf }}>{tab.value || 'Add date'}</div>
          </button>
        ))}
      </div>
      <div className="cal-grid" style={{ display: 'flex', gap: 0, padding: '18px 20px' }}>
        {renderMonth(vy, vm, true, false)}
        <div className="cal-divider" style={{ width: 1, background: divider, margin: '0 18px', flexShrink: 0 }} />
        {renderMonth(ry, rm, false, true)}
      </div>
      <div style={{ padding: '8px 20px 14px', borderTop: `1px solid ${divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 40 }}>
        <span style={{ fontSize: 13, color: ts }}>
          {days !== null
            ? <><span style={{ fontWeight: 700, color: dm ? '#FFCB05' : '#00274C' }}>{days}</span> days</>
            : startDate ? <span style={{ color: tf }}>Now select your end date</span>
            : <span style={{ color: tf }}>Select your move-in date</span>}
        </span>
        {(startDate || endDate) && (
          <button onClick={() => { onStart(null); onEnd(null); setPicking('start') }} style={{ background: 'none', border: 'none', fontSize: 13, color: tf, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
            onMouseEnter={e => e.currentTarget.style.color = dm ? '#f5f5f7' : '#1d1d1f'}
            onMouseLeave={e => e.currentTarget.style.color = tf}>Clear dates</button>
        )}
      </div>
    </div>
  )
}
