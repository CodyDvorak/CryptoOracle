import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from './ui/dialog';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';

const BotDetailsModal = ({ open, onClose, runId, coinSymbol, coinName }) => {
  const [botDetails, setBotDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && runId && coinSymbol) {
      fetchBotDetails();
    }
  }, [open, runId, coinSymbol]);

  const fetchBotDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const backendUrl = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const response = await fetch(
        `${backendUrl}/api/recommendations/${runId}/${coinSymbol}/bot_details`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch bot details');
      }

      const data = await response.json();
      setBotDetails(data);
    } catch (err) {
      console.error('Error fetching bot details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>
            Bot Analysis Details - {coinName || coinSymbol}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
          </div>
        )}

        {error && (
          <div className="bg-[var(--danger)]/10 border border-[var(--danger)] rounded-lg p-4 text-[var(--danger)]">
            <p className="font-semibold">Error loading bot details</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && botDetails && (
          <div>
            {/* Summary */}
            <div className="mb-6 p-4 bg-[var(--panel)] rounded-lg border border-[var(--card-border)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--muted)] mb-1">Total Bots Analyzed</p>
                  <p className="text-2xl font-bold text-[var(--primary)]">{botDetails.total_bots}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] mb-1">Average Confidence</p>
                  <p className="text-2xl font-bold text-[var(--primary)]">
                    {botDetails.avg_confidence?.toFixed(1)}/10
                  </p>
                </div>
              </div>
            </div>

            {/* Bot Results Table */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--muted)] mb-3">
                Individual Bot Confidence Scores
              </h3>
              
              <div className="space-y-2">
                {botDetails.bot_results && botDetails.bot_results.map((bot, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-[var(--surface)] hover:bg-[var(--panel)] rounded-lg border border-[var(--card-border)] transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Activity className="w-4 h-4 text-[var(--primary)]" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--text)]">{bot.bot_name}</p>
                        {bot.rationale && (
                          <p className="text-xs text-[var(--muted)] mt-1 truncate">{bot.rationale}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {/* Direction Badge */}
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          bot.direction === 'long'
                            ? 'bg-[var(--chart-green)] text-black'
                            : 'bg-[var(--chart-red)] text-white'
                        }`}
                      >
                        {bot.direction?.toUpperCase()}
                      </span>
                      
                      {/* Confidence Score */}
                      <div className="text-right min-w-[60px]">
                        <p className="text-lg font-bold font-mono text-[var(--primary)]">
                          {bot.confidence?.toFixed(1)}
                        </p>
                        <p className="text-xs text-[var(--muted)]">/ 10</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Stats */}
            <div className="mt-6 pt-4 border-t border-[var(--card-border)]">
              <p className="text-xs text-[var(--muted)] text-center">
                Confidence scores represent each bot's certainty in its prediction based on technical analysis.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BotDetailsModal;
