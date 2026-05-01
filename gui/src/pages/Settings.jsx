import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Activity, CheckCircle, AlertCircle, Clock, Terminal } from 'lucide-react'
import { aiAPI, healthAPI } from '../api'
import { showToast } from '../utils/toast'

export default function Settings({ onToast }) {
  const [healthStatus, setHealthStatus] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [commandOutput, setCommandOutput] = useState('')
  const [aiSettings, setAiSettings] = useState(null)
  const [aiForm, setAiForm] = useState({
    deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-pro' },
    doubao: { apiKey: '', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-1-6-251015' }
  })
  const [isSavingAi, setIsSavingAi] = useState(false)
  const [clearingProvider, setClearingProvider] = useState('')

  useEffect(() => {
    fetchHealth()
    fetchAiSettings()
  }, [])

  const fetchHealth = async () => {
    try {
      const res = await healthAPI.check()
      setHealthStatus(res.data)
    } catch (error) {
      console.error('Settings fetch health error:', error)
      showToast(onToast, '加载健康状态失败', 'error')
    }
  }

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

  const runDoctor = async () => {
    setIsRunning(true)
    setCommandOutput('')
    try {
      const res = await healthAPI.doctor()
      setHealthStatus(res.data.checks)
      setCommandOutput(res.data.output || 'Doctor check completed\n')
      showToast(onToast, '健康检查完成，缺失依赖已尝试自动安装', 'success')
    } catch (error) {
      setCommandOutput(`Error: ${error.message}\n`)
      showToast(onToast, '健康检查失败', 'error')
    } finally {
      setIsRunning(false)
    }
  }

  const runVerify = async () => {
    setIsRunning(true)
    setCommandOutput('')
    try {
      const res = await healthAPI.verify()
      setCommandOutput(res.data.output || 'Verification completed\n')
      showToast(onToast, '验证完成', 'success')
    } catch (error) {
      setCommandOutput(`Error: ${error.message}\n`)
      showToast(onToast, '验证失败', 'error')
    } finally {
      setIsRunning(false)
    }
  }

  const runSync = async () => {
    setIsRunning(true)
    setCommandOutput('')
    try {
      const res = await healthAPI.syncCheck()
      setCommandOutput(res.data.output || 'Sync check completed\n')
      showToast(onToast, '同步检查完成', 'success')
    } catch (error) {
      setCommandOutput(`Error: ${error.message}\n`)
      showToast(onToast, '同步检查失败', 'error')
    } finally {
      setIsRunning(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass': return <CheckCircle style={{ color: 'var(--success-color)', width: '20px', height: '20px' }} />
      case 'warn': return <AlertCircle style={{ color: 'var(--warning-color)', width: '20px', height: '20px' }} />
      case 'fail': return <AlertCircle style={{ color: 'var(--danger-color)', width: '20px', height: '20px' }} />
      default: return <Activity style={{ color: 'var(--text-secondary)', width: '20px', height: '20px' }} />
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>设置</h2>
        <p>系统健康检查和配置</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">系统健康状态</div>
          <button className="btn btn-primary btn-sm" onClick={runDoctor} disabled={isRunning}>
            <Activity style={{ width: '14px', height: '14px', marginRight: '6px' }} />
            运行检查并安装依赖
          </button>
        </div>
        {healthStatus && (
          <table className="table">
            <thead>
              <tr>
                <th>检查项</th>
                <th>状态</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(healthStatus).map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{getStatusIcon(value.status)}</td>
                  <td>{value.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">AI API 评分配置</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              API Key 会保存到本机项目 .env 文件。留空 Key 时只更新模型和地址，不会清空已有 Key；如需删除，请使用清除按钮。
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveAiSettings} disabled={isSavingAi}>
            <SettingsIcon style={{ width: '14px', height: '14px', marginRight: '6px' }} />
            {isSavingAi ? '保存中...' : '保存 AI 配置'}
          </button>
        </div>

        <div className="provider-grid">
          <div className="provider-card">
            <div className="provider-title">
              <strong>DeepSeek</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`status-badge ${aiSettings?.deepseek?.configured ? 'status-active' : 'status-unconfirmed'}`}>
                  {aiSettings?.deepseek?.configured ? `已配置 ${aiSettings.deepseek.apiKeyMasked}` : '未配置'}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => clearAiSettings('deepseek')}
                  disabled={!aiSettings?.deepseek?.configured || clearingProvider === 'deepseek' || isSavingAi}
                >
                  {clearingProvider === 'deepseek' ? '清除中...' : '清除'}
                </button>
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
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => clearAiSettings('doubao')}
                  disabled={!aiSettings?.doubao?.configured || clearingProvider === 'doubao' || isSavingAi}
                >
                  {clearingProvider === 'doubao' ? '清除中...' : '清除'}
                </button>
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
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">工具命令</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', padding: '0 24px 24px' }}>
          <button className="btn btn-secondary" onClick={runVerify} disabled={isRunning}>
            <Terminal style={{ width: '14px', height: '14px', marginRight: '8px' }} />
            验证配置
          </button>
          <button className="btn btn-secondary" onClick={runSync} disabled={isRunning}>
            <Clock style={{ width: '14px', height: '14px', marginRight: '8px' }} />
            同步检查
          </button>
        </div>
      </div>

      {commandOutput && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">命令输出</div>
          </div>
          <pre className="command-output">{commandOutput}</pre>
        </div>
      )}
    </>
  )
}
