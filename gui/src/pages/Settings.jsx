import { useState, useEffect } from 'react'
import { Gear, Trash } from '@phosphor-icons/react'
import { aiAPI } from '../api'
import { showToast } from '../utils/toast'
import { PageTransition, LiquidSectionHeader, LiquidCard, MagneticButton } from '../components/LiquidMotion'
import '../styles/liquid-motion.css'

export default function Settings({ onToast }) {
  const [aiSettings, setAiSettings] = useState(null)
  const [aiForm, setAiForm] = useState({
    deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
    doubao: { apiKey: '', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-1-6-251015' }
  })
  const [isSavingAi, setIsSavingAi] = useState(false)
  const [clearingProvider, setClearingProvider] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    fetchAiSettings()
  }, [])

  const fetchAiSettings = async () => {
    try {
      const res = await aiAPI.getSettings()
      setAiSettings(res.data)
      setAiForm(prev => ({
        deepseek: {
          ...prev.deepseek,
          baseUrl: res.data.deepseek?.baseUrl || prev.deepseek.baseUrl,
          model: res.data.deepseek?.model || prev.deepseek.model
        },
        doubao: {
          ...prev.doubao,
          baseUrl: res.data.doubao?.baseUrl || prev.doubao.baseUrl,
          model: res.data.doubao?.model || prev.doubao.model
        }
      }))
    } catch (error) {
      console.error('AI settings fetch error:', error)
      showToast(onToast, '加载 AI 配置失败', 'error')
    }
  }

  const updateAiForm = (provider, field, value) => {
    setAiForm(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value
      }
    }))
  }

  const saveAiSettings = async () => {
    setIsSavingAi(true)
    try {
      const payload = {
        deepseek: {
          ...aiForm.deepseek,
          apiKey: aiForm.deepseek.apiKey.trim()
        },
        doubao: {
          ...aiForm.doubao,
          apiKey: aiForm.doubao.apiKey.trim()
        }
      }
      const res = await aiAPI.saveSettings(payload)
      setAiSettings(res.data)
      setAiForm(prev => ({
        deepseek: { ...prev.deepseek, apiKey: '' },
        doubao: { ...prev.doubao, apiKey: '' }
      }))
      showToast(onToast, 'AI API 配置已保存到本地 .env', 'success')
    } catch (error) {
      showToast(onToast, `保存失败：${error.message}`, 'error')
    } finally {
      setIsSavingAi(false)
    }
  }

  const clearAiSettings = async (provider) => {
    const providerLabel = provider === 'deepseek' ? 'DeepSeek' : '豆包 / 火山方舟'
    if (!window.confirm(`确定要清除 ${providerLabel} 已保存的 API Key 吗？`)) return

    setClearingProvider(provider)
    try {
      const res = await aiAPI.clearSettings(provider)
      setAiSettings(res.data)
      setAiForm(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          apiKey: ''
        }
      }))
      showToast(onToast, `${providerLabel} API Key 已清除`, 'success')
    } catch (error) {
      showToast(onToast, `清除失败：${error.message}`, 'error')
    } finally {
      setClearingProvider('')
    }
  }

  const handleReset = async () => {
    if (!window.confirm('确定要初始化系统吗？\n\n将清除：\n• 所有个人简历数据\n• API Key 配置\n• 公司列表、职位记录\n• 求职追踪、面试准备\n• 生成的 PDF 和报告\n\n此操作不可撤销！')) return
    if (!window.confirm('再次确认：初始化后所有数据将恢复为默认状态，确定继续？')) return

    setIsResetting(true)
    try {
      await aiAPI.resetSystem()
      localStorage.removeItem('interviewPrepCache')
      localStorage.removeItem('resumeFiles')
      await fetchAiSettings()
      showToast(onToast, '系统已初始化，所有数据已恢复为默认状态', 'success')
    } catch (error) {
      showToast(onToast, `初始化失败：${error.message}`, 'error')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <PageTransition>
      <LiquidSectionHeader title="设置" subtitle="AI API 配置管理" icon={Gear} />

      <LiquidCard delay={0}>
        <div className="card-header">
          <div>
            <div className="card-title">AI API 评分配置</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              API Key 会保存到本机项目 .env 文件。留空 Key 时只更新模型和地址，不会清空已有 Key；如需删除，请使用清除按钮。
            </p>
          </div>
          <MagneticButton variant="primary" className="btn-sm" onClick={saveAiSettings} disabled={isSavingAi}>
            <Gear style={{ width: '14px', height: '14px', marginRight: '6px' }} />
            {isSavingAi ? '保存中...' : '保存 AI 配置'}
          </MagneticButton>
        </div>

        <div className="provider-grid">
          <div className="provider-card">
            <div className="provider-title">
              <strong>DeepSeek</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`status-badge ${aiSettings?.deepseek?.configured ? 'status-active' : 'status-unconfirmed'}`}>
                  {aiSettings?.deepseek?.configured ? `已配置 ${aiSettings.deepseek.apiKeyMasked}` : '未配置'}
                </span>
                <MagneticButton
                  variant="secondary"
                  className="btn-sm"
                  onClick={() => clearAiSettings('deepseek')}
                  disabled={!aiSettings?.deepseek?.configured || clearingProvider === 'deepseek' || isSavingAi}
                >
                  {clearingProvider === 'deepseek' ? '清除中...' : '清除'}
                </MagneticButton>
              </div>
            </div>
            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                className="form-control"
                value={aiForm.deepseek.apiKey}
                onChange={(e) => updateAiForm('deepseek', 'apiKey', e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label>Base URL</label>
              <input
                className="form-control"
                value={aiForm.deepseek.baseUrl}
                onChange={(e) => updateAiForm('deepseek', 'baseUrl', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>模型</label>
              <input
                className="form-control"
                value={aiForm.deepseek.model}
                onChange={(e) => updateAiForm('deepseek', 'model', e.target.value)}
              />
            </div>
          </div>

          <div className="provider-card">
            <div className="provider-title">
              <strong>豆包 / 火山方舟</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`status-badge ${aiSettings?.doubao?.configured ? 'status-active' : 'status-unconfirmed'}`}>
                  {aiSettings?.doubao?.configured ? `已配置 ${aiSettings.doubao.apiKeyMasked}` : '未配置'}
                </span>
                <MagneticButton
                  variant="secondary"
                  className="btn-sm"
                  onClick={() => clearAiSettings('doubao')}
                  disabled={!aiSettings?.doubao?.configured || clearingProvider === 'doubao' || isSavingAi}
                >
                  {clearingProvider === 'doubao' ? '清除中...' : '清除'}
                </MagneticButton>
              </div>
            </div>
            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                className="form-control"
                value={aiForm.doubao.apiKey}
                onChange={(e) => updateAiForm('doubao', 'apiKey', e.target.value)}
                placeholder="火山方舟 API Key"
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label>Base URL</label>
              <input
                className="form-control"
                value={aiForm.doubao.baseUrl}
                onChange={(e) => updateAiForm('doubao', 'baseUrl', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>模型 / Endpoint ID</label>
              <input
                className="form-control"
                value={aiForm.doubao.model}
                onChange={(e) => updateAiForm('doubao', 'model', e.target.value)}
              />
            </div>
          </div>
        </div>
      </LiquidCard>

      <LiquidCard delay={0.08}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ color: '#ef4444' }}>系统初始化</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              清除所有个人数据（简历、公司、职位、追踪记录）、API Key 配置和生成文件，恢复为初始状态。不影响应用功能。
            </p>
          </div>
          <MagneticButton
            variant="secondary"
            className="btn-sm"
            onClick={handleReset}
            disabled={isResetting}
            style={{ borderColor: '#ef4444', color: '#ef4444' }}
          >
            <Trash style={{ width: '14px', height: '14px', marginRight: '6px' }} />
            {isResetting ? '重置中...' : '初始化系统'}
          </MagneticButton>
        </div>
      </LiquidCard>
    </PageTransition>
  )
}
