"use client";
import { StockPortfolioCard } from "@/components/ui/stock-portfolio-card"; // Adjust the import path

const Demo = () => {
  // Sample data to populate the component
  const portfolioData = {
    totalGain: 5849.05,
    returnPercentage: 110.28,
    asOfDate: "Nov 24, 2024",
    holdings: [
      {
        ticker: "AAPL",
        name: "Apple Inc.",
        shares: 10,
        lastPrice: 2324.70,
        changeValue: 2.25,
        changePercent: 0.097,
      },
      {
        ticker: "META",
        name: "Meta Platforms Inc.",
        shares: 5,
        lastPrice: 3524.35,
        changeValue: -91.98,
        changePercent: 2.6,
      },
      {
        ticker: "TSLA",
        name: "Tesla, Inc.",
        shares: 15,
        lastPrice: 1805.60,
        changeValue: 45.10,
        changePercent: 2.56,
      },
    ],
    news: [
      {
        category: "AI",
        time: "7 min ago",
        title: "Tokyo Electron Plans Expansion Despite AI Spending Doubts",
        source: "Bloomberg",
      },
      {
        category: "Big Tech",
        time: "25 min ago",
        title: "Apple Debuts New M4 Chips, Focuses on AI Changes in iOS 19",
        source: "Reuters",
      },
      {
        category: "Markets",
        time: "1 hr ago",
        title: "Federal Reserve Signals Potential Pause in Rate Hikes Amidst Inflation Data",
        source: "Wall Street Journal",
      },
    ],
  };

  return (
    <div className="flex items-center justify-center bg-background p-4 sm:p-8">
      <StockPortfolioCard
        totalGain={portfolioData.totalGain}
        returnPercentage={portfolioData.returnPercentage}
        asOfDate={portfolioData.asOfDate}
        holdings={portfolioData.holdings}
        news={portfolioData.news}
      />
    </div>
  );
};

export default Demo;