import { Button } from '@/components/ui/button';
import { Position } from '@/lib/types';
import { formatCurrency, formatCryptoQty } from '@/lib/tradingUtils';

interface PositionsTableProps {
  positions: Position[];
  onClosePosition: (symbol: string) => void;
  isClosingPosition: boolean;
}

export function PositionsTable({ positions, onClosePosition, isClosingPosition }: PositionsTableProps) {
  return (
    <div className="col-span-12 lg:col-span-8 bg-[#1E2130] rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-[#2D3748]">
        <h2 className="text-white font-medium">Open Positions</h2>
      </div>
      
      <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        {positions.length > 0 ? (
          <table className="min-w-full">
            <thead className="bg-[#121722]">
              <tr>
                <th className="py-2 px-4 text-left text-xs text-[#B7BDC6] font-medium">Symbol</th>
                <th className="py-2 px-4 text-left text-xs text-[#B7BDC6] font-medium">Qty</th>
                <th className="py-2 px-4 text-left text-xs text-[#B7BDC6] font-medium">Entry Price</th>
                <th className="py-2 px-4 text-left text-xs text-[#B7BDC6] font-medium">Current Price</th>
                <th className="py-2 px-4 text-left text-xs text-[#B7BDC6] font-medium">Market Value</th>
                <th className="py-2 px-4 text-left text-xs text-[#B7BDC6] font-medium">Unrealized P/L</th>
                <th className="py-2 px-4 text-left text-xs text-[#B7BDC6] font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.id} className="border-b border-[#2D3748]">
                  <td className="py-3 px-4 text-white">
                    {position.symbol.replace('USD', '/USD')}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {formatCryptoQty(position.qty)}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {formatCurrency(position.entryPrice)}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {formatCurrency(position.currentPrice)}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {formatCurrency(position.marketValue)}
                  </td>
                  <td className={`py-3 px-4 font-mono ${position.unrealizedPl >= 0 ? 'text-[#00C853]' : 'text-[#FF3B30]'}`}>
                    {formatCurrency(position.unrealizedPl)} ({position.unrealizedPlPerc > 0 ? '+' : ''}{position.unrealizedPlPerc.toFixed(2)}%)
                  </td>
                  <td className="py-3 px-4">
                    <Button
                      onClick={() => onClosePosition(position.symbol)}
                      disabled={isClosingPosition}
                      className="bg-[#FF3B30] text-white px-2 py-1 text-xs rounded h-auto hover:bg-[#E42C21]"
                    >
                      Close
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-[#B7BDC6]">
            <p>No open positions</p>
            <p className="text-sm mt-2">Positions will appear here when you make trades</p>
          </div>
        )}
      </div>
    </div>
  );
}
