"use client";
import { StockCard } from "@/components/ui/stock-card";

// Sample data for demonstration
const stocksData = [
  {
    logoSrc: "https://logo.clearbit.com/google.com",
    ticker: "GOOG",
    name: "Alphabet Inc.",
    price: 156.06,
    change: 4.89,
  },
  {
    logoSrc: "https://logo.clearbit.com/nvidia.com",
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    price: 19270.30,
    change: -1.35,
  },
  {
    logoSrc: "https://logo.clearbit.com/apple.com",
    ticker: "AAPL",
    name: "Apple Inc.",
    price: 217.90,
    change: 2.66,
  },
  {
    logoSrc: "https://logo.clearbit.com/starbucks.com",
    ticker: "SBUX",
    name: "Starbucks Corporation",
    price: 97.73,
    change: 1.13,
  },
  {
    logoSrc: "https://logo.clearbit.com/nike.com",
    ticker: "NKE",
    name: "Nike, Inc.",
    price: 63.29,
    change: -3.81,
  },
];

export default function StockCardDemo() {
  // Handler for the buy action
  const handleBuyStock = (ticker: string) => {
    alert(`Initiating buy for ${ticker}...`);
  };

  return (
    <div className="w-full bg-background p-8 flex items-center justify-center">
      <div className="flex flex-col gap-4">
        {stocksData.map((stock) => (
          <StockCard
            key={stock.ticker}
            logoSrc={stock.logoSrc}
            ticker={stock.ticker}
            name={stock.name}
            price={stock.price}
            change={stock.change}
            onBuy={handleBuyStock}
          />
        ))}
      </div>
    </div>
  );
}