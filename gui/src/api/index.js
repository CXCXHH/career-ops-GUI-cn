import axios from 'axios'

const API_BASE = '/api'

axios.defaults.timeout = 180000

const unwrap = (request) => request.then((response) => {
  const payload = response.data
  if (payload && typeof payload === 'object' && 'success' in payload) {
    if (!payload.success) {
      throw new Error(payload.error || '请求失败')
    }
    return { ...response, data: payload.data, meta: payload.meta }
  }
  return response
})

export const healthAPI = {
  check: () => unwrap(axios.get(`${API_BASE}/health`)),
  doctor: () => unwrap(axios.post(`${API_BASE}/health/doctor`)),
  verify: () => unwrap(axios.post(`${API_BASE}/health/verify`)),
  syncCheck: () => unwrap(axios.post(`${API_BASE}/health/sync-check`))
}

export const companiesAPI = {
  getAll: () => unwrap(axios.get(`${API_BASE}/companies`)),
  create: (data) => unwrap(axios.post(`${API_BASE}/companies`, data)),
  update: (id, data) => unwrap(axios.patch(`${API_BASE}/companies/${id}`, data)),
  delete: (id) => unwrap(axios.delete(`${API_BASE}/companies/${id}`)),
  batchDelete: (ids) => unwrap(axios.post(`${API_BASE}/companies/batch-delete`, { ids }))
}

export const jobsAPI = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([_, v]) => v != null && v !== '')).toString()
    return unwrap(axios.get(`${API_BASE}/jobs${qs ? `?${qs}` : ''}`))
  },
  getDetail: (id) => unwrap(axios.get(`${API_BASE}/jobs/${id}`)),
  update: (id, data) => unwrap(axios.patch(`${API_BASE}/jobs/${id}`, data)),
  batchAdd: (jobs) => unwrap(axios.post(`${API_BASE}/jobs/batch-add`, { jobs })),
  batchDelete: (ids) => unwrap(axios.post(`${API_BASE}/jobs/batch-delete`, { ids })),
  batchOptimizeJd: (ids, provider) => unwrap(axios.post(`${API_BASE}/jobs/batch-optimize-jd`, { ids, provider })),
  importUrl: (url) => unwrap(axios.post(`${API_BASE}/jobs/import-url`, { url })),
  extract: (id) => unwrap(axios.post(`${API_BASE}/jobs/${id}/extract`)),
  optimizeJd: (id, provider) => unwrap(axios.post(`${API_BASE}/jobs/${id}/optimize-jd`, { provider })),
  liveness: (id) => unwrap(axios.post(`${API_BASE}/jobs/${id}/liveness`)),
  evaluate: (id, provider) => unwrap(axios.post(`${API_BASE}/jobs/${id}/evaluate`, { provider })),
  delete: (id) => unwrap(axios.delete(`${API_BASE}/jobs/${id}`)),
  validate: () => unwrap(axios.post(`${API_BASE}/jobs/validate`)),
  getEvaluation: (id) => unwrap(axios.get(`${API_BASE}/jobs/${id}/evaluation`)),
  generatePdf: (id, provider) => unwrap(axios.post(`${API_BASE}/jobs/${id}/resume/pdf`, { provider })),
  getResumeFiles: (id) => unwrap(axios.get(`${API_BASE}/jobs/${id}/resume/files`)),
  addToTracker: (id) => unwrap(axios.post(`${API_BASE}/jobs/${id}/tracker-addition`))
}

export const aiAPI = {
  getProviders: () => unwrap(axios.get(`${API_BASE}/ai/providers`)),
  getSettings: () => unwrap(axios.get(`${API_BASE}/ai/settings`)),
  saveSettings: (data) => unwrap(axios.post(`${API_BASE}/ai/settings`, data)),
  clearSettings: (provider) => unwrap(axios.delete(`${API_BASE}/ai/settings/${provider}`))
}

export const resumeAPI = {
  getProfile: () => unwrap(axios.get(`${API_BASE}/resume/profile`)),
  saveProfile: (data) => unwrap(axios.post(`${API_BASE}/resume/profile`, data)),
  getFiles: () => unwrap(axios.get(`${API_BASE}/resume/files`)),
  deletePhoto: () => unwrap(axios.delete(`${API_BASE}/resume/photo`)),
  getModules: () => unwrap(axios.get(`${API_BASE}/resume/modules`)),
  addModule: (data) => unwrap(axios.post(`${API_BASE}/resume/modules`, data)),
  updateModules: (modules) => unwrap(axios.put(`${API_BASE}/resume/modules`, modules)),
  updateModule: (id, data) => unwrap(axios.patch(`${API_BASE}/resume/modules/${id}`, data)),
  saveModuleData: (id, data) => unwrap(axios.patch(`${API_BASE}/resume/modules/${id}/data`, data)),
  deleteModule: (id) => unwrap(axios.delete(`${API_BASE}/resume/modules/${id}`)),
  deleteFile: (path) => unwrap(axios.delete(`${API_BASE}/resume/delete-file`, { data: { path } })),
  generate: (params) => unwrap(axios.post(`${API_BASE}/resume/generate`, params)),
  getVersions: () => unwrap(axios.get(`${API_BASE}/resume/files`)),
  getVersion: (id) => unwrap(axios.get(`${API_BASE}/resume/files/${id}`)),
  deleteVersion: (id) => unwrap(axios.delete(`${API_BASE}/resume/files/${id}`)),
  deleteAllVersions: () => unwrap(axios.delete(`${API_BASE}/resume/files`)),
  autoFill: (data) => unwrap(axios.post(`${API_BASE}/resume/auto-fill`, data)),
  bulkImport: (data) => unwrap(axios.post(`${API_BASE}/resume/bulk-import`, data))
}

export const discoveryAPI = {
  run: (companyId, keywords) => unwrap(axios.post(`${API_BASE}/discovery/run`, { companyId, keywords })),
  scan: (companyId, keywords) => unwrap(axios.post(`${API_BASE}/discovery/run`, { companyId, keywords })),
  search: (params) => unwrap(axios.post(`${API_BASE}/discovery/search`, params)),
  aiSearch: (params) => unwrap(axios.post(`${API_BASE}/discovery/ai-search`, params)),
  importJson: (jsonData) => unwrap(axios.post(`${API_BASE}/discovery/import-json`, { jsonData })),
  getRuns: () => unwrap(axios.get(`${API_BASE}/discovery/runs`))
}

export const trackerAPI = {
  getAll: () => unwrap(axios.get(`${API_BASE}/tracker`)),
  updateStatus: (rowId, status) => unwrap(axios.patch(`${API_BASE}/tracker/${rowId}/status`, { status })),
  updateNotes: (rowId, notes) => unwrap(axios.patch(`${API_BASE}/tracker/${rowId}/notes`, { notes })),
  delete: (rowId) => unwrap(axios.delete(`${API_BASE}/tracker/${rowId}`))
}

export const interviewPrepAPI = {
  generate: (jobId, provider) => unwrap(axios.post(`${API_BASE}/jobs/${jobId}/interview-prep`, { provider }, { timeout: 360000 })),
  get: (jobId) => unwrap(axios.get(`${API_BASE}/interview-prep/${jobId}`))
}

export const followupsAPI = {
  refresh: () => unwrap(axios.post(`${API_BASE}/followups/refresh`)),
  getAll: () => unwrap(axios.get(`${API_BASE}/followups`)),
  markSent: (id) => unwrap(axios.post(`${API_BASE}/followups/${id}/mark-sent`)),
  sendMessage: (id, message = '') => unwrap(axios.post(`${API_BASE}/followups/${id}/send-message`, { message }))
}
