"use client";

import { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  Phone,
  MapPin,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  getAppointmentTypeBySlug,
  getAvailableSlots,
  bookAppointmentByLink,
  type AppointmentType,
} from "@/app/actions/appointments";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MEETING_TYPE_ICONS: Record<string, typeof Video> = {
  video: Video,
  phone: Phone,
  in_person: MapPin,
};

export function BookingPage({ slug }: { slug: string }) {
  const [apptType, setApptType] = useState<AppointmentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking flow state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<{ start: string; end: string }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Client info
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await getAppointmentTypeBySlug(slug);
      if (error || !data) {
        setError(error || "Appointment type not found");
        setLoading(false);
        return;
      }
      setApptType(data);
      setLoading(false);
    })();
  }, [slug]);

  // Load slots when a date is selected
  useEffect(() => {
    if (!selectedDate || !apptType) return;
    setLoadingSlots(true);
    setSelectedSlot(null);

    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    (async () => {
      const { data } = await getAvailableSlots(
        apptType.id,
        dayStart.toISOString(),
        dayEnd.toISOString()
      );
      setSlots(data ?? []);
      setLoadingSlots(false);
    })();
  }, [selectedDate, apptType]);

  async function handleBook() {
    if (!selectedSlot || !clientName.trim() || !clientEmail.trim()) return;
    setBooking(true);
    const slot = slots.find((s) => s.start === selectedSlot);
    if (!slot) {
      setBooking(false);
      return;
    }
    const { error } = await bookAppointmentByLink(slug, {
      start_time: slot.start,
      end_time: slot.end,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone || undefined,
    });
    setBooking(false);
    if (error) {
      setError(error);
      return;
    }
    setBooked(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !apptType) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error || "Appointment type not found"}</p>
      </div>
    );
  }

  if (booked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
          <Check className="h-8 w-8 text-emerald-400" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold">Appointment booked!</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {apptType.name} with {clientName}
          </p>
          <p className="text-sm text-muted-foreground">
            {selectedDate && new Date(selectedSlot!).toLocaleString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-sm">
          A calendar invitation has been sent to {clientEmail}.
        </p>
      </div>
    );
  }

  const Icon = MEETING_TYPE_ICONS[apptType.meeting_type] ?? Video;

  // Calendar grid
  const calendarDays: (Date | null)[] = [];
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  for (let i = 0; i < startOffset; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(new Date(year, month, d));
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today.getTime() + apptType.max_days_ahead * 24 * 60 * 60 * 1000);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: apptType.color ?? "#6366f1" }}
            />
            <h1 className="text-xl font-bold">{apptType.name}</h1>
          </div>
          {apptType.description && (
            <p className="text-sm text-muted-foreground">{apptType.description}</p>
          )}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {apptType.duration_min} min
            </span>
            <span className="flex items-center gap-1">
              <Icon className="h-3.5 w-3.5" />
              {apptType.meeting_type === "video" ? "Video" : apptType.meeting_type === "phone" ? "Phone" : "In Person"}
            </span>
          </div>
        </div>

        {/* Step 1: Select date */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-sm font-semibold">Select a date</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {MONTH_NAMES[month]} {year}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border">
            {DAY_NAMES.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((date, i) => {
              if (!date) {
                return <div key={i} className="min-h-[48px] border-b border-r border-border" />;
              }
              const isPast = date < today;
              const isTooFar = date > maxDate;
              const isDisabled = isPast || isTooFar;
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              const isToday = date.toDateString() === today.toDateString();
              return (
                <button
                  key={i}
                  disabled={isDisabled}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    "min-h-[48px] border-b border-r border-border text-sm transition-colors",
                    isDisabled && "text-muted-foreground/30 cursor-not-allowed",
                    !isDisabled && "hover:bg-indigo-500/10",
                    isSelected && "bg-indigo-500 text-white hover:bg-indigo-500",
                    isToday && !isSelected && "text-indigo-400 font-bold"
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Select time slot */}
        {selectedDate && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">
              Available times — {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            {loadingSlots ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No available slots on this day. Try another date.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.start}
                    onClick={() => setSelectedSlot(slot.start)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition-colors",
                      selectedSlot === slot.start
                        ? "border-indigo-500 bg-indigo-500 text-white"
                        : "border-border hover:bg-indigo-500/10"
                    )}
                  >
                    {new Date(slot.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Enter details */}
        {selectedSlot && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">Your details</h2>
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone (optional)</Label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Your phone number" />
            </div>
            <Button onClick={handleBook} disabled={booking || !clientName.trim() || !clientEmail.trim()} className="w-full gap-2">
              {booking && <Loader2 className="h-4 w-4 animate-spin" />}
              Book Appointment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
