import React, { useState, useEffect } from 'react'
import { Bell, X, Check, CheckCheck, Trash2 } from 'lucide-react'
import { API_ENDPOINTS, getHeaders } from '../config/api'
import './NotificationCenter.css'

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.notifications}?limit=20`, {
        headers: getHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(API_ENDPOINTS.notifications, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: 'mark_read',
          notificationId
        })
      })
      if (response.ok) {
        await fetchNotifications()
      }
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      setLoading(true)
      const response = await fetch(API_ENDPOINTS.notifications, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'mark_all_read' })
      })
      if (response.ok) {
        await fetchNotifications()
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteNotification = async (notificationId) => {
    try {
      const response = await fetch(API_ENDPOINTS.notifications, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: 'delete',
          notificationId
        })
      })
      if (response.ok) {
        await fetchNotifications()
      }
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'var(--accent-red)'
      case 'high': return 'var(--accent-orange)'
      case 'normal': return 'var(--accent-blue)'
      default: return 'var(--text-secondary)'
    }
  }

  const getTimeAgo = (timestamp) => {
    const now = new Date()
    const created = new Date(timestamp)
    const diffMs = now - created
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  return (
    <div className="notification-center">
      <button
        className="notification-bell"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="notification-overlay" onClick={() => setIsOpen(false)} />
          <div className="notification-panel">
            <div className="notification-header">
              <h3>Notifications</h3>
              <div className="notification-actions">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={loading}
                    className="mark-all-read"
                    title="Mark all as read"
                  >
                    <CheckCheck size={18} />
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="close-btn">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="notification-list">
              {notifications.length === 0 ? (
                <div className="no-notifications">
                  <Bell size={48} />
                  <p>No notifications yet</p>
                  <span>You'll be notified when something important happens</span>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                  >
                    <div
                      className="priority-indicator"
                      style={{ background: getPriorityColor(notification.priority) }}
                    />
                    <div className="notification-content">
                      <div className="notification-title">
                        {notification.title}
                        {!notification.is_read && <span className="unread-dot" />}
                      </div>
                      <div className="notification-message">
                        {notification.message}
                      </div>
                      <div className="notification-meta">
                        <span className="notification-time">
                          {getTimeAgo(notification.created_at)}
                        </span>
                        <span className="notification-type">{notification.type}</span>
                      </div>
                    </div>
                    <div className="notification-buttons">
                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="mark-read-btn"
                          title="Mark as read"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="delete-btn"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
