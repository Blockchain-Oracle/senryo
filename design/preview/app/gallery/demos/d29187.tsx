"use client";
import WalletCard from "@/components/ui/wallet-card";

const accounts = [
  {
    id: "1",
    label: "Everyday",
    balance: 4231.89,
    currency: "USD",
    last4: "4242",
    holder: "Alex Rivera",
    expiry: "08/29",
    network: "visa" as const,
  },
  {
    id: "2",
    label: "Savings",
    balance: 18042.5,
    currency: "USD",
    last4: "9981",
    holder: "Alex Rivera",
    expiry: "03/28",
    network: "mastercard" as const,
    gradient:
      "bg-[linear-gradient(145deg,oklch(0.5_0.09_180),oklch(0.28_0.05_180))]",
  },
  {
    id: "3",
    label: "Business",
    balance: 902.4,
    currency: "USD",
    last4: "1120",
    holder: "Alex Rivera",
    expiry: "11/27",
    network: "amex" as const,
    gradient:
      "bg-[linear-gradient(145deg,oklch(0.45_0.09_35),oklch(0.24_0.05_35))]",
  },
];

const members = [
  {
    id: "m1",
    name: "Alex Rivera",
    avatar: "https://cdn.21st.dev/assets/stock/avatar/ar.svg",
  },
  {
    id: "m2",
    name: "Jamie Morgan",
    avatar: "https://cdn.21st.dev/assets/stock/avatar/jm.svg",
  },
  {
    id: "m3",
    name: "Sam Kim",
    avatar: "https://cdn.21st.dev/assets/stock/avatar/sk.svg",
  },
];

export default function Demo() {
  return (
    <div className="flex w-full max-w-sm items-center justify-center p-6">
      <WalletCard accounts={accounts} members={members} />
    </div>
  );
}
