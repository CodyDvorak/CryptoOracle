import React, { useState, useEffect } from 'react'
import { User, Bell, Clock, Mail, Save, RefreshCw } from 'lucide-react'
import './Profile.css'

export default function Profile() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({
    email: 'user@example.com',
    timezone: 'America/New_York',
    notification_preferences: {
      email_enabled: true,
      push_enabled: true,
      min_confidence: 7,
      high_confidence_only: false,
      signal_types: ['scan_complete', 'high_confidence_signal', 'bot_alert']
    }
  })

  const [scheduledScans, setScheduledScans] = useState([])
  const [newScan, setNewScan] = useState({
    interval: 'daily',
    time: '09:00',
    is_active: true
  })

  const handleProfileUpdate = async () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      alert('Profile updated successfully!')
    }, 1000)
  }

  const handleNotificationChange = (key, value) => {
    setProfile({
      ...profile,
      notification_preferences: {
        ...profile.notification_preferences,
        [key]: value
      }
    })
  }

  const handleSignalTypeToggle = (type) => {
    const current = profile.notification_preferences.signal_types
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]

    setProfile({
      ...profile,
      notification_preferences: {
        ...profile.notification_preferences,
        signal_types: updated
      }
    })
  }

  const handleAddSchedule = () => {
    const schedule = {
      id: Date.now(),
      ...newScan,
      next_run: 'Tomorrow at ' + newScan.time
    }
    setScheduledScans([...scheduledScans, schedule])
    setNewScan({ interval: 'daily', time: '09:00', is_active: true })
  }

  const handleDeleteSchedule = (id) => {
    setScheduledScans(scheduledScans.filter(s => s.id !== id))
  }

  const handleToggleSchedule = (id) => {
    setScheduledScans(scheduledScans.map(s =>
      s.id === id ? { ...s, is_active: !s.is_active } : s
    ))
  }

  return (
    <div className="profile">
      <div className="profile-header">
        <h1>Profile & Settings</h1>
        <p>Manage your account preferences and notification settings</p>
      </div>

      <div className="profile-content">
        <div className="settings-section">
          <div className="section-header">
            <User size={24} />
            <h2>Account Information</h2>
          </div>
          <div className="settings-card">
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Timezone</label>
              <select
                value={profile.timezone}
                onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                className="form-select"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Paris">Paris (CET)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
                <option value="Australia/Sydney">Sydney (AEDT)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <Bell size={24} />
            <h2>Notification Preferences</h2>
          </div>
          <div className="settings-card">
            <div className="toggle-group">
              <div className="toggle-item">
                <div className="toggle-label">
                  <Mail size={20} />
                  <span>Email Notifications</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={profile.notification_preferences.email_enabled}
                    onChange={(e) => handleNotificationChange('email_enabled', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="toggle-item">
                <div className="toggle-label">
                  <Bell size={20} />
                  <span>Push Notifications</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={profile.notification_preferences.push_enabled}
                    onChange={(e) => handleNotificationChange('push_enabled', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="toggle-item">
                <div className="toggle-label">
                  <span>High Confidence Signals Only</span>
                  <span className="hint">Only notify for signals with 8/10 or higher</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={profile.notification_preferences.high_confidence_only}
                    onChange={(e) => handleNotificationChange('high_confidence_only', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Minimum Confidence Threshold</label>
              <div className="slider-group">
                <input
                  type="range"
                  min="5"
                  max="10"
                  step="0.5"
                  value={profile.notification_preferences.min_confidence}
                  onChange={(e) => handleNotificationChange('min_confidence', parseFloat(e.target.value))}
                  className="confidence-slider"
                />
                <span className="slider-value">{profile.notification_preferences.min_confidence}/10</span>
              </div>
            </div>

            <div className="form-group">
              <label>Notification Types</label>
              <div className="checkbox-group">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={profile.notification_preferences.signal_types.includes('scan_complete')}
                    onChange={() => handleSignalTypeToggle('scan_complete')}
                  />
                  <span>Scan Completed</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={profile.notification_preferences.signal_types.includes('high_confidence_signal')}
                    onChange={() => handleSignalTypeToggle('high_confidence_signal')}
                  />
                  <span>High Confidence Signals</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={profile.notification_preferences.signal_types.includes('bot_alert')}
                    onChange={() => handleSignalTypeToggle('bot_alert')}
                  />
                  <span>Bot Performance Alerts</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={profile.notification_preferences.signal_types.includes('performance_summary')}
                    onChange={() => handleSignalTypeToggle('performance_summary')}
                  />
                  <span>Daily Performance Summary</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <Clock size={24} />
            <h2>Scheduled Scans</h2>
          </div>
          <div className="settings-card">
            <div className="schedule-creator">
              <div className="form-row">
                <div className="form-group">
                  <label>Interval</label>
                  <select
                    value={newScan.interval}
                    onChange={(e) => setNewScan({ ...newScan, interval: e.target.value })}
                    className="form-select"
                  >
                    <option value="hourly">Every Hour</option>
                    <option value="4h">Every 4 Hours</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Time</label>
                  <input
                    type="time"
                    value={newScan.time}
                    onChange={(e) => setNewScan({ ...newScan, time: e.target.value })}
                    className="form-input"
                  />
                </div>
                <button onClick={handleAddSchedule} className="add-schedule-btn">
                  Add Schedule
                </button>
              </div>
            </div>

            <div className="schedule-list">
              {scheduledScans.length === 0 ? (
                <div className="no-schedules">
                  <Clock size={48} />
                  <p>No scheduled scans</p>
                  <span>Create a schedule to run scans automatically</span>
                </div>
              ) : (
                scheduledScans.map((schedule) => (
                  <div key={schedule.id} className="schedule-item">
                    <div className="schedule-info">
                      <div className="schedule-interval">{schedule.interval}</div>
                      <div className="schedule-time">{schedule.time}</div>
                      <div className="schedule-next">Next: {schedule.next_run}</div>
                    </div>
                    <div className="schedule-actions">
                      <label className="toggle-switch small">
                        <input
                          type="checkbox"
                          checked={schedule.is_active}
                          onChange={() => handleToggleSchedule(schedule.id)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                      <button
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        className="delete-schedule-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="settings-actions">
          <button
            onClick={handleProfileUpdate}
            disabled={saving}
            className="save-btn"
          >
            {saving ? (
              <>
                <RefreshCw className="spinner" size={20} />
                Saving...
              </>
            ) : (
              <>
                <Save size={20} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
