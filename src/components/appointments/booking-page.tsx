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
  ArrowLeft,
  Paperclip,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  getBookingLinkBySlug,
  getAvailableSlotsBySlug,
  bookAppointmentByLink,
  type AppointmentType,
  type BookingLink,
  type BookingQuestion,
  type BookingAnswer,
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
  const [link, setLink] = useState<BookingLink | null>(null);
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [selectedType, setSelectedType] = useState<AppointmentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking flow state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<{ start: string; end: string }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Client info
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [fileUploads, setFileUploads] = useState<Record<string, { url: string; name: string }>>({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [showQuestions, setShowQuestions] = useState(false);

  async function handleFileUpload(questionId: string, file: File) {
    setUploadingFiles((prev) => ({ ...prev, [questionId]: true }));
    setError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${slug}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("booking-attachments")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        setUploadingFiles((prev) => ({ ...prev, [questionId]: false }));
        return;
      }
      const { data: pub } = supabase.storage.from("booking-attachments").getPublicUrl(path);
      setFileUploads((prev) => ({ ...prev, [questionId]: { url: pub.publicUrl, name: file.name } }));
    } catch (e: any) {
      setError(`Upload failed: ${e?.message ?? "unknown error"}`);
    }
    setUploadingFiles((prev) => ({ ...prev, [questionId]: false }));
  }

  useEffect(() => {
    (async () => {
      const { data, error } = await getBookingLinkBySlug(slug);
      if (error || !data) {
        setError(error || "Booking link not found");
        setLoading(false);
        return;
      }
      setLink(data.link);
      setTypes(data.types);
      // If only one type, auto-select it
      if (data.types.length === 1) {
        setSelectedType(data.types[0]);
        setShowQuestions((data.types[0].questions ?? []).length > 0);
      }
      setLoading(false);
    })();
  }, [slug]);

  // Load slots when a date is selected
  useEffect(() => {
    if (!selectedDate || !selectedType) return;
    setLoadingSlots(true);
    setSelectedSlot(null);

    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    (async () => {
      const { data } = await getAvailableSlotsBySlug(
        slug,
        selectedType.id,
        dayStart.toISOString(),
        dayEnd.toISOString()
      );
      setSlots(data ?? []);
      setLoadingSlots(false);
    })();
  }, [selectedDate, selectedType, slug]);

  async function handleBook() {
    if (!selectedSlot || !clientFirstName.trim() || !clientEmail.trim() || !selectedType) return;
    setBooking(true);
    const slot = slots.find((s) => s.start === selectedSlot);
    if (!slot) {
      setBooking(false);
      return;
    }
    const { error } = await bookAppointmentByLink(slug, {
      start_time: slot.start,
      end_time: slot.end,
      client_first_name: clientFirstName,
      client_last_name: clientLastName,
      client_email: clientEmail,
      client_phone: clientPhone || undefined,
      appointment_type_id: selectedType.id,
      booking_answers: (selectedType.questions ?? []).map((q): BookingAnswer => {
        if (q.type === "file") {
          const f = fileUploads[q.id];
          return {
            question_id: q.id,
            label: q.label,
            answer: f?.name ?? "",
            type: "file",
            file_url: f?.url,
            file_name: f?.name,
          };
        }
        return {
          question_id: q.id,
          label: q.label,
          answer: questionAnswers[q.id] ?? "",
          type: q.type,
        };
      }).filter((a) => a.answer || a.file_url),
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error || "Booking link not found"}</p>
      </div>
    );
  }

  if (booked && selectedType) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
          <Check className="h-8 w-8 text-emerald-400" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold">Appointment booked!</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedType.name} with {clientFirstName} {clientLastName}
          </p>
          <p className="text-sm text-muted-foreground">
            {selectedDate && new Date(selectedSlot!).toLocaleString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: selectedType.timezone || "America/New_York",
              timeZoneName: "short",
            })}
          </p>
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-sm">
          A calendar invitation has been sent to {clientEmail}.
        </p>
      </div>
    );
  }

  // Step 0: Select appointment type (if multiple)
  if (!selectedType) {
    return (
      <div className="min-h-[60vh] bg-background py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold">{link.title}</h1>
            {link.description && (
              <p className="text-sm text-muted-foreground">{link.description}</p>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Choose an appointment type</h2>
            {types.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No appointment types available.
              </p>
            ) : (
              types.map((t) => {
                const Icon = MEETING_TYPE_ICONS[t.meeting_type] ?? Video;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedType(t);
                      setShowQuestions((t.questions ?? []).length > 0);
                      setQuestionAnswers({});
                      setFileUploads({});
                    }}
                    className="w-full flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/20 transition-colors"
                  >
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: (t.color ?? "#6366f1") + "20" }}
                    >
                      <Icon className="h-5 w-5" style={{ color: t.color ?? "#6366f1" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold">{t.name}</h3>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {t.duration_min} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon className="h-3 w-3" />
                          {t.meeting_type === "video" ? "Video" : t.meeting_type === "phone" ? "Phone" : "In Person"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  const Icon = MEETING_TYPE_ICONS[selectedType.meeting_type] ?? Video;

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
  const maxDate = new Date(today.getTime() + selectedType.max_days_ahead * 24 * 60 * 60 * 1000);

  return (
    <div className="min-h-[60vh] bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          {types.length > 1 && (
            <button
              onClick={() => { setSelectedType(null); setSelectedDate(null); setSelectedSlot(null); setShowQuestions(false); setQuestionAnswers({}); setFileUploads({}); }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to appointment types
            </button>
          )}
          <div className="flex items-center justify-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: selectedType.color ?? "#6366f1" }}
            />
            <h1 className="text-xl font-bold">{selectedType.name}</h1>
          </div>
          {selectedType.description && (
            <p className="text-sm text-muted-foreground">{selectedType.description}</p>
          )}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {selectedType.duration_min} min
            </span>
            <span className="flex items-center gap-1">
              <Icon className="h-3.5 w-3.5" />
              {selectedType.meeting_type === "video" ? "Video" : selectedType.meeting_type === "phone" ? "Phone" : "In Person"}
            </span>
          </div>
        </div>

        {/* Step 1: Custom questions (if any) */}
        {showQuestions && (selectedType.questions ?? []).length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <h2 className="text-sm font-semibold">Quick Questions</h2>
            {(selectedType.questions ?? []).map((q) => (
              <div key={q.id} className="space-y-1.5">
                <Label className="text-xs">
                  {q.label}
                      {q.required && <span className="text-red-400 ml-0.5">*</span>}
                </Label>
                {q.type === "textarea" ? (
                  <Textarea
                    value={questionAnswers[q.id] ?? ""}
                    onChange={(e) => setQuestionAnswers({ ...questionAnswers, [q.id]: e.target.value })}
                    placeholder="Your answer"
                    rows={3}
                  />
                ) : q.type === "select" ? (
                  <select
                    value={questionAnswers[q.id] ?? ""}
                    onChange={(e) => setQuestionAnswers({ ...questionAnswers, [q.id]: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <option value="">Select an option</option>
                    {(q.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : q.type === "file" ? (
                  <div>
                    {fileUploads[q.id] ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate flex-1">{fileUploads[q.id].name}</span>
                        <button
                          onClick={() => setFileUploads((prev) => {
                            const next = { ...prev };
                            delete next[q.id];
                            return next;
                          })}
                          className="text-muted-foreground hover:text-red-400 shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-card px-3 py-2.5 text-sm text-muted-foreground cursor-pointer hover:border-indigo-500/50 hover:text-foreground transition-colors">
                        {uploadingFiles[q.id] ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                        ) : (
                          <><Paperclip className="h-4 w-4" /> Choose a file</>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          disabled={uploadingFiles[q.id]}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(q.id, file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                ) : (
                  <Input
                    value={questionAnswers[q.id] ?? ""}
                    onChange={(e) => setQuestionAnswers({ ...questionAnswers, [q.id]: e.target.value })}
                    placeholder="Your answer"
                  />
                )}
              </div>
            ))}
            <Button
              onClick={() => setShowQuestions(false)}
              disabled={
                Object.values(uploadingFiles).some(Boolean) ||
                (selectedType.questions ?? []).some((q) =>
                  q.required && (q.type === "file"
                    ? !fileUploads[q.id]
                    : !(questionAnswers[q.id] ?? "").trim())
                )
              }
              className="w-full gap-2"
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 2: Select date */}
        {(!showQuestions || (selectedType.questions ?? []).length === 0) && (
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
        )}

        {/* Step 3: Select time slot */}
        {selectedDate && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">
              Available times — {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            <p className="text-xs text-muted-foreground -mt-1">
              Times shown in {(selectedType.timezone || "America/New_York").replace(/_/g, " ")}
            </p>
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
                    {new Date(slot.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: selectedType.timezone || "America/New_York" })}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Enter details */}
        {selectedSlot && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">Your details</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">First Name *</Label>
                <Input value={clientFirstName} onChange={(e) => setClientFirstName(e.target.value)} placeholder="John" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Last Name</Label>
                <Input value={clientLastName} onChange={(e) => setClientLastName(e.target.value)} placeholder="Doe" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Your phone number" />
            </div>
            <Button onClick={handleBook} disabled={booking || !clientFirstName.trim() || !clientEmail.trim()} className="w-full gap-2">
              {booking && <Loader2 className="h-4 w-4 animate-spin" />}
              Book Appointment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
