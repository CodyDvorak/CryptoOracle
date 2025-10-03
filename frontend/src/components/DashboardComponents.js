import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Activity, TrendingUp, TrendingDown, Clock, Info } from 'lucide-react';
import GaugeComponent from 'react-gauge-component';
import BotDetailsModal from './BotDetailsModal';

export const CoinRecommendationCard = ({ recommendation, rank, runId }) => {
  const { 
    coin, 
    ticker = '',
    consensus_direction, 
    avg_confidence, 
    current_price,
    avg_entry, 
    avg_take_profit, 
    avg_stop_loss,
    avg_predicted_24h,
    avg_predicted_48h,
    avg_predicted_7d,
    trader_grade = 0,
    investor_grade = 0,
    ai_trend = '',
    predicted_percent_change = 0,
    predicted_dollar_change = 0,
    bot_count = 48,
    market_regime = 'SIDEWAYS',
    regime_confidence = 0.5
  } = recommendation;
  
  const [showBotDetails, setShowBotDetails] = useState(false);
  
  const isLong = consensus_direction === 'long';
  const profitPct = isLong 
    ? ((avg_take_profit - avg_entry) / avg_entry * 100)
    : ((avg_entry - avg_take_profit) / avg_entry * 100);
  
  // Calculate predicted changes
  const change24h = ((avg_predicted_24h - current_price) / current_price * 100);
  const change48h = ((avg_predicted_48h - current_price) / current_price * 100);
  const change7d = ((avg_predicted_7d - current_price) / current_price * 100);
  
  // Format display name
  const displayName = ticker ? `${coin}/${ticker}` : coin;
  
  // Format price with conditional decimal places
  const formatPrice = (price) => {
    if (!price) return '0.00';
    if (price < 10) {
      return price.toFixed(8);
    } else if (price < 100) {
      return price.toFixed(4);
    } else {
      return price.toFixed(2);
    }
  };
  
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
  };
  
  return (
    <Card 
      className="group hover:shadow-[var(--shadow-deep)] transition-shadow duration-200 hover:-translate-y-1 min-h-[520px] flex flex-col"
      data-testid="coin-card"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2">
              <span className="text-[var(--primary)] flex-shrink-0">
                #{rank}
              </span>
              <span className="truncate" data-testid="coin-symbol" title={displayName}>
                {displayName}
              </span>
            </CardTitle>
            {/* AI Insights */}
            {(trader_grade > 0 || investor_grade > 0) && (
              <div className="flex gap-2 text-xs flex-wrap">
                {trader_grade > 0 && (
                  <div className="flex items-center gap-1 text-[var(--muted)]">
                    <span className="text-[var(--accent)]">T:</span>
                    <span className="font-mono">{trader_grade.toFixed(0)}/100</span>
                  </div>
                )}
                {investor_grade > 0 && (
                  <div className="flex items-center gap-1 text-[var(--muted)]">
                    <span className="text-[var(--accent)]">I:</span>
                    <span className="font-mono">{investor_grade.toFixed(0)}/100</span>
                  </div>
                )}
                {ai_trend && (
                  <div className={`flex items-center gap-1 ${
                    ai_trend === 'bullish' ? 'text-[var(--success)]' : 
                    ai_trend === 'bearish' ? 'text-[var(--danger)]' : 'text-[var(--muted)]'
                  }`}>
                    <span>•</span>
                    <span className="capitalize">{ai_trend}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <span 
            className={`px-3 py-1 rounded-md text-xs font-bold flex-shrink-0 ${
              isLong 
                ? 'bg-[var(--chart-green)] text-black' 
                : 'bg-[var(--chart-red)] text-white'
            }`}
            data-testid="position-direction"
          >
            {consensus_direction.toUpperCase()}
          </span>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Confidence Gauge */}
        <div className="flex justify-center mb-4" data-testid="confidence-gauge">
          <GaugeComponent
            type="semicircle"
            arc={{
              width: 0.2,
              padding: 0.01,
              cornerRadius: 2,
              subArcs: [
                { limit: 30, color: 'var(--danger)' },      // 1-3 = 10-30%
                { limit: 65, color: 'var(--warning)' },     // 3.1-6.5 = 31-65%
                { limit: 100, color: 'var(--success)' }     // 6.6-10 = 66-100%
              ]
            }}
            value={(avg_confidence / 10) * 100}
            labels={{
              valueLabel: { 
                formatTextValue: () => `${avg_confidence.toFixed(1)}/10`,
                style: { fill: 'var(--text)', fontSize: '20px', fontWeight: 'bold' }
              },
              tickLabels: {
                type: 'outer',
                ticks: [{ value: 0 }, { value: 50 }, { value: 100 }],
                defaultTickValueConfig: {
                  style: { fill: 'var(--muted)', fontSize: '10px' }
                }
              }
            }}
          />
        </div>
        
        {/* Current Price */}
        <div className="mb-3 p-3 rounded-lg bg-[var(--panel)] border border-[var(--card-border)]">
          <div className="text-xs text-[var(--muted)] mb-1">Current Price</div>
          <div className="text-2xl font-mono font-bold text-[var(--primary)]" data-testid="current-price">
            ${formatPrice(current_price || avg_entry)}
          </div>
        </div>
        
        {/* Predicted Prices */}
        <div className="space-y-2 mb-3">
          <div className="text-xs font-semibold text-[var(--muted)] mb-1">AI Predicted Prices</div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-[var(--muted)]">24h</span>
            <span className={`font-mono font-bold ${change24h >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              ${formatPrice(avg_predicted_24h)} 
              <span className="text-xs ml-1">({change24h >= 0 ? '+' : ''}{change24h.toFixed(4)}%)</span>
            </span>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-[var(--muted)]">48h</span>
            <span className={`font-mono font-bold ${change48h >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              ${formatPrice(avg_predicted_48h)}
              <span className="text-xs ml-1">({change48h >= 0 ? '+' : ''}{change48h.toFixed(4)}%)</span>
            </span>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-[var(--muted)]">7d</span>
            <span className={`font-mono font-bold ${change7d >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              ${formatPrice(avg_predicted_7d)}
              <span className="text-xs ml-1">({change7d >= 0 ? '+' : ''}{change7d.toFixed(4)}%)</span>
            </span>
          </div>
        </div>
        
        {/* Trading Metrics */}
        <div className="space-y-2 pt-3 border-t border-[var(--card-border)]">
          <div className="text-xs font-semibold text-[var(--muted)] mb-1">Average TP/SL (from {bot_count} bots)</div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-[var(--success)]">Take Profit</span>
            <span className="font-mono font-bold text-[var(--success)]" data-testid="tp-value">
              ${formatPrice(avg_take_profit)}
              <span className="text-xs ml-1">({profitPct > 0 ? '+' : ''}{profitPct.toFixed(4)}%)</span>
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-[var(--danger)]">Stop Loss</span>
            <span className="font-mono font-bold text-[var(--danger)]" data-testid="sl-value">
              ${formatPrice(avg_stop_loss)}
            </span>
          </div>
        </div>
        
        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-[var(--card-border)] flex gap-2">
          <button
            className="flex-1 px-3 py-2 bg-[var(--surface)] hover:bg-[#171c25] rounded-md text-xs transition-colors"
            onClick={() => copyToClipboard(`${displayName}: ${consensus_direction.toUpperCase()} @ $${avg_entry.toFixed(8)} | Pred 7d: $${avg_predicted_7d?.toFixed(8)}`, 'Trade copied')}
            data-testid="copy-trade-button"
          >
            Copy Trade
          </button>
          <button
            className="flex items-center gap-2 px-3 py-2 bg-[var(--primary)] hover:bg-[var(--accent)] text-black rounded-md text-xs font-semibold transition-colors"
            onClick={() => setShowBotDetails(true)}
            data-testid="view-bot-details-button"
          >
            <Info className="w-4 h-4" />
            Bot Details
          </button>
        </div>
      </CardContent>
      
      {/* Bot Details Modal */}
      <BotDetailsModal
        open={showBotDetails}
        onClose={() => setShowBotDetails(false)}
        runId={runId}
        coinSymbol={ticker}
        coinName={coin}
      />
    </Card>
  );
};

export const BotStatusGrid = ({ bots }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="bot-status-grid">
      {bots.map((bot, index) => (
        <Card 
          key={index}
          className="p-3 hover:border-[var(--accent)]/30 transition-colors"
          data-testid="bot-card"
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-[var(--success)]" />
            <span className="text-xs font-medium truncate">{bot.bot_name}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--muted)]" data-testid="bot-status">
              {bot.status}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
};

export const StatCard = ({ icon: Icon, label, value, trend }) => {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[var(--muted)]">{label}</span>
        <Icon className="w-4 h-4 text-[var(--primary)]" />
      </div>
      <div className="text-2xl font-bold font-mono">{value}</div>
      {trend && (
        <div className={`text-xs mt-1 flex items-center gap-1 ${
          trend > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
        }`}>
          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend)}%
        </div>
      )}
    </Card>
  );
};