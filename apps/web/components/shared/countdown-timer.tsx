"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface CountdownTimerProps {
  targetDate: Date;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - new Date().getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className="flex items-center gap-1.5">
      <TimeUnit value={timeLeft.days} unit="D" />
      <span className="text-white font-bold">:</span>
      <TimeUnit value={timeLeft.hours} unit="H" />
      <span className="text-white font-bold">:</span>
      <TimeUnit value={timeLeft.minutes} unit="M" />
      <span className="text-white font-bold">:</span>
      <TimeUnit value={timeLeft.seconds} unit="S" />
    </div>
  );
}

function TimeUnit({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex flex-col items-center">
      <Badge className="bg-white text-primary font-bold text-xs px-2 py-1 min-w-[32px] justify-center">
        {String(value).padStart(2, "0")}
      </Badge>
      <span className="text-[9px] text-white font-medium mt-0.5">{unit}</span>
    </div>
  );
}
