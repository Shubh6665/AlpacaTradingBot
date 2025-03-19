import { ExternalLink } from 'lucide-react';

export function ApiLinks() {
  const links = [
    {
      title: "Getting Started",
      description: "Alpaca API introduction and setup guide",
      url: "https://docs.alpaca.markets/docs/getting-started"
    },
    {
      title: "Crypto Data Streaming",
      description: "Real-time crypto price data via WebSockets",
      url: "https://docs.alpaca.markets/docs/real-time-crypto-pricing-data"
    },
    {
      title: "REST API Reference",
      description: "Complete REST API endpoint documentation",
      url: "https://alpaca.markets/docs/api-documentation/api-v2/"
    }
  ];

  return (
    <div className="col-span-12 bg-[#1E2130] rounded-lg shadow p-4">
      <h2 className="text-white font-medium mb-3">API Documentation</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {links.map((link, index) => (
          <a 
            key={index}
            href={link.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-[#121722] rounded p-3 hover:border-[#2962FF] border border-[#2D3748] transition-colors group"
          >
            <div className="flex justify-between">
              <h3 className="text-white font-medium">{link.title}</h3>
              <ExternalLink className="h-4 w-4 text-[#B7BDC6] group-hover:text-[#2962FF]" />
            </div>
            <p className="text-[#B7BDC6] text-sm mt-1">{link.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
