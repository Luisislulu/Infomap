import type { Metadata } from "next";
import feedData from "../public/data/latest.json";
import { Dashboard, type FeedData } from "./Dashboard";

export const metadata: Metadata = {
  title: "Infomap — Daily AI & Technology Signals",
  description:
    "A daily, source-aware briefing of useful signals in AI, technology, business, and markets.",
};

export default function Home() {
  return <Dashboard feed={feedData as FeedData} />;
}
