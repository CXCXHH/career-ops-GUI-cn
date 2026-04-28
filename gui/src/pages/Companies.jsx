import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Search, Building2, Globe, Tag, MapPin, CheckSquare, Square, AlertTriangle, X, Loader2 } from 'lucide-react'
import { companiesAPI } from '../api'

export default function Companies({ onToast }) {
  const [companies, setCompanies] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    aliases: [],
    industry_tags: [],
    official_homepage: '',
    career_urls: [],
    domains: [],
    source_type: 'official_html',
    keywords: [],
    negative_keywords: [],
    locations: [],
    enabled: true,
    notes: ''
  })
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    setIsLoading(true)
    try {
      const res = await companiesAPI.getAll()
      setCompanies(res.data || [])
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Companies fetch error:', error)
      if (onToast) onToast('加载公司数据失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingCompany) {
        await companiesAPI.update(editingCompany.id, formData)
        if (onToast) onToast('公司信息已更新', 'success')
      } else {
        await companiesAPI.create(formData)
        if (onToast) onToast('公司已添加', 'success')
      }
      setShowModal(false)
      setEditingCompany(null)
      setFormData({
        name: '',
        aliases: [],
        industry_tags: [],
        official_homepage: '',
        career_urls: [],
        domains: [],
        source_type: 'official_html',
        keywords: [],
        negative_keywords: [],
        locations: [],
        enabled: true,
        notes: ''
      })
      fetchCompanies()
    } catch (error) {
      if (onToast) onToast('操作失败', 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这家公司吗？')) return
    try {
      await companiesAPI.delete(id)
      if (onToast) onToast('公司已删除', 'success')
      fetchCompanies()
    } catch (error) {
      if (onToast) onToast(`删除失败：${error.message}`, 'error')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    setIsBatchDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      await companiesAPI.batchDelete(ids)
      if (onToast) onToast(`成功删除 ${ids.length} 家公司`, 'success')
      setSelectedIds(new Set())
      fetchCompanies()
    } catch (error) {
      if (onToast) onToast(`批量删除失败：${error.message}`, 'error')
    } finally {
      setIsBatchDeleting(false)
      setShowConfirmModal(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCompanies.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredCompanies.map(c => c.id)))
    }
  }

  const handleSelectOne = (id) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleEdit = (company) => {
    setEditingCompany(company)
    setFormData({
      name: company.name || '',
      aliases: company.aliases || [],
      industry_tags: company.industry_tags || [],
      official_homepage: company.official_homepage || '',
      career_urls: company.career_urls || [],
      domains: company.domains || [],
      source_type: company.source_type || 'official_html',
      keywords: company.keywords || [],
      negative_keywords: company.negative_keywords || [],
      locations: company.locations || [],
      enabled: company.enabled !== undefined ? company.enabled : true,
      notes: company.notes || ''
    })
    setShowModal(true)
  }

  const handleAdd = () => {
    setEditingCompany(null)
    setFormData({
      name: '',
      aliases: [],
      industry_tags: [],
      official_homepage: '',
      career_urls: [],
      domains: [],
      source_type: 'official_html',
      keywords: [],
      negative_keywords: [],
      locations: [],
      enabled: true,
      notes: ''
    })
    setShowModal(true)
  }

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="page-header">
        <h2>公司库</h2>
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto' }}></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <h2>公司库</h2>
        <p>管理搜索自动发现和手动添加的公司</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-box">
            <Search style={{ width: '16px', height: '16px', marginRight: '8px' }} />
            <input 
              type="text" 
              placeholder="搜索公司..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {selectedIds.size > 0 && (
              <button 
                className="btn btn-danger" 
                onClick={() => setShowConfirmModal(true)}
                disabled={isBatchDeleting}
              >
                {isBatchDeleting ? (
                  <>
                    <Loader2 style={{ width: '16px', height: '16px', marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                    批量删除 ({selectedIds.size})
                  </>
                )}
              </button>
            )}
            <button className="btn btn-primary" onClick={handleAdd}>
              <Plus style={{ width: '16px', height: '16px', marginRight: '8px' }} />
              添加公司
            </button>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <button 
                  className="btn btn-link p-0" 
                  onClick={handleSelectAll}
                  disabled={filteredCompanies.length === 0}
                >
                  {selectedIds.size === filteredCompanies.length && filteredCompanies.length > 0 ? (
                    <CheckSquare style={{ width: '18px', height: '18px', color: '#2563eb' }} />
                  ) : (
                    <Square style={{ width: '18px', height: '18px', color: '#94a3b8' }} />
                  )}
                </button>
              </th>
              <th>公司名称</th>
              <th>行业标签</th>
              <th>地点</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredCompanies.map((company) => (
              <tr 
                key={company.id} 
                className={selectedIds.has(company.id) ? 'selected-row' : ''}
              >
                <td>
                  <button 
                    className="btn btn-link p-0" 
                    onClick={() => handleSelectOne(company.id)}
                  >
                    {selectedIds.has(company.id) ? (
                      <CheckSquare style={{ width: '16px', height: '16px', color: '#2563eb' }} />
                    ) : (
                      <Square style={{ width: '16px', height: '16px', color: '#cbd5e1' }} />
                    )}
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Building2 style={{ width: '18px', height: '18px', marginRight: '8px', color: '#2563eb' }} />
                    {company.name}
                  </div>
                </td>
                <td>
                  {company.industry_tags && company.industry_tags.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {company.industry_tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="tag">{tag}</span>
                      ))}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  {company.locations && company.locations.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <MapPin style={{ width: '14px', height: '14px', marginRight: '4px', color: '#64748b' }} />
                      {company.locations.join(', ')}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  <span className={`status-badge ${company.enabled ? 'status-active' : 'status-closed'}`}>
                    {company.enabled ? '启用' : '禁用'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(company)}>
                    <Edit2 style={{ width: '14px', height: '14px' }} />
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(company.id)}>
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredCompanies.length === 0 && (
          <div className="empty-state">
            <Building2 />
            <p>暂无公司数据</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCompany ? '编辑公司' : '添加公司'}</h3>
              <button className="btn btn-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>公司名称</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>行业标签</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="用逗号分隔"
                  value={formData.industry_tags.join(', ')}
                  onChange={(e) => setFormData({...formData, industry_tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                />
              </div>
              <div className="form-group">
                <label>地点</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="用逗号分隔"
                  value={formData.locations.join(', ')}
                  onChange={(e) => setFormData({...formData, locations: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                />
              </div>
              <div className="form-group">
                <label>官网</label>
                <input 
                  type="url" 
                  className="form-control" 
                  value={formData.official_homepage}
                  onChange={(e) => setFormData({...formData, official_homepage: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>招聘页面 URL</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="用逗号分隔"
                  value={formData.career_urls.join(', ')}
                  onChange={(e) => setFormData({...formData, career_urls: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                />
              </div>
              <div className="form-group">
                <label>搜索关键词</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="用逗号分隔"
                  value={formData.keywords.join(', ')}
                  onChange={(e) => setFormData({...formData, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                />
              </div>
              <div className="form-group">
                <label>备注</label>
                <textarea 
                  className="form-control" 
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={formData.enabled}
                    onChange={(e) => setFormData({...formData, enabled: e.target.checked})}
                  />
                  启用
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertTriangle style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
                <h3>确认批量删除</h3>
              </div>
              <button className="btn btn-close" onClick={() => setShowConfirmModal(false)}>×</button>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ marginBottom: '12px' }}>
                您即将删除 <strong>{selectedIds.size}</strong> 家公司。此操作将把这些公司标记为已删除，且无法撤销。
              </p>
              <p style={{ color: '#dc2626', fontSize: '13px' }}>
                删除后，这些公司将从公司库中移除，并防止后续重新被自动发现。
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>取消</button>
              <button 
                className="btn btn-danger" 
                onClick={handleBatchDelete}
                disabled={isBatchDeleting}
              >
                {isBatchDeleting ? (
                  <>
                    <Loader2 style={{ width: '14px', height: '14px', marginRight: '6px', animation: 'spin 1s linear infinite' }} />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                    确认删除
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}