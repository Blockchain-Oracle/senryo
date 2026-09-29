"use client";
// demo.tsx
import * as React from "react";
import { CryptoCard } from "@/components/ui/asset-card";

// Placeholder SVG for Hedera (HBAR)
const HbarIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5"/>
        <path d="M8 8V16H10V8H8ZM14 8V16H16V8H14Z" fill="white"/>
    </svg>
);

// Placeholder SVG for Ethereum (ETH)
const EthIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 1.75L11.64 2.45L4.5 12.25L12 16L19.5 12.25L12.36 2.45L12 1.75Z" fill="white" fillOpacity="0.6"/>
        <path d="M12 17.25L4.5 13.25L12 22.25L19.5 13.25L12 17.25Z" fill="white"/>
    </svg>
);


const CryptoCardDemo = () => {
  return (
    <div className="w-full h-screen bg-background flex flex-col md:flex-row items-center justify-center gap-8 p-4">
      {/* Example 1: Negative Change (based on your image) */}
      <CryptoCard
        icon={<HbarIcon />}
        name="Hedera"
        ticker="USDT"
        percentageChange={-10.35}
        currentPrice={0.0607}
        portfolioValue={13590.00}
        portfolioChange={-2493}
        leverage={10}
        gradientFrom="from-red-600"
      />

      {/* Example 2: Positive Change */}
      <CryptoCard
        icon={<EthIcon />}
        name="Ethereum"
        ticker="USDT"
        percentageChange={5.18}
        currentPrice={3801.44}
        portfolioValue={22450.80}
        portfolioChange={1120.50}
        leverage={5}
        gradientFrom="from-green-600"
      />
    </div>
  );
};

export default CryptoCardDemo;