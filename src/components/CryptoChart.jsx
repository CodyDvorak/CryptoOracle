import React, { useEffect, useRef, useState } from 'react'
import { createChart } from 'lightweight-charts'
import './CryptoChart.css'

function CryptoChart({ symbol, predictions = [], supportResistance = [] }) {
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const candleSeriesRef = useRef(null)
  const volumeSeriesRef = useRef(null)
  const [timeframe, setTimeframe] = useState('1D')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const timeframeMapping = {
    '1m': { days: 1, interval: 'minutely' },
    '5m': { days: 1, interval: 'minutely' },
    '15m': { days: 3, interval: 'minutely' },
    '1H': { days: 7, interval: 'hourly' },
    '4H': { days: 30, interval: 'hourly' },
    '1D': { days: 90, interval: 'daily' },
    '1W': { days: 365, interval: 'daily' },
  }

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
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

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })

    const volumeSeries = chart.addHistogramSeries({
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
      'BCH': 'bitcoin-cash'
    }

    const cleanSymbol = sym.toUpperCase().replace('USDT', '').replace('USD', '')
    return symbolMap[cleanSymbol] || sym.toLowerCase()
  }

  const fetchChartData = async () => {
    setLoading(true)
    setError(null)

    try {
      const config = timeframeMapping[timeframe]
      const coinId = symbolToCoinGeckoId(symbol)

      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${config.days}`
      )

      if (!response.ok) throw new Error('Failed to fetch chart data')

      const data = await response.json()

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

      if (candleSeriesRef.current && volumeSeriesRef.current) {
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

    const markers = predictions.map(pred => {
      const isLong = pred.direction === 'LONG'
      return {
        time: Math.floor(new Date(pred.created_at).getTime() / 1000),
        position: isLong ? 'belowBar' : 'aboveBar',
        color: isLong ? '#10b981' : '#ef4444',
        shape: isLong ? 'arrowUp' : 'arrowDown',
        text: `${pred.bot_name}: ${isLong ? 'LONG' : 'SHORT'} @ $${pred.entry_price.toFixed(2)}`,
      }
    })

    candleSeriesRef.current.setMarkers(markers)
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
            <span>Long Signals: {predictions.filter(p => p.direction === 'LONG').length}</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon short">↓</span>
            <span>Short Signals: {predictions.filter(p => p.direction === 'SHORT').length}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default CryptoChart
