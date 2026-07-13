import type { Metadata } from "next";
import feedData from "../public/data/latest.json";
import { Dashboard, type FeedData } from "./Dashboard";

export const metadata: Metadata = {
  title: "Infomap — Daily AI & Technology Signals",
  description:
    "A daily, source-aware briefing of the most useful signals in AI and technology.",
};

export default function Home() {
  return <Dashboard feed={feedData as FeedData} />;
}
