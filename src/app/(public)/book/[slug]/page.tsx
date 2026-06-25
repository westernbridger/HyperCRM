"use client";

import { useParams } from "next/navigation";
import { BookingPage } from "@/components/appointments/booking-page";

export default function Book() {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <div className="flex-1">
      <BookingPage slug={slug} />
    </div>
  );
}
