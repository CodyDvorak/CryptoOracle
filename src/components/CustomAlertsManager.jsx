import React, { useState, useEffect } from 'react'
import { Bell, Plus, CreditCard as Edit, Trash2, X } from 'lucide-react'
import { API_ENDPOINTS, getHeaders } from '../config/api'
import './CustomAlertsManager.css'

export default function CustomAlertsManager({ userId }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAlert, setEditingAlert] = useState(null)
  const [formData, setFormData] = useState({
    alert_type: 'PRICE',
    coin_symbol: 'BTC',
    condition: {},
    notification_method: 'EMAIL',
    is_active: true
  })

  useEffect(() => {
    if (userId) {
      fetchAlerts()
    }
  }, [userId])

  const fetchAlerts = async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.customAlerts}?action=list`, {
        headers: getHeaders(),
      })
      const data = await response.json()
      setAlerts(data.alerts || [])
    } catch (err) {
      console.error('Failed to fetch alerts:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingAlert(null)
    setFormData({
      alert_type: 'PRICE',
      coin_symbol: 'BTC',
      condition: {},
      notification_method: 'EMAIL',
      is_active: true
    })
    setShowModal(true)
  }

  const handleEdit = (alert) => {
    setEditingAlert(alert)
    setFormData({
      alert_type: alert.alert_type,
      coin_symbol: alert.coin_symbol || 'BTC',
      bot_name: alert.bot_name || '',
      condition: alert.condition || {},
      notification_method: alert.notification_method,
      is_active: alert.is_active
    })
    setShowModal(true)
  }

  const handleDelete = async (alertId) => {
    if (!confirm('Are you sure you want to delete this alert?')) return

    try {
      await fetch(`${API_ENDPOINTS.customAlerts}?action=delete&alertId=${alertId}`, {
        method: 'POST',
        headers: getHeaders(),
      })
      setAlerts(alerts.filter(a => a.id !== alertId))
    } catch (err) {
      console.error('Failed to delete alert:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const alertData = {
      ...formData,
      condition: buildCondition()
    }

    try {
      const action = editingAlert ? 'update' : 'create'
      const body = editingAlert ? { ...alertData, id: editingAlert.id } : alertData

      const response = await fetch(`${API_ENDPOINTS.customAlerts}?action=${action}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (editingAlert) {
        setAlerts(alerts.map(a => a.id === editingAlert.id ? data.alert : a))
      } else {
        setAlerts([data.alert, ...alerts])
      }

      setShowModal(false)
    } catch (err) {
      console.error('Failed to save alert:', err)
    }
  }

  const buildCondition = () => {
    switch (formData.alert_type) {
      case 'PRICE':
        return {
          target_price: parseFloat(formData.target_price || 0),
          direction: formData.direction || 'ABOVE'
        }
      case 'SIGNAL':
        return {
          min_confidence: parseFloat(formData.min_confidence || 0.85),
          direction: formData.signal_direction || 'LONG'
        }
      case 'BOT':
        return {
          bot_name: formData.bot_name
        }
      case 'REGIME':
        return {
          regime: formData.regime || 'BULL'
        }
      default:
        return {}
    }
  }

  const getAlertTypeIcon = (type) => {
    return <Bell size={16} />
  }

  const getAlertDescription = (alert) => {
    switch (alert.alert_type) {
      case 'PRICE':
        return `${alert.coin_symbol} ${alert.condition.direction} $${alert.condition.target_price}`
      case 'SIGNAL':
        return `${alert.coin_symbol} ${alert.condition.direction} signal >${(alert.condition.min_confidence * 100).toFixed(0)}%`
      case 'BOT':
        return `${alert.bot_name} signals for ${alert.coin_symbol}`
      case 'REGIME':
        return `${alert.coin_symbol} enters ${alert.condition.regime}`
      default:
        return 'Unknown alert'
    }
  }

  if (loading) {
    return <div className="alerts-loading">Loading alerts...</div>
  }

  return (
    <div className="custom-alerts-manager">
      <div className="alerts-header">
        <h3>Custom Alerts</h3>
        <button className="create-alert-btn" onClick={handleCreate}>
          <Plus size={16} />
          New Alert
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="no-alerts">
          <Bell size={48} />
          <p>No custom alerts configured</p>
          <button onClick={handleCreate}>Create your first alert</button>
        </div>
      ) : (
        <div className="alerts-list">
          {alerts.map(alert => (
            <div key={alert.id} className={`alert-item ${!alert.is_active ? 'inactive' : ''}`}>
              <div className="alert-icon">
                {getAlertTypeIcon(alert.alert_type)}
              </div>
              <div className="alert-details">
                <div className="alert-type">{alert.alert_type}</div>
                <div className="alert-description">{getAlertDescription(alert)}</div>
                <div className="alert-method">
                  via {alert.notification_method}
                </div>
              </div>
              <div className="alert-actions">
                <button onClick={() => handleEdit(alert)} className="edit-btn">
                  <Edit size={16} />
                </button>
                <button onClick={() => handleDelete(alert.id)} className="delete-btn">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className={`alert-status ${alert.is_active ? 'active' : 'inactive'}`}>
                {alert.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="alert-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="alert-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingAlert ? 'Edit Alert' : 'Create New Alert'}</h3>
              <button onClick={() => setShowModal(false)} className="close-btn">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="alert-form">
              <div className="form-group">
                <label>Alert Type</label>
                <select
                  value={formData.alert_type}
                  onChange={e => setFormData({ ...formData, alert_type: e.target.value })}
                >
                  <option value="PRICE">Price Alert</option>
                  <option value="SIGNAL">Signal Alert</option>
                  <option value="BOT">Bot Alert</option>
                  <option value="REGIME">Regime Change</option>
                </select>
              </div>

              <div className="form-group">
                <label>Coin Symbol</label>
                <input
                  type="text"
                  value={formData.coin_symbol}
                  onChange={e => setFormData({ ...formData, coin_symbol: e.target.value.toUpperCase() })}
                  placeholder="BTC"
                />
              </div>

              {formData.alert_type === 'PRICE' && (
                <>
                  <div className="form-group">
                    <label>Target Price</label>
                    <input
                      type="number"
                      value={formData.target_price || ''}
                      onChange={e => setFormData({ ...formData, target_price: e.target.value })}
                      placeholder="70000"
                      step="0.01"
                    />
                  </div>
                  <div className="form-group">
                    <label>Direction</label>
                    <select
                      value={formData.direction || 'ABOVE'}
                      onChange={e => setFormData({ ...formData, direction: e.target.value })}
                    >
                      <option value="ABOVE">Above</option>
                      <option value="BELOW">Below</option>
                    </select>
                  </div>
                </>
              )}

              {formData.alert_type === 'SIGNAL' && (
                <>
                  <div className="form-group">
                    <label>Minimum Confidence</label>
                    <input
                      type="number"
                      value={(formData.min_confidence || 0.85) * 100}
                      onChange={e => setFormData({ ...formData, min_confidence: parseFloat(e.target.value) / 100 })}
                      min="50"
                      max="100"
                      step="5"
                    />
                    <span className="helper">%</span>
                  </div>
                  <div className="form-group">
                    <label>Signal Direction</label>
                    <select
                      value={formData.signal_direction || 'LONG'}
                      onChange={e => setFormData({ ...formData, signal_direction: e.target.value })}
                    >
                      <option value="LONG">Long</option>
                      <option value="SHORT">Short</option>
                      <option value="ANY">Any</option>
                    </select>
                  </div>
                </>
              )}

              {formData.alert_type === 'BOT' && (
                <div className="form-group">
                  <label>Bot Name</label>
                  <input
                    type="text"
                    value={formData.bot_name || ''}
                    onChange={e => setFormData({ ...formData, bot_name: e.target.value })}
                    placeholder="RSI Oversold Hunter"
                  />
                </div>
              )}

              {formData.alert_type === 'REGIME' && (
                <div className="form-group">
                  <label>Target Regime</label>
                  <select
                    value={formData.regime || 'BULL'}
                    onChange={e => setFormData({ ...formData, regime: e.target.value })}
                  >
                    <option value="BULL">Bull</option>
                    <option value="BEAR">Bear</option>
                    <option value="SIDEWAYS">Sideways</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Notification Method</label>
                <select
                  value={formData.notification_method}
                  onChange={e => setFormData({ ...formData, notification_method: e.target.value })}
                >
                  <option value="EMAIL">Email Only</option>
                  <option value="BROWSER">Browser Only</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <span>Alert is active</span>
                </label>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  {editingAlert ? 'Update Alert' : 'Create Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
