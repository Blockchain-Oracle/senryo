"use client";
import { FlippableCreditCard } from "@/components/ui/credit-debit-card";

export default function FlippableCreditCardDemo() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-background p-8">
      <FlippableCreditCard
        cardholderName="RAVI KATIYAR"
        // It's a good practice to show masked numbers in demos.
        cardNumber="•••• •••• •••• 1939" 
        expiryDate="12/27"
        cvv="987"
      />
    </div>
  );
}