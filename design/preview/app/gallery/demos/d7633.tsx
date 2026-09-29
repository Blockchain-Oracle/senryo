"use client";
// demo.tsx
import * as React from "react";
import { CreditCard, Landmark } from "lucide-react";
import { Account, WithdrawalCard } from "@/components/ui/card-5";

// Mock data for the accounts, matching the Account interface
const mockAccounts: Account[] = [
  {
    id: "acc_1",
    initials: "BA",
    name: "Bank Account",
    details: "**** - **** - 0945",
    icon: <Landmark className="h-5 w-5" />, // Fallback icon
  },
  {
    id: "acc_2",
    initials: "CC",
    name: "Credit Card",
    details: "**** - **** - 3289",
    icon: <CreditCard className="h-5 w-5" />, // Fallback icon
  },
];

export default function WithdrawalCardDemo() {
  // Handler for the withdraw action
  const handleWithdraw = (selectedAccountId: string) => {
    const selectedAccount = mockAccounts.find(acc => acc.id === selectedAccountId);
    console.log(`Withdrawing from: ${selectedAccount?.name} (${selectedAccountId})`);
    // Here you would typically trigger an API call or other logic
    // For demo, we just log to the console.
    alert(`Withdrawal initiated from ${selectedAccount?.name}!`);
  };

  return (
    <div className="flex h-full min-h-[600px] w-full items-center justify-center bg-background p-4">
      <WithdrawalCard
        amount={535000}
        availableBalance={785000}
        currency="IDR"
        accounts={mockAccounts}
        defaultSelectedAccountId="acc_1"
        onWithdraw={handleWithdraw}
      />
    </div>
  );
}