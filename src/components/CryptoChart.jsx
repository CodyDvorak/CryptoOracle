import React, { useEffect, useRef, useState } from 'react'
import * as LightweightCharts from 'lightweight-charts'

function CryptoChart({ symbol, predictions = [], supportResistance = [] }) {
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const candleSeriesRef = useRef(null)
  const volumeSeriesRef = useRef(null)
  const [timeframe, setTimeframe] = useState('1D')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const timeframeMapping = {
    '1m': { days: 1 },
    '5m': { days: 1 },
    '15m': { days: 1 },
    '1H': { days: 7 },
    '4H': { days: 30 },
    '1D': { days: 90 },
    '1W': { days: 365 },
  }

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = LightweightCharts.createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: '#758696',
          style: 3,
        },
        horzLine: {
          width: 1,
          color: '#758696',
          style: 3,
        },
      },
      rightPriceScale: {
        borderColor: '#e1e4e8',
      },
      timeScale: {
        borderColor: '#e1e4e8',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
    })

    const candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })

    const volumeSeries = chart.addSeries(LightweightCharts.HistogramSeries, {
      color: '#667eea',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
      }
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current || !symbol) return

    fetchChartData()
  }, [symbol, timeframe])

  const symbolToCoinGeckoId = (sym) => {
    const symbolMap = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'SOL': 'solana',
      'BNB': 'binancecoin',
      'XRP': 'ripple',
      'ADA': 'cardano',
      'DOGE': 'dogecoin',
      'MATIC': 'matic-network',
      'DOT': 'polkadot',
      'AVAX': 'avalanche-2',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'ATOM': 'cosmos',
      'LTC': 'litecoin',
      'BCH': 'bitcoin-cash',
      'XMR': 'monero',
      'TRX': 'tron',
      'APT': 'aptos',
      'NEAR': 'near',
      'FTM': 'fantom',
      'ARB': 'arbitrum',
      'OP': 'optimism',
      'SUI': 'sui'
    }

    const cleanSymbol = sym.toUpperCase().replace('USDT', '').replace('USD', '').replace('PERP', '')
    return symbolMap[cleanSymbol] || 'bitcoin'
  }

  const fetchChartData = async () => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) {
      console.warn('Chart not initialized yet')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const config = timeframeMapping[timeframe]
      const coinId = symbolToCoinGeckoId(symbol)

      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${config.days}`
      )

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment.')
        }
        throw new Error('Failed to fetch chart data')
      }

      const data = await response.json()

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No chart data available')
      }

      const candleData = data.map(([timestamp, open, high, low, close]) => ({
        time: timestamp / 1000,
        open,
        high,
        low,
        close,
      }))

      const volumeData = data.map(([timestamp, , high, low], index) => ({
        time: timestamp / 1000,
        value: (high - low) * 1000000,
        color: index > 0 && data[index][4] > data[index - 1][4] ? '#10b981' : '#ef4444',
      }))

      if (candleSeriesRef.current && volumeSeriesRef.current && chartRef.current) {
        candleSeriesRef.current.setData(candleData)
        volumeSeriesRef.current.setData(volumeData)

        addPredictionMarkers()
        addSupportResistanceLines()

        chartRef.current.timeScale().fitContent()
      }
    } catch (err) {
      console.error('Chart data fetch error:', err)
      setError(err.message || 'Failed to load chart data')
    } finally {
      setLoading(false)
    }
  }

  const addPredictionMarkers = () => {
    if (!candleSeriesRef.current || predictions.length === 0) return

    try {
      const markers = predictions.map(pred => {
        const isLong = pred.position_direction === 'LONG'
        return {
          time: Math.floor(new Date(pred.prediction_time).getTime() / 1000),
          position: isLong ? 'belowBar' : 'aboveBar',
          color: isLong ? '#10b981' : '#ef4444',
          shape: isLong ? 'arrowUp' : 'arrowDown',
          text: `${pred.bot_name}: ${isLong ? 'LONG' : 'SHORT'}`,
        }
      })

      if (typeof candleSeriesRef.current.setMarkers === 'function') {
        candleSeriesRef.current.setMarkers(markers)
      }
    } catch (err) {
      console.error('Failed to add prediction markers:', err)
    }
  }

  const addSupportResistanceLines = () => {
    if (!chartRef.current || supportResistance.length === 0) return

    supportResistance.forEach(level => {
      const line = {
        price: level.price,
        color: level.type === 'support' ? '#10b981' : '#ef4444',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `${level.type.toUpperCase()}: $${level.price.toFixed(2)}`,
      }

      candleSeriesRef.current.createPriceLine(line)
    })
  }

  return (
    <div className="crypto-chart-container">
      <div className="chart-header">
        <h3 className="chart-title">{symbol} / USD</h3>
        <div className="timeframe-selector">
          {Object.keys(timeframeMapping).map(tf => (
            <button
              key={tf}
              className={`timeframe-btn ${timeframe === tf ? 'active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="chart-loading">
          <div className="spinner"></div>
          <span>Loading chart data...</span>
        </div>
      )}

      {error && (
        <div className="chart-error">
          <span>{error}</span>
          <button onClick={fetchChartData}>Retry</button>
        </div>
      )}

      <div ref={chartContainerRef} className="chart-wrapper" />

      {predictions.length > 0 && (
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-icon long">↑</span>
            <span>Long Signals: {predictions.filter(p => p.position_direction === 'LONG').length}</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon short">↓</span>
            <span>Short Signals: {predictions.filter(p => p.position_direction === 'SHORT').length}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default CryptoChart
