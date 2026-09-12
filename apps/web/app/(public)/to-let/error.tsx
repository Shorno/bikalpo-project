"use client";
import { Button } from "@/components/ui/button";
export default function ToLetError({ reset }: { reset: () => void }) {
  return <div className="site-container px-4 py-12" role="alert"><h2 className="text-xl font-semibold">To-Let page লোড করা যায়নি।</h2><Button className="mt-4" onClick={reset}>আবার চেষ্টা করুন</Button></div>;
}
