import React, { useState, useEffect } from 'react'
import { User, Bell, Clock, Mail, Save, RefreshCw, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Profile.css'

export default function Profile() {
  const { user, supabase } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState({
    email: user?.email || '',
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

  useEffect(() => {
    if (user) {
      fetchProfile()
      fetchScheduledScans()
    }
  }, [user])

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setProfile({
          email: user.email,
          timezone: data.timezone || 'America/New_York',
          notification_preferences: data.notification_preferences || profile.notification_preferences
        })
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err)
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const fetchScheduledScans = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_scans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setScheduledScans(data || [])
    } catch (err) {
      console.error('Failed to fetch scheduled scans:', err)
    }
  }

  const handleProfileUpdate = async () => {
    setSaving(true)
    setError('')

    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          timezone: profile.timezone,
          notification_preferences: profile.notification_preferences,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      alert('Profile updated successfully!')
    } catch (err) {
      console.error('Failed to update profile:', err)
      setError('Failed to save profile changes')
    } finally {
      setSaving(false)
    }
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

  const handleAddSchedule = async () => {
    try {
      const nextRun = calculateNextRun(newScan.interval, newScan.time)

      const { data, error } = await supabase
        .from('scheduled_scans')
        .insert({
          user_id: user.id,
          interval: newScan.interval,
          cron_expression: convertToCron(newScan.interval, newScan.time),
          time_of_day: newScan.time,
          is_active: newScan.is_active,
          next_run: nextRun
        })
        .select()
        .single()

      if (error) throw error

      setScheduledScans([data, ...scheduledScans])
      setNewScan({ interval: 'daily', time: '09:00', is_active: true })
    } catch (err) {
      console.error('Failed to add schedule:', err)
      setError('Failed to create schedule')
    }
  }

  const handleDeleteSchedule = async (id) => {
    try {
      const { error } = await supabase
        .from('scheduled_scans')
        .delete()
        .eq('id', id)

      if (error) throw error

      setScheduledScans(scheduledScans.filter(s => s.id !== id))
    } catch (err) {
      console.error('Failed to delete schedule:', err)
      setError('Failed to delete schedule')
    }
  }

  const handleToggleSchedule = async (id) => {
    try {
      const schedule = scheduledScans.find(s => s.id === id)
      const { error } = await supabase
        .from('scheduled_scans')
        .update({ is_active: !schedule.is_active })
        .eq('id', id)

      if (error) throw error

      setScheduledScans(scheduledScans.map(s =>
        s.id === id ? { ...s, is_active: !s.is_active } : s
      ))
    } catch (err) {
      console.error('Failed to toggle schedule:', err)
      setError('Failed to update schedule')
    }
  }

  const calculateNextRun = (interval, time) => {
    const now = new Date()
    const [hours, minutes] = time.split(':')
    const next = new Date()
    next.setHours(parseInt(hours), parseInt(minutes), 0, 0)

    if (interval === 'hourly') {
      next.setHours(now.getHours() + 1)
    } else if (interval === '4h') {
      next.setHours(now.getHours() + 4)
    } else if (interval === 'daily') {
      if (next <= now) next.setDate(next.getDate() + 1)
    } else if (interval === 'weekly') {
      if (next <= now) next.setDate(next.getDate() + 7)
    }

    return next.toISOString()
  }

  const convertToCron = (interval, time) => {
    const [hours, minutes] = time.split(':')

    if (interval === 'hourly') return `${minutes} * * * *`
    if (interval === '4h') return `${minutes} */4 * * *`
    if (interval === 'daily') return `${minutes} ${hours} * * *`
    if (interval === 'weekly') return `${minutes} ${hours} * * 0`

    return `0 9 * * *`
  }

  if (loading) {
    return (
      <div className="profile-loading">
        <RefreshCw className="spinner" size={48} />
        <p>Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="profile">
      <div className="profile-header">
        <h1>Profile & Settings</h1>
        <p>Manage your account preferences and notification settings</p>
      </div>

      {error && (
        <div className="profile-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

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
