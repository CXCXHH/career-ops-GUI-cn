// Data schema — field definitions, defaults, merge strategies
// All entities live here. Backend uses for validation and merge. Frontend render-spec mirrors the field→render-type mapping.

// ── field-level definitions ──

export const FIELD = {
  // Primitive
  string:      { type: 'string', default: '' },
  text:        { type: 'text',   default: '' },  // longer free text
  date:        { type: 'date',   default: '' },  // YYYY-MM
  comma_list:  { type: 'comma_list',     default: '' },  // "R, Python, SQL"
  semicolon_list: { type: 'semicolon_list', default: '' },  // "内容1；内容2"
  number:      { type: 'number', default: 0 },
  bool:        { type: 'bool',   default: false },
}

// ── reusable sub-schemas ──

export const EDUCATION_ITEM = {
  school:       { ...FIELD.string },
  degree:       { ...FIELD.string },
  major:        { ...FIELD.string },
  start_date:   { ...FIELD.date },
  end_date:     { ...FIELD.date },
  gpa:          { ...FIELD.string },
  description:  { ...FIELD.semicolon_list },
}

export const EXPERIENCE_ITEM = {
  company:      { ...FIELD.string },
  position:     { ...FIELD.string },
  role:         { ...FIELD.string },
  start_date:   { ...FIELD.date },
  end_date:     { ...FIELD.date },
  description:  { ...FIELD.semicolon_list },
}

export const PROJECT_ITEM = {
  name:         { ...FIELD.string },
  role:         { ...FIELD.string },
  start_date:   { ...FIELD.date },
  end_date:     { ...FIELD.date },
  description:  { ...FIELD.semicolon_list },
  tech_stack:   { ...FIELD.comma_list },
}

export const MODULE_ITEM = {
  id:           { ...FIELD.string },
  name:         { ...FIELD.string },
  type:         { ...FIELD.string },  // 'builtin' | 'custom'
  enabled:      { ...FIELD.bool },
  content:      { ...FIELD.text },
}

// ── entity schemas — merge strategy per field ──

// merge: 'fill_empty' → only fill when existing is blank
// merge: 'union'      → combine and deduplicate (skills)
// merge: 'match_merge'→ arrays, match by merge_key, merge fields (fill empty), append new
// merge: 'overwrite'  → replace entirely
// merge: null / absent → skip (don't touch)

export const PROFILE_SCHEMA = {
  full_name:    { ...FIELD.string, merge: 'fill_empty' },
  gender:       { ...FIELD.string, merge: 'fill_empty' },
  age:          { ...FIELD.string, merge: 'fill_empty' },
  phone:        { ...FIELD.string, merge: 'fill_empty' },
  email:        { ...FIELD.string, merge: 'fill_empty' },
  wechat:       { ...FIELD.string, merge: 'fill_empty' },
  github:       { ...FIELD.string, merge: 'fill_empty' },
  location:     { ...FIELD.string, merge: 'fill_empty' },
  graduation:   { ...FIELD.date, merge: 'fill_empty' },
  target_role:  { ...FIELD.string, merge: 'fill_empty' },
  summary:      { ...FIELD.text, merge: 'fill_empty' },
  photo_path:   { ...FIELD.string, merge: null },
  skills:       { ...FIELD.comma_list, merge: 'union' },
  education:    { type: 'array', item_schema: EDUCATION_ITEM, merge: 'match_merge', merge_key: 'school' },
  experience:   { type: 'array', item_schema: EXPERIENCE_ITEM, merge: 'match_merge', merge_key: 'company' },
  projects:     { type: 'array', item_schema: PROJECT_ITEM, merge: 'match_merge', merge_key: 'name' },
  modules:      { type: 'array', item_schema: MODULE_ITEM, merge: null },  // merged separately via mergeModules
}

export const JOB_SCHEMA = {
  company:              { ...FIELD.string },
  title:                { ...FIELD.string },
  url:                  { ...FIELD.string },
  location:             { ...FIELD.string },
  salary:               { ...FIELD.string },
  enterprise_type:      { ...FIELD.string },
  job_level:            { ...FIELD.string },
  experience:           { ...FIELD.string },
  education:            { ...FIELD.string },
  tags:                 { ...FIELD.comma_list },
  description:          { ...FIELD.text },
  raw_text:             { ...FIELD.text },
  source:               { ...FIELD.string },
  source_type:          { ...FIELD.string },
  liveness_status:      { ...FIELD.string },
  liveness_reason:      { ...FIELD.string },
  discovered_at:        { ...FIELD.string },
  score:                { ...FIELD.number },
  score_reason:         { ...FIELD.text },
  recommendation:       { ...FIELD.string },
  match_highlights:     { type: 'array', item_schema: null },
  gaps:                 { type: 'array', item_schema: null },
  resume_strategy:      { type: 'array', item_schema: null },
}

export const COMPANY_SCHEMA = {
  name:               { ...FIELD.string, merge: 'overwrite' },
  aliases:            { ...FIELD.comma_list, merge: 'union' },
  industry_tags:      { ...FIELD.comma_list, merge: 'union' },
  official_homepage:  { ...FIELD.string, merge: 'fill_empty' },
  career_urls:        { type: 'array', item_schema: null, merge: 'union' },
  keywords:           { ...FIELD.comma_list, merge: 'union' },
  negative_keywords:  { ...FIELD.comma_list, merge: 'union' },
  locations:          { ...FIELD.comma_list, merge: 'union' },
  enabled:            { ...FIELD.bool },
  notes:              { ...FIELD.text, merge: 'fill_empty' },
}

// ── helper: check if merge should apply to a list-type field ──

export function isListField(field) {
  return field.type === 'comma_list' || field.type === 'semicolon_list'
}
