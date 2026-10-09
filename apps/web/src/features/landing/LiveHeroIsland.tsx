"use client";
/** The live hero as an island: none of its code is in the landing's first load; a quiet frame holds its place. */
import dynamic from "next/dynamic";
import "./live-hero.css";

const LiveHero = dynamic(() => import("./LiveHero"), {
  ssr: false,
  loading: () => <div className="live-hero live-hero-waiting dark" aria-hidden />,
});

export function LiveHeroIsland() {
  return <LiveHero />;
}
