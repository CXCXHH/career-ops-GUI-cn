// Unified render component — reads render spec and picks the correct display mode.
// Replaces all hand-written split() / list rendering logic across pages.

const SPLIT = {
  comma: /[,，、]/,
  semicolon: /[；;\n]/,
}

function formatDate(val) {
  if (!val) return null
  const s = String(val).trim()
  if (!s) return null
  // Already YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split('-')
    return `${y}.${m}`
  }
  return s
}

function splitAndTrim(val, type) {
  const sep = SPLIT[type] || SPLIT.comma
  return String(val || '').split(sep).map(v => v.trim()).filter(Boolean)
}

// ── Sub-renderers ──

function RenderText({ value }) {
  return <span className="field-text">{value}</span>
}

function RenderDate({ value }) {
  const formatted = formatDate(value)
  return formatted ? <span className="field-date">{formatted}</span> : null
}

function RenderCommaList({ value }) {
  const items = splitAndTrim(value, 'comma')
  if (items.length === 0) return null
  return (
    <div className="tag-cloud">
      {items.map((item, i) => (
        <span key={i} className="liquid-tag">{item}</span>
      ))}
    </div>
  )
}

function RenderSemicolonList({ value }) {
  const items = splitAndTrim(value, 'semicolon')
  if (items.length === 0) return null
  return (
    <ul className="bullet-list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

function RenderCardList({ spec, items }) {
  if (!Array.isArray(items) || items.length === 0) return null
  return (
    <div className="card-group">
      {items.map((item, i) => (
        <div key={i} className="entry-card">
          {Object.entries(spec.fields || {}).map(([key, fieldSpec]) => {
            const val = item[key]
            if (val === undefined || val === null || val === '') return null
            return (
              <div key={key} className="field-row">
                {fieldSpec.label && (
                  <label className="field-label">{fieldSpec.label}</label>
                )}
                <RenderField spec={fieldSpec} value={val} />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Main dispatcher ──

export default function RenderField({ spec, value }) {
  if (value === undefined || value === null || value === '') return null

  switch (spec.render) {
    case 'text':
      return <RenderText value={value} />
    case 'date':
      return <RenderDate value={value} />
    case 'comma_list':
      return <RenderCommaList value={value} />
    case 'semicolon_list':
      return <RenderSemicolonList value={value} />
    case 'card_list':
      return <RenderCardList spec={spec} items={value} />
    default:
      return <RenderText value={value} />
  }
}
