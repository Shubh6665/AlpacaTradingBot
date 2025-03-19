import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { TradeSymbol, OrderSide, OrderType, TimeInForce } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface OrderFormProps {
  onSubmitOrder: (orderData: any) => void;
  isSubmitting: boolean;
  userId: number | null;
}

export function OrderForm({ onSubmitOrder, isSubmitting, userId }: OrderFormProps) {
  const [side, setSide] = useState<OrderSide>('buy');
  const [symbol, setSymbol] = useState<TradeSymbol>('BTCUSD');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [quantity, setQuantity] = useState<string>('');
  const [timeInForce, setTimeInForce] = useState<TimeInForce>('gtc');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [stopPrice, setStopPrice] = useState<string>('');
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      toast({
        title: "Invalid Limit Price",
        description: "Please enter a valid limit price greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (orderType === 'stop' && (!stopPrice || parseFloat(stopPrice) <= 0)) {
      toast({
        title: "Invalid Stop Price",
        description: "Please enter a valid stop price greater than 0.",
        variant: "destructive",
      });
      return;
    }

    const orderData = {
      userId,
      symbol,
      qty: parseFloat(quantity),
      side,
      type: orderType,
      time_in_force: timeInForce,
    };

    if (orderType === 'limit' && limitPrice) {
      orderData['limit_price'] = parseFloat(limitPrice);
    }

    if (orderType === 'stop' && stopPrice) {
      orderData['stop_price'] = parseFloat(stopPrice);
    }

    onSubmitOrder(orderData);
    
    // Reset form fields
    setQuantity('');
    if (orderType === 'limit') setLimitPrice('');
    if (orderType === 'stop') setStopPrice('');
  };

  return (
    <div className="col-span-12 lg:col-span-4 bg-[#1E2130] rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-[#2D3748]">
        <h2 className="text-white font-medium">Manual Trading</h2>
      </div>
      
      <div className="p-4">
        <div className="flex mb-4">
          <button
            className={`flex-1 py-2 rounded-l font-medium ${
              side === 'buy' ? 'bg-[#00C853] text-white' : 'bg-[#121722] text-[#B7BDC6]'
            }`}
            onClick={() => setSide('buy')}
          >
            BUY
          </button>
          <button
            className={`flex-1 py-2 rounded-r font-medium ${
              side === 'sell' ? 'bg-[#FF3B30] text-white' : 'bg-[#121722] text-[#B7BDC6]'
            }`}
            onClick={() => setSide('sell')}
          >
            SELL
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label className="block text-[#B7BDC6] mb-1 text-sm">Symbol</Label>
            <Select value={symbol} onValueChange={(value) => setSymbol(value as TradeSymbol)}>
              <SelectTrigger className="w-full bg-[#121722] border-[#2D3748] text-white">
                <SelectValue placeholder="Select symbol" />
              </SelectTrigger>
              <SelectContent className="bg-[#1E2130] border-[#2D3748] text-white">
                <SelectItem value="BTCUSD">BTC/USD</SelectItem>
                <SelectItem value="ETHUSD">ETH/USD</SelectItem>
                <SelectItem value="SOLUSD">SOL/USD</SelectItem>
                <SelectItem value="AVAXUSD">AVAX/USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="block text-[#B7BDC6] mb-1 text-sm">Order Type</Label>
            <Select value={orderType} onValueChange={(value) => setOrderType(value as OrderType)}>
              <SelectTrigger className="w-full bg-[#121722] border-[#2D3748] text-white">
                <SelectValue placeholder="Select order type" />
              </SelectTrigger>
              <SelectContent className="bg-[#1E2130] border-[#2D3748] text-white">
                <SelectItem value="market">Market</SelectItem>
                <SelectItem value="limit">Limit</SelectItem>
                <SelectItem value="stop">Stop</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="block text-[#B7BDC6] mb-1 text-sm">Quantity</Label>
            <Input
              type="number"
              step="0.001"
              placeholder="0.00"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-[#121722] border-[#2D3748] text-white"
            />
          </div>
          
          {orderType === 'limit' && (
            <div>
              <Label className="block text-[#B7BDC6] mb-1 text-sm">Limit Price</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                min="0"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="w-full bg-[#121722] border-[#2D3748] text-white"
              />
            </div>
          )}
          
          {orderType === 'stop' && (
            <div>
              <Label className="block text-[#B7BDC6] mb-1 text-sm">Stop Price</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                min="0"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                className="w-full bg-[#121722] border-[#2D3748] text-white"
              />
            </div>
          )}
          
          <div>
            <Label className="block text-[#B7BDC6] mb-1 text-sm">Time In Force</Label>
            <Select value={timeInForce} onValueChange={(value) => setTimeInForce(value as TimeInForce)}>
              <SelectTrigger className="w-full bg-[#121722] border-[#2D3748] text-white">
                <SelectValue placeholder="Select time in force" />
              </SelectTrigger>
              <SelectContent className="bg-[#1E2130] border-[#2D3748] text-white">
                <SelectItem value="gtc">Good Till Cancelled</SelectItem>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="ioc">Immediate or Cancel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="pt-2">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`w-full py-2 rounded font-medium ${
                side === 'buy' ? 'bg-[#00C853]' : 'bg-[#FF3B30]'
              } text-white hover:opacity-90`}
            >
              {isSubmitting ? 'PROCESSING...' : 'PLACE ORDER'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
