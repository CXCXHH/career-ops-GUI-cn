// Unified merge logic — used by all AI endpoints
// Reads schema definitions to decide how to combine existing + incoming data

import { isListField } from './schema.js'

/**
 * Merge two values according to their schema rule.
 *
 * @param {*} existing  current value
 * @param {*} incoming  AI-extracted value (may be null/undefined)
 * @param {Object} fieldRule  schema field definition { type, merge, merge_key?, item_schema? }
 * @returns {*} merged value
 */
export function mergeField(existing, incoming, fieldRule) {
  if (incoming === undefined || incoming === null) return existing
  if (!fieldRule || !fieldRule.merge) return existing  // merge: null → skip

  switch (fieldRule.merge) {
    case 'fill_empty': {
      if (existing === undefined || existing === null || existing === '' ||
          (Array.isArray(existing) && existing.length === 0)) {
        return incoming
      }
      return existing
    }

    case 'overwrite': {
      return incoming
    }

    case 'union': {
      return unionValues(existing, incoming, fieldRule)
    }

    case 'match_merge': {
      if (!Array.isArray(incoming)) return existing
      return matchMergeArray(existing || [], incoming, fieldRule.merge_key, fieldRule.item_schema)
    }

    default:
      return existing
  }
}

/**
 * Merge a full entity object against its schema.
 */
export function mergeData(existing, incoming, schema) {
  const merged = { ...existing }
  for (const [key, fieldRule] of Object.entries(schema)) {
    if (key in incoming) {
      merged[key] = mergeField(merged[key], incoming[key], fieldRule)
    }
  }
  return merged
}

// ── Internal helpers ──

/**
 * Combine two union-type values (comma_list, array).
 * For comma_list strings: splits, deduplicates, re-joins.
 * For arrays: deduplicates by identity.
 */
function unionValues(existing, incoming, fieldRule) {
  if (isListField(fieldRule)) {
    const oldItems = splitList(existing)
    const newItems = splitList(incoming)
    const merged = new Set([...oldItems, ...newItems])
    return Array.from(merged).join(', ')
  }
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    const merged = [...existing]
    for (const item of incoming) {
      if (!merged.includes(item)) merged.push(item)
    }
    return merged
  }
  return incoming
}

/**
 * Merge arrays by matching on a key field.
 * Same-key items get field-level merge (fill-empty). New items appended.
 */
function matchMergeArray(existing, incoming, keyField, itemSchema) {
  const result = existing.map(item => ({ ...item }))

  for (const newItem of incoming) {
    const matchKey = normalizeKey(newItem[keyField])
    if (!matchKey) continue

    const idx = result.findIndex(e => normalizeKey(e[keyField]) === matchKey)
    if (idx >= 0) {
      // Merge each field: fill empty only (don't overwrite existing data)
      if (itemSchema) {
        for (const [subKey, subRule] of Object.entries(itemSchema)) {
          if (subKey in newItem) {
            const merged = mergeField(result[idx][subKey], newItem[subKey], { ...subRule, merge: subRule.merge || 'fill_empty' })
            result[idx][subKey] = merged
          }
        }
      } else {
        // No sub-schema, just fill empty fields
        for (const [subKey, subVal] of Object.entries(newItem)) {
          if (!result[idx][subKey] && subVal) result[idx][subKey] = subVal
        }
      }
    } else {
      result.push({ ...newItem })
    }
  }

  return result
}

function normalizeKey(val) {
  if (val === undefined || val === null) return ''
  return String(val).trim().toLowerCase()
}

function splitList(val) {
  if (Array.isArray(val)) return val.map(String).map(v => v.trim()).filter(Boolean)
  return String(val || '').split(/[,，、]/).map(v => v.trim()).filter(Boolean)
}
