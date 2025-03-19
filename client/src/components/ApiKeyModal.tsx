import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string, secretKey: string, environment: 'paper' | 'live') => void;
  isSaving: boolean;
  environment: 'paper' | 'live';
}

export function ApiKeyModal({ isOpen, onClose, onSave, isSaving, environment }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [selectedEnvironment, setSelectedEnvironment] = useState<'paper' | 'live'>(environment);
  const { toast } = useToast();

  const handleSubmit = () => {
    // Check if this is a test mode submission
    const isTestMode = apiKey === 'TEST_KEY' || secretKey === 'TEST_KEY';
    
    if (!isTestMode && (!apiKey || !secretKey)) {
      toast({
        title: 'Missing Fields',
        description: 'Please enter both API Key and Secret Key',
        variant: 'destructive'
      });
      return;
    }
    
    // Always use TEST_KEY for both if one is specified
    if (isTestMode) {
      onSave('TEST_KEY', 'TEST_KEY', selectedEnvironment);
      toast({
        title: 'Test Mode Activated',
        description: 'Using test mode with simulated trading data',
        variant: 'default'
      });
    } else {
      onSave(apiKey, secretKey, selectedEnvironment);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1E2130] border-[#2D3748] text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-white">Configure Alpaca API Keys</DialogTitle>
          <DialogDescription className="text-[#B7BDC6]">
            Enter your Alpaca API credentials to connect to the trading platform.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              onClick={() => setSelectedEnvironment('paper')}
              className={`flex-1 py-2 text-sm font-medium rounded-l ${
                selectedEnvironment === 'paper' 
                  ? 'bg-[#2962FF] text-white' 
                  : 'bg-[#121722] text-[#B7BDC6]'
              }`}
            >
              Paper Trading
            </button>
            <button
              onClick={() => setSelectedEnvironment('live')}
              className={`flex-1 py-2 text-sm font-medium rounded-r ${
                selectedEnvironment === 'live' 
                  ? 'bg-[#2962FF] text-white' 
                  : 'bg-[#121722] text-[#B7BDC6]'
              }`}
            >
              Live Trading
            </button>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="api-key" className="text-[#B7BDC6]">
              API Key
            </Label>
            <Input
              id="api-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-[#121722] border-[#2D3748] text-white"
              placeholder="PK12345ABCDEFGHIJKLMN"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="secret-key" className="text-[#B7BDC6]">
              Secret Key
            </Label>
            <Input
              id="secret-key"
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="bg-[#121722] border-[#2D3748] text-white"
              placeholder="Enter your secret key"
            />
          </div>
          
          <div className="text-xs text-[#B7BDC6] mt-2">
            <p>You can generate API keys from the <a href="https://app.alpaca.markets/paper/dashboard/overview" target="_blank" rel="noopener noreferrer" className="text-[#2962FF] hover:underline">Alpaca Dashboard</a>.</p>
            <p className="mt-1">Make sure to use the proper keys for {selectedEnvironment === 'paper' ? 'paper' : 'live'} trading.</p>
            <p className="mt-1 text-[#00C853]">Tip: Enter "TEST_KEY" in either field to use test mode with simulated data.</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            className="bg-transparent border-[#2D3748] text-white hover:bg-[#2D3748] hover:text-white"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSaving}
            className="bg-[#2962FF] text-white hover:bg-[#1E53E5]"
          >
            {isSaving ? 'Saving...' : 'Save Keys'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
