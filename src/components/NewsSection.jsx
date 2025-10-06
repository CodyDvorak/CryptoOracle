import React, { useState, useEffect } from 'react'
import { Newspaper, ExternalLink, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import './NewsSection.css'

function NewsSection({ coinSymbol }) {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchNews()
  }, [coinSymbol])

  const fetchNews = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const url = `${supabaseUrl}/functions/v1/crypto-news?symbol=${coinSymbol}`

      const response = await fetch(url)
      const data = await response.json()

      if (data.success && data.articles) {
        setNews(data.articles)
      } else {
        setNews([])
      }
    } catch (err) {
      console.error('Error fetching news:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const analyzeSentiment = (text) => {
    const bullishWords = ['surge', 'rally', 'gain', 'rise', 'jump', 'soar', 'bullish', 'breakthrough', 'adoption', 'upgrade', 'partnership', 'growth', 'positive', 'optimistic', 'success']
    const bearishWords = ['crash', 'plunge', 'drop', 'fall', 'decline', 'bearish', 'concern', 'warning', 'risk', 'trouble', 'loss', 'negative', 'pessimistic', 'failure', 'hack']

    const lowerText = text.toLowerCase()
    let score = 0

    bullishWords.forEach(word => {
      if (lowerText.includes(word)) score += 1
    })

    bearishWords.forEach(word => {
      if (lowerText.includes(word)) score -= 1
    })

    if (score > 0) return 'bullish'
    if (score < 0) return 'bearish'
    return 'neutral'
  }

  const formatTimeAgo = (dateString) => {
    const now = new Date()
    const publishedDate = new Date(dateString)
    const diffMs = now - publishedDate
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    return 'Just now'
  }

  const getSentimentIcon = (sentiment) => {
    if (sentiment === 'bullish') return <TrendingUp size={16} className="sentiment-icon bullish" />
    if (sentiment === 'bearish') return <TrendingDown size={16} className="sentiment-icon bearish" />
    return null
  }

  if (loading) {
    return (
      <div className="news-section loading">
        <div className="section-header">
          <Newspaper size={20} />
          <h2>Latest News</h2>
        </div>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading latest news...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="news-section error">
        <div className="section-header">
          <Newspaper size={20} />
          <h2>Latest News</h2>
        </div>
        <div className="error-state">
          <p>Failed to load news: {error}</p>
          <button onClick={fetchNews} className="retry-btn">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="news-section">
      <div className="section-header">
        <Newspaper size={20} />
        <h2>Latest News for {coinSymbol}</h2>
        <span className="news-count">{news.length} articles</span>
      </div>

      <div className="news-grid">
        {news.map((article, idx) => (
          <a
            key={idx}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`news-card ${article.sentiment}`}
          >
            {article.urlToImage && (
              <div className="news-image">
                <img src={article.urlToImage} alt={article.title} onError={(e) => e.target.style.display = 'none'} />
              </div>
            )}
            <div className="news-content">
              <div className="news-meta">
                <span className="news-source">{article.source.name}</span>
                <span className="news-time">
                  <Clock size={12} />
                  {formatTimeAgo(article.publishedAt)}
                </span>
                {getSentimentIcon(article.sentiment)}
              </div>
              <h3 className="news-title">{article.title}</h3>
              {article.description && (
                <p className="news-description">{article.description}</p>
              )}
              <div className="news-footer">
                {article.author && <span className="news-author">{article.author}</span>}
                <ExternalLink size={14} />
              </div>
            </div>
          </a>
        ))}
      </div>

      {news.length === 0 && (
        <div className="empty-state">
          <Newspaper size={48} />
          <p>No recent news found for {coinSymbol}</p>
        </div>
      )}
    </div>
  )
}

export default NewsSection
