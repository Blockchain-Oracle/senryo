"use client";
import { CurrencyExchangeCard, Currency } from "@/components/ui/currency-exchange-card";

// --- DEMO DATA ---
const sampleCurrencies: Currency[] = [
  {
    code: "USD",
    name: "US Dollar",
    flag: "https://cdn.21st.dev/assets/mirror/e1/e1792c011daad918fdbd99a21f7f46fd71018ffd052af5a7d7faf9954d593e31.svg",
  },
  {
    code: "EUR",
    name: "Euro",
    flag: "https://cdn.21st.dev/assets/mirror/cf/cf15767517ce6ab1fc46a41b07fa66be2ab3db8085216be5abd43c1fbf36243d.svg",
  },
  {
    code: "GBP",
    name: "British Pound",
    flag: "https://cdn.21st.dev/assets/mirror/42/42f04826dd7a76e4ecdc9a55fb4a774a26e03a425ca1363628bb1c6f6ea1a87e.svg",
  },
  {
    code: "JPY",
    name: "Japanese Yen",
    flag: "https://cdn.21st.dev/assets/mirror/e8/e8e6f6e75bc02eeb35e5904edc13df9b5990da70ac1ff1daa7a9fcc61c709a03.svg",
  },
];

const CurrencyExchangeDemo = () => {
  // --- DEMO HANDLER ---
  const handleExchange = (data: { from: Currency; to: Currency; amount: number; total: number }) => {
    alert(
      `Exchanged ${data.amount} ${data.from.code} to ${data.total.toFixed(2)} ${data.to.code}`
    );
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-4">
      <CurrencyExchangeCard
        currencies={sampleCurrencies}
        initialFromCurrency={sampleCurrencies[0]} // USD
        initialToCurrency={sampleCurrencies[1]} // EUR
        availableBalance={16058.94}
        exchangeRate={0.94} // 1 USD = 0.94 EUR
        taxRate={0.02} // 2%
        feeRate={0.01} // 1%
        onExchange={handleExchange}
      />
    </div>
  );
};

export default CurrencyExchangeDemo;