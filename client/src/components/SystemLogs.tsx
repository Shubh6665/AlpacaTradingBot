import { Button } from '@/components/ui/button';
import { LogEntry } from '@/lib/types';
import { formatDateTime } from '@/lib/tradingUtils';

interface SystemLogsProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  isClearing: boolean;
}

export function SystemLogs({ logs, onClearLogs, isClearing }: SystemLogsProps) {
  // Get log color based on level
  const getLogColor = (level: string) => {
    switch (level) {
      case 'INFO':
        return 'text-[#00C853]';
      case 'TRADE':
        return 'text-[#2962FF]';
      case 'SIGNAL':
        return 'text-[#FFC107]';
      case 'ERROR':
        return 'text-[#FF3B30]';
      case 'WARNING':
        return 'text-[#FFC107]';
      default:
        return 'text-white';
    }
  };

  return (
    <div className="col-span-12 lg:col-span-6 bg-[#1E2130] rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-[#2D3748]">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-medium">System Logs</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearLogs}
            disabled={isClearing || logs.length === 0}
            className="text-[#B7BDC6] hover:text-[#2962FF] text-sm h-auto p-1"
          >
            Clear Logs
          </Button>
        </div>
      </div>
      
      <div className="font-mono text-xs overflow-y-auto bg-[#121722] p-2" style={{ maxHeight: '200px', scrollbarWidth: 'thin' }}>
        {logs.length > 0 ? (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="py-1 px-2">
                <span className={getLogColor(log.level)}>[{log.level}]</span>
                <span className="text-[#B7BDC6]"> {formatDateTime(log.timestamp)}</span>
                <span className="text-white"> {log.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-[#B7BDC6]">
            No logs available
          </div>
        )}
      </div>
    </div>
  );
}
