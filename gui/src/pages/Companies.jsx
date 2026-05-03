import { useState, useEffect } from 'react'
import { Plus, PencilSimple, Trash, MagnifyingGlass, Buildings, Globe, Tag, MapPin, CheckSquare, Square, Warning, X, Spinner } from '@phosphor-icons/react'
import { companiesAPI } from '../api'
import { PageTransition, LiquidSectionHeader, LiquidCard, MagneticButton } from '../components/LiquidMotion'

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
    const allSelected = filteredCompanies.length > 0 && filteredCompanies.every(c => selectedIds.has(c.id))
    if (allSelected) {
      const newSelected = new Set(selectedIds)
      filteredCompanies.forEach(c => newSelected.delete(c.id))
      setSelectedIds(newSelected)
    } else {
      const newSelected = new Set(selectedIds)
      filteredCompanies.forEach(c => newSelected.add(c.id))
      setSelectedIds(newSelected)
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
      <PageTransition>
        <LiquidSectionHeader title="公司库" subtitle="管理搜索自动发现和手动添加的公司" icon={Buildings} />
        <div className="liquid-empty">
          <div className="liquid-spinner" style={{ margin: '0 auto 20px' }}></div>
          <p>加载中...</p>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <LiquidSectionHeader title="公司库" subtitle="管理搜索自动发现和手动添加的公司" icon={Buildings} />

      <LiquidCard>
        <div className="card-header">
          <div className="liquid-search">
            <MagnifyingGlass size={18} />
            <input
              type="text"
              placeholder="搜索公司..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {selectedIds.size > 0 && (
              <MagneticButton
                variant="primary"
                className="btn-sm"
                onClick={() => setShowConfirmModal(true)}
              >
                <Trash size={16} />
                批量删除 ({selectedIds.size})
              </MagneticButton>
            )}
            <MagneticButton variant="primary" className="btn-sm" onClick={handleAdd}>
              <Plus size={16} />
              添加公司
            </MagneticButton>
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
                    <CheckSquare size={18} weight="fill" style={{ color: 'var(--primary-color)' }} />
                  ) : (
                    <Square size={18} style={{ color: 'var(--text-muted)' }} />
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
                className={`liquid-table-row ${selectedIds.has(company.id) ? 'selected-row' : ''}`}
              >
                <td>
                  <button
                    className="btn btn-link p-0"
                    onClick={() => handleSelectOne(company.id)}
                  >
                    {selectedIds.has(company.id) ? (
                      <CheckSquare size={16} weight="fill" style={{ color: 'var(--primary-color)' }} />
                    ) : (
                      <Square size={16} style={{ color: 'var(--border-light)' }} />
                    )}
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Buildings size={18} weight="duotone" style={{ marginRight: '8px', color: 'var(--primary-color)' }} />
                    {company.name}
                  </div>
                </td>
                <td>
                  {company.industry_tags && company.industry_tags.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {company.industry_tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="liquid-tag">{tag}</span>
                      ))}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  {company.locations && company.locations.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <MapPin size={14} style={{ marginRight: '4px', color: 'var(--text-secondary)' }} />
                      {company.locations.join(', ')}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  <span className={`liquid-status ${company.enabled ? '' : ''}`} style={company.enabled ? { color: 'var(--success-color)', background: 'var(--success-tint)' } : { color: 'var(--danger-color)', background: 'var(--danger-tint)' }}>
                    {company.enabled ? '启用' : '禁用'}
                  </span>
                </td>
                <td>
                  <MagneticButton variant="secondary" className="btn-sm" onClick={() => handleEdit(company)}>
                    <PencilSimple size={14} />
                  </MagneticButton>
                  <MagneticButton variant="primary" className="btn-sm" onClick={() => handleDelete(company.id)}>
                    <Trash size={14} />
                  </MagneticButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredCompanies.length === 0 && (
          <div className="liquid-empty">
            <Buildings size={64} weight="duotone" />
            <p>暂无公司数据</p>
          </div>
        )}
      </LiquidCard>

      {showModal && (
        <div className="liquid-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="liquid-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCompany ? '编辑公司' : '添加公司'}</h3>
              <button className="btn btn-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>公司名称</label>
                <input
                  type="text"
                  className="form-control liquid-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>行业标签</label>
                <input
                  type="text"
                  className="form-control liquid-input"
                  placeholder="用逗号分隔"
                  value={formData.industry_tags.join(', ')}
                  onChange={(e) => setFormData({ ...formData, industry_tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </div>
              <div className="form-group">
                <label>地点</label>
                <input
                  type="text"
                  className="form-control liquid-input"
                  placeholder="用逗号分隔"
                  value={formData.locations.join(', ')}
                  onChange={(e) => setFormData({ ...formData, locations: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </div>
              <div className="form-group">
                <label>官网</label>
                <input
                  type="url"
                  className="form-control liquid-input"
                  value={formData.official_homepage}
                  onChange={(e) => setFormData({ ...formData, official_homepage: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>招聘页面 URL</label>
                <input
                  type="text"
                  className="form-control liquid-input"
                  placeholder="用逗号分隔"
                  value={formData.career_urls.join(', ')}
                  onChange={(e) => setFormData({ ...formData, career_urls: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </div>
              <div className="form-group">
                <label>搜索关键词</label>
                <input
                  type="text"
                  className="form-control liquid-input"
                  placeholder="用逗号分隔"
                  value={formData.keywords.join(', ')}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </div>
              <div className="form-group">
                <label>备注</label>
                <textarea
                  className="form-control liquid-input"
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  />
                  启用
                </label>
              </div>
              <div className="modal-footer">
                <MagneticButton variant="secondary" onClick={() => setShowModal(false)}>取消</MagneticButton>
                <MagneticButton variant="primary" onClick={handleSubmit}>保存</MagneticButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="liquid-modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="liquid-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Warning size={24} weight="fill" style={{ color: 'var(--warning-color)' }} />
                <h3>确认批量删除</h3>
              </div>
              <button className="btn btn-close" onClick={() => setShowConfirmModal(false)}>×</button>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ marginBottom: '12px' }}>
                您即将删除 <strong>{selectedIds.size}</strong> 家公司。此操作将把这些公司标记为已删除，且无法撤销。
              </p>
              <p style={{ color: 'var(--danger-color)', fontSize: '13px' }}>
                删除后，这些公司将从公司库中移除，并防止后续重新被自动发现。
              </p>
            </div>
            <div className="modal-footer">
              <MagneticButton variant="secondary" onClick={() => setShowConfirmModal(false)}>取消</MagneticButton>
              <MagneticButton
                variant="primary"
                onClick={handleBatchDelete}
              >
                {isBatchDeleting ? (
                  <>
                    <Spinner size={14} className="liquid-spinner" style={{ marginRight: '6px' }} />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash size={14} style={{ marginRight: '6px' }} />
                    确认删除
                  </>
                )}
              </MagneticButton>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  )
}
