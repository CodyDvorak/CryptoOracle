import React, { useEffect, useRef, memo } from 'react'

function TradingViewChart({ symbol, interval, botSignals }) {
  const container = useRef(null)
  const widgetRef = useRef(null)

  useEffect(() => {
    if (!container.current) return

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/tv.js'
    script.async = true
    script.type = 'text/javascript'

    script.onload = () => {
      if (widgetRef.current) {
        widgetRef.current.remove()
      }

      if (window.TradingView) {
        widgetRef.current = new window.TradingView.widget({
          autosize: true,
          symbol: `BINANCE:${symbol}USDT`,
          interval: interval || '240',
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#1a1d25',
          enable_publishing: false,
          withdateranges: true,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          save_image: false,
          container_id: container.current.id,
          studies: [
            'MASimple@tv-basicstudies',
            'RSI@tv-basicstudies',
            'MACD@tv-basicstudies'
          ],
          disabled_features: ['use_localstorage_for_settings'],
          enabled_features: ['study_templates'],
          overrides: {
            'mainSeriesProperties.candleStyle.upColor': '#22c55e',
            'mainSeriesProperties.candleStyle.downColor': '#ef4444',
            'mainSeriesProperties.candleStyle.borderUpColor': '#22c55e',
            'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
            'mainSeriesProperties.candleStyle.wickUpColor': '#22c55e',
            'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
          },
          loading_screen: {
            backgroundColor: '#1a1d25',
            foregroundColor: '#3b82f6'
          }
        })
      }
    }

    script.onerror = () => {
      console.error('Failed to load TradingView script')
    }

    document.head.appendChild(script)

    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove()
        widgetRef.current = null
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [symbol, interval])

  return (
    <div className="tradingview-widget-container" style={{ height: '600px', width: '100%' }}>
      <div
        id="tradingview_chart"
        ref={container}
        style={{ height: '100%', width: '100%' }}
      />
      {botSignals && botSignals.length > 0 && (
        <div className="bot-signals-overlay">
          <div className="signals-summary">
            <span className="signals-count">{botSignals.length} Bot Signals</span>
            <div className="signals-breakdown">
              <span className="long-signals">
                {botSignals.filter(s => s.position_direction === 'LONG').length} LONG
              </span>
              <span className="short-signals">
                {botSignals.filter(s => s.position_direction === 'SHORT').length} SHORT
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(TradingViewChart)
