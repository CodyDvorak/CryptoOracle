import React, { useEffect, useState } from 'react'
import { supabase } from '../config/api'
import { CircleAlert as AlertCircle, TrendingUp, Activity, X } from 'lucide-react'
import './RealtimeUpdates.css'

function RealtimeUpdates({ type = 'insights' }) {
  const [updates, setUpdates] = useState([])
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    let channel

    if (type === 'insights') {
      channel = supabase
        .channel('whale-alerts')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'whale_alerts'
          },
          (payload) => {
            const alert = payload.new
            addUpdate({
              id: alert.id,
              type: 'whale',
              title: '🐋 Whale Alert',
              message: `${alert.transaction_type} detected: ${alert.amount.toLocaleString()} ${alert.coin_symbol} ($${alert.usd_value?.toLocaleString() || 'N/A'})`,
              timestamp: new Date(alert.detected_at),
              severity: alert.amount > 1000000 ? 'high' : 'medium'
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'market_alerts'
          },
          (payload) => {
            const alert = payload.new
            addUpdate({
              id: alert.id,
              type: 'news',
              title: '📰 Breaking News',
              message: alert.alert_message,
              timestamp: new Date(alert.triggered_at),
              severity: alert.alert_type === 'critical' ? 'high' : 'medium'
            })
          }
        )
        .subscribe()
    } else if (type === 'bot-performance') {
      channel = supabase
        .channel('bot-performance-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bot_performance'
          },
          (payload) => {
            const bot = payload.new
            const oldBot = payload.old

            if (bot.accuracy_rate !== oldBot.accuracy_rate) {
              const diff = (bot.accuracy_rate - oldBot.accuracy_rate).toFixed(1)
              addUpdate({
                id: `${bot.bot_name}-${Date.now()}`,
                type: 'accuracy',
                title: '📊 Bot Performance Update',
                message: `${bot.bot_name}: Accuracy ${diff > 0 ? '↑' : '↓'} ${Math.abs(diff)}% (now ${bot.accuracy_rate.toFixed(1)}%)`,
                timestamp: new Date(),
                severity: Math.abs(diff) > 5 ? 'high' : 'low',
                botName: bot.bot_name,
                newAccuracy: bot.accuracy_rate
              })
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'bot_learning_insights'
          },
          (payload) => {
            const insight = payload.new
            if (insight.insight_type === 'strength' || insight.insight_type === 'recommendation') {
              addUpdate({
                id: insight.id,
                type: 'insight',
                title: '💡 Bot Insight',
                message: `${insight.bot_name}: ${insight.insight_text}`,
                timestamp: new Date(insight.created_at),
                severity: 'low'
              })
            }
          }
        )
        .subscribe()
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [type])

  const addUpdate = (update) => {
    setUpdates(prev => [update, ...prev].slice(0, 10))
    setVisible(true)
  }

  const dismissUpdate = (id) => {
    setUpdates(prev => prev.filter(u => u.id !== id))
  }

  const dismissAll = () => {
    setUpdates([])
  }

  if (!visible || updates.length === 0) {
    return null
  }

  return (
    <div className="realtime-updates-container">
      <div className="realtime-header">
        <Activity size={18} className="pulse" />
        <span>Live Updates</span>
        <button className="dismiss-all" onClick={dismissAll}>
          Clear All
        </button>
      </div>
      <div className="updates-list">
        {updates.map(update => (
          <div key={update.id} className={`update-item ${update.severity}`}>
            <div className="update-content">
              <div className="update-title">{update.title}</div>
              <div className="update-message">{update.message}</div>
              <div className="update-time">
                {update.timestamp.toLocaleTimeString()}
              </div>
            </div>
            <button className="dismiss-btn" onClick={() => dismissUpdate(update.id)}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default RealtimeUpdates
