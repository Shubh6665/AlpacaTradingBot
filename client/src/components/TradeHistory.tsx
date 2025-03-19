import { Trade } from '@/lib/types';
import { formatCurrency, formatCryptoQty, formatDateTime } from '@/lib/tradingUtils';

interface TradeHistoryProps {
  trades: Trade[];
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  return (
    <div className="col-span-12 lg:col-span-4 bg-[#1E2130] rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-[#2D3748]">
        <h2 className="text-white font-medium">Recent Trades</h2>
      </div>
      
      <div className="overflow-y-auto" style={{ maxHeight: '300px', scrollbarWidth: 'thin' }}>
        <div className="divide-y divide-[#2D3748]">
          {trades.length > 0 ? (
            trades.map((trade) => (
              <div key={trade.id} className="p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center">
                      <span className={`font-medium mr-2 ${trade.side === 'buy' ? 'text-[#00C853]' : 'text-[#FF3B30]'}`}>
                        {trade.side.toUpperCase()}
                      </span>
                      <span className="text-white">{trade.symbol.replace('USD', '/USD')}</span>
                    </div>
                    <div className="text-xs text-[#B7BDC6] mt-1">
                      {formatDateTime(trade.timestamp)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-mono">
                      {formatCryptoQty(trade.qty)} {trade.symbol.replace('USD', '')}
                    </div>
                    <div className="text-xs text-[#B7BDC6] mt-1">
                      @ {formatCurrency(trade.price)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-[#B7BDC6]">
              <p>No recent trades</p>
              <p className="text-sm mt-2">Trade history will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
