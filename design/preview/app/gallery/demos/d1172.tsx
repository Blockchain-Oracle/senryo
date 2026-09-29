"use client"

import { CreditCard } from "@/components/ui/credit-card"

function DefaultCreditCardDemo() {
  return (
    <div className="flex items-center justify-center p-8">
      <CreditCard
        cardNumber="4111 1111 1111 9743"
        cardHolder="John Doe"
        expiryDate="12/24"
      />
    </div>
  )
}

function DarkCreditCardDemo() {
  return (
    <div className="flex items-center justify-center p-8">
      <CreditCard
        variant="dark"
        cardNumber="5555 4444 3333 2222"
        cardHolder="Jane Smith"
        expiryDate="06/25"
      />
    </div>
  )
}

export { DefaultCreditCardDemo, DarkCreditCardDemo }
export default DefaultCreditCardDemo;
