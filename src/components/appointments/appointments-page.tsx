"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  Video,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarPlus,
  Link2,
  Settings2,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  getCalendarConnections,
  connectGoogleCalendar,
  disconnectCalendar,
  getAppointmentTypes,
  createAppointmentType,
  updateAppointmentType,
  deleteAppointmentType,
  getAppointments,
  createAppointment,
  updateAppointmentStatus,
  updateAppointment,
  deleteAppointment,
  getBookingLinks,
  createBookingLink,
  deleteBookingLink,
  type CalendarConnection,
  type AppointmentType,
  type Appointment,
  type BookingLink,
  type BookingQuestion,
} from "@/app/actions/appointments";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  no_show: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const MEETING_TYPE_ICONS: Record<string, typeof Video> = {
  video: Video,
  phone: Phone,
  in_person: MapPin,
};

export function AppointmentsPage() {
  const [tab, setTab] = useState("calendar");
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bookingLinks, setBookingLinks] = useState<BookingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Dialogs
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [showNewType, setShowNewType] = useState(false);
  const [editType, setEditType] = useState<AppointmentType | null>(null);
  const [showNewLink, setShowNewLink] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [connRes, typesRes, apptsRes, linksRes] = await Promise.all([
      getCalendarConnections(),
      getAppointmentTypes(),
      getAppointments(),
      getBookingLinks(),
    ]);
    setConnections(connRes.data ?? []);
    setAppointmentTypes(typesRes.data ?? []);
    setAppointments(apptsRes.data ?? []);
    setBookingLinks(linksRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check for OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    const connectedParam = params.get("connected");
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        oauth_denied: "You denied the Google Calendar connection.",
        oauth_failed: "Google OAuth failed — no code or state returned.",
        invalid_state: "Invalid state parameter. Try connecting again.",
        no_tokens: "Failed to get access tokens from Google.",
        db_error: "Failed to save calendar connection to database.",
        callback_exception: "An unexpected error occurred during Google OAuth.",
      };
      const baseMsg = errorMessages[errorParam] ?? `OAuth error: ${errorParam}`;
      const detail = params.get("detail");
      setOauthError(detail ? `${baseMsg} — ${detail}` : baseMsg);
      window.history.replaceState({}, "", "/appointments");
    } else if (connectedParam) {
      loadData();
      window.history.replaceState({}, "", "/appointments");
    }
  }, [loadData]);

  const handleConnectGoogle = async () => {
    setConnecting(true);
    const { url, error } = await connectGoogleCalendar();
    if (url) {
      window.location.href = url;
    } else {
      alert(error || "Failed to connect Google Calendar");
      setConnecting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    await disconnectCalendar(id);
    loadData();
  };

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/book/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  // Calendar grid logic
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);

    return days;
  }, [currentMonth]);

  const getAppointmentsForDay = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return appointments.filter((a) => {
      const start = new Date(a.start_time);
      return start >= dayStart && start <= dayEnd && a.status !== "cancelled";
    });
  };

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return appointments
      .filter((a) => new Date(a.start_time) >= now && a.status !== "cancelled")
      .slice(0, 10);
  }, [appointments]);

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your calendar, booking links, and appointment types.
          </p>
        </div>
        <Button onClick={() => setShowNewAppt(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Appointment
        </Button>
      </div>

      {/* OAuth error banner */}
      {oauthError && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-400 flex-1">{oauthError}</p>
          <button onClick={() => setOauthError(null)} className="text-red-400 hover:text-red-300">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Calendar connection banner */}
      {connections.length === 0 && !loading && (
        <div className="flex items-center gap-4 p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
            <CalendarPlus className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Connect your calendar</p>
            <p className="text-xs text-muted-foreground">
              Sync with Google Calendar to check real availability and prevent double booking.
            </p>
          </div>
          <Button onClick={handleConnectGoogle} disabled={connecting} className="gap-2">
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            Connect Google Calendar
          </Button>
        </div>
      )}

      {/* Connected calendars */}
      {connections.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded bg-white">
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium">{conn.calendar_name || "Google Calendar"}</span>
                <span className="text-[10px] text-muted-foreground">{conn.email}</span>
              </div>
              <button
                onClick={() => handleDisconnect(conn.id)}
                className="ml-2 text-muted-foreground hover:text-red-400"
                title="Disconnect"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={handleConnectGoogle} disabled={connecting} className="gap-1.5">
            {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add another
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarIcon className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="types" className="gap-1.5">
            <Settings2 className="h-4 w-4" />
            Appointment Types
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-1.5">
            <Link2 className="h-4 w-4" />
            Booking Links
          </TabsTrigger>
        </TabsList>

        {/* Calendar tab */}
        <TabsContent value="calendar" className="mt-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Calendar header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">
                {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {DAY_NAMES.map((day) => (
                <div key={day} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map((date, i) => {
                if (!date) {
                  return <div key={i} className="min-h-[100px] border-b border-r border-border bg-muted/10" />;
                }
                const dayAppts = getAppointmentsForDay(date);
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-[100px] border-b border-r border-border p-1.5 last:border-r-0",
                      isToday && "bg-indigo-500/5"
                    )}
                  >
                    <div className={cn(
                      "text-xs font-medium mb-1",
                      isToday ? "text-indigo-400" : "text-muted-foreground"
                    )}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayAppts.slice(0, 3).map((appt) => {
                        const Icon = MEETING_TYPE_ICONS[appt.meeting_type] ?? Video;
                        return (
                          <div
                            key={appt.id}
                            onClick={() => setEditAppt(appt)}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] bg-indigo-500/10 border border-indigo-500/20 cursor-pointer hover:bg-indigo-500/20"
                            style={{ borderLeftColor: appt.type_color ?? "#6366f1", borderLeftWidth: 2 }}
                          >
                            <Icon className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">
                              {new Date(appt.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} {appt.title}
                            </span>
                          </div>
                        );
                      })}
                      {dayAppts.length > 3 && (
                        <p className="text-[10px] text-muted-foreground px-1.5">
                          +{dayAppts.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Upcoming tab */}
        <TabsContent value="upcoming" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : upcomingAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <CalendarIcon className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
              <Button onClick={() => setShowNewAppt(true)} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Schedule one
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingAppointments.map((appt) => (
                <AppointmentRow
                  key={appt.id}
                  appt={appt}
                  onClick={() => setEditAppt(appt)}
                  onStatusChange={async (status) => {
                    await updateAppointmentStatus(appt.id, status);
                    loadData();
                  }}
                  onDelete={async () => {
                    await deleteAppointment(appt.id);
                    loadData();
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Appointment Types tab */}
        <TabsContent value="types" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Configure the types of meetings you offer. Each type gets a booking link.
            </p>
            <Button onClick={() => setShowNewType(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Type
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : appointmentTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Settings2 className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No appointment types yet.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {appointmentTypes.map((type) => (
                <div
                  key={type.id}
                  className="rounded-xl border border-border bg-card p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: type.color ?? "#6366f1" }}
                      />
                      <h3 className="text-sm font-semibold">{type.name}</h3>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <button className="text-muted-foreground hover:text-foreground">
                          <Settings2 className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="gap-2"
                          onClick={() => setEditType(type)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-400 gap-2"
                          onClick={async () => {
                            await deleteAppointmentType(type.id);
                            loadData();
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {type.description && (
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {type.duration_min} min
                    </span>
                    <span className="flex items-center gap-1">
                      {type.meeting_type === "video" && <Video className="h-3 w-3" />}
                      {type.meeting_type === "phone" && <Phone className="h-3 w-3" />}
                      {type.meeting_type === "in_person" && <MapPin className="h-3 w-3" />}
                      {type.meeting_type === "video" ? "Video" : type.meeting_type === "phone" ? "Phone" : "In Person"}
                    </span>
                  </div>
                  {type.slug && (
                    <button
                      onClick={() => handleCopyLink(type.slug!)}
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      {copiedSlug === type.slug ? (
                        <><Check className="h-3 w-3" /> Copied!</>
                      ) : (
                        <><Copy className="h-3 w-3" /> Copy booking link</>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Booking Links tab */}
        <TabsContent value="links" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Shareable links that let clients book based on your availability.
            </p>
            <Button
              onClick={() => setShowNewLink(true)}
              disabled={appointmentTypes.length === 0}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Link
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bookingLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Link2 className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {appointmentTypes.length === 0
                  ? "Create appointment types first."
                  : "No booking links yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {bookingLinks.map((link) => {
                const linkTypes = appointmentTypes.filter((t) =>
                  (link.appointment_type_ids ?? []).includes(t.id)
                );
                return (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
                >
                  <div>
                    <h3 className="text-sm font-semibold">{link.title}</h3>
                    {link.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{link.description}</p>
                    )}
                    {linkTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {linkTypes.map((t) => (
                          <span
                            key={t.id}
                            className="text-[10px] px-1.5 py-0.5 rounded-full border"
                            style={{
                              borderColor: (t.color ?? "#6366f1") + "40",
                              backgroundColor: (t.color ?? "#6366f1") + "15",
                              color: t.color ?? "#6366f1",
                            }}
                          >
                            {t.name} · {t.duration_min}min
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs text-muted-foreground">/book/{link.slug}</code>
                      <button
                        onClick={() => handleCopyLink(link.slug)}
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        {copiedSlug === link.slug ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <a
                        href={`/book/${link.slug}`}
                        target="_blank"
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await deleteBookingLink(link.id);
                      loadData();
                    }}
                    className="text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New Appointment Dialog */}
      {showNewAppt && (
        <NewAppointmentDialog
          open={showNewAppt}
          onOpenChange={setShowNewAppt}
          appointmentTypes={appointmentTypes}
          onCreated={() => {
            setShowNewAppt(false);
            loadData();
          }}
        />
      )}

      {/* New Appointment Type Dialog */}
      {showNewType && (
        <AppointmentTypeDialog
          open={showNewType}
          onOpenChange={setShowNewType}
          onSaved={() => {
            setShowNewType(false);
            loadData();
          }}
        />
      )}

      {/* Edit Appointment Type Dialog */}
      {editType && (
        <AppointmentTypeDialog
          open={true}
          onOpenChange={(o) => { if (!o) setEditType(null); }}
          editingType={editType}
          onSaved={() => {
            setEditType(null);
            loadData();
          }}
        />
      )}

      {/* New Booking Link Dialog */}
      {showNewLink && (
        <NewBookingLinkDialog
          open={showNewLink}
          onOpenChange={setShowNewLink}
          appointmentTypes={appointmentTypes}
          onCreated={() => {
            setShowNewLink(false);
            loadData();
          }}
        />
      )}

      {/* Edit Appointment Dialog */}
      {editAppt && (
        <EditAppointmentDialog
          appt={editAppt}
          open={!!editAppt}
          onOpenChange={(o) => { if (!o) setEditAppt(null); }}
          onSaved={() => {
            setEditAppt(null);
            loadData();
          }}
          onDeleted={() => {
            setEditAppt(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// ── Appointment Row ──────────────────────────────────────────────────────────

function AppointmentRow({
  appt,
  onStatusChange,
  onDelete,
  onClick,
}: {
  appt: Appointment;
  onStatusChange: (status: "confirmed" | "cancelled" | "completed" | "no_show") => void;
  onDelete: () => void;
  onClick?: () => void;
}) {
  const Icon = MEETING_TYPE_ICONS[appt.meeting_type] ?? Video;
  const startDate = new Date(appt.start_time);
  const endDate = new Date(appt.end_time);

  return (
    <div
      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 cursor-pointer hover:bg-muted/20"
      onClick={onClick}
    >
      {/* Date block */}
      <div className="flex flex-col items-center justify-center w-14 shrink-0">
        <span className="text-[10px] font-medium uppercase text-muted-foreground">
          {startDate.toLocaleDateString("en-US", { weekday: "short" })}
        </span>
        <span className="text-xl font-bold">{startDate.getDate()}</span>
        <span className="text-[10px] text-muted-foreground">
          {startDate.toLocaleDateString("en-US", { month: "short" })}
        </span>
      </div>

      <div className="h-12 w-px bg-border" />

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-semibold truncate">{appt.title}</h3>
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
              STATUS_COLORS[appt.status] ?? STATUS_COLORS.confirmed
            )}
          >
            {appt.status}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} –{" "}
            {endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
          {appt.contact_name && (
            <span>{appt.contact_name}</span>
          )}
          {appt.meeting_url && (
            <a
              href={appt.meeting_url}
              target="_blank"
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
            >
              <ExternalLink className="h-3 w-3" />
              Join
            </a>
          )}
        </div>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button className="text-muted-foreground hover:text-foreground">
            <Settings2 className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="gap-2" onClick={() => onStatusChange("completed")}>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            Mark completed
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={() => onStatusChange("no_show")}>
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            Mark no-show
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-red-400" onClick={() => onStatusChange("cancelled")}>
            <XCircle className="h-3.5 w-3.5" />
            Cancel
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-red-400" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── New Appointment Dialog ───────────────────────────────────────────────────

function NewAppointmentDialog({
  open,
  onOpenChange,
  appointmentTypes,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentTypes: AppointmentType[];
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [typeId, setTypeId] = useState("");
  const [meetingType, setMeetingType] = useState<"video" | "phone" | "in_person">("video");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState(30);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [useCustomLink, setUseCustomLink] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setTypeId("");
    setMeetingType("video");
    setDate("");
    setStartTime("09:00");
    setDuration(30);
    setClientName("");
    setClientEmail("");
    setLocation("");
    setMeetingUrl("");
    setUseCustomLink(false);
    setNotes("");
    setError(null);
  }

  async function handleSave() {
    if (!title.trim()) return setError("Enter a title.");
    if (!date) return setError("Select a date.");

    const start = new Date(`${date}T${startTime}`);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    setSaving(true);
    setError(null);

    const { error } = await createAppointment({
      title,
      appointment_type_id: typeId || null,
      meeting_type: meetingType,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      client_name: clientName || undefined,
      client_email: clientEmail || undefined,
      location: location || undefined,
      meeting_url: meetingUrl || undefined,
      notes: notes || undefined,
    });

    setSaving(false);
    if (error) return setError(error);

    reset();
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Appointment</DialogTitle>
          <DialogDescription>Schedule a new appointment. It will sync to your connected calendar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting title" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <select
                value={typeId}
                onChange={(e) => {
                  setTypeId(e.target.value);
                  const t = appointmentTypes.find((t) => t.id === e.target.value);
                  if (t) {
                    setMeetingType(t.meeting_type);
                    setDuration(t.duration_min);
                  }
                }}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">Custom</option>
                {appointmentTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Meeting Type</Label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as any)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="video">Video</option>
                <option value="phone">Phone</option>
                <option value="in_person">In Person</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Start Time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duration (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5} step={5} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Client Name</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client Email</Label>
              <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          {meetingType === "video" && (
            <div className="space-y-1.5">
              {!useCustomLink ? (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs text-muted-foreground">
                      Google Meet link will be auto-generated
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseCustomLink(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    Use custom link
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Custom Meeting URL</Label>
                    <button
                      type="button"
                      onClick={() => { setUseCustomLink(false); setMeetingUrl(""); }}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Use Google Meet instead
                    </button>
                  </div>
                  <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://zoom.us/j/..." />
                </div>
              )}
            </div>
          )}
          {meetingType === "in_person" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Address" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Appointment Type Dialog (Create + Edit) ─────────────────────────────────

function AppointmentTypeDialog({
  open,
  onOpenChange,
  onSaved,
  editingType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editingType?: AppointmentType | null;
}) {
  const isEdit = !!editingType;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [meetingType, setMeetingType] = useState<"video" | "phone" | "in_person">("video");
  const [duration, setDuration] = useState(30);
  const [color, setColor] = useState("#6366f1");
  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter, setBufferAfter] = useState(0);
  const [minNotice, setMinNotice] = useState(2);
  const [maxAhead, setMaxAhead] = useState(30);
  const [availability, setAvailability] = useState<Record<string, string[][]>>({
    mon: [['09:00', '17:00']],
    tue: [['09:00', '17:00']],
    wed: [['09:00', '17:00']],
    thu: [['09:00', '17:00']],
    fri: [['09:00', '17:00']],
    sat: [],
    sun: [],
  });
  const [timezone, setTimezone] = useState('America/New_York');
  const [questions, setQuestions] = useState<BookingQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingType) {
      setName(editingType.name);
      setDescription(editingType.description ?? "");
      setMeetingType(editingType.meeting_type);
      setDuration(editingType.duration_min);
      setColor(editingType.color ?? "#6366f1");
      setBufferBefore(editingType.buffer_before_min);
      setBufferAfter(editingType.buffer_after_min);
      setMinNotice(editingType.min_notice_h);
      setMaxAhead(editingType.max_days_ahead);
      setAvailability(editingType.availability ?? {
        mon: [['09:00', '17:00']], tue: [['09:00', '17:00']], wed: [['09:00', '17:00']],
        thu: [['09:00', '17:00']], fri: [['09:00', '17:00']], sat: [], sun: [],
      });
      setTimezone(editingType.timezone ?? 'America/New_York');
      setQuestions(editingType.questions ?? []);
    }
  }, [editingType]);

  function reset() {
    setName("");
    setDescription("");
    setMeetingType("video");
    setDuration(30);
    setColor("#6366f1");
    setBufferBefore(0);
    setBufferAfter(0);
    setMinNotice(2);
    setMaxAhead(30);
    setAvailability({
      mon: [['09:00', '17:00']], tue: [['09:00', '17:00']], wed: [['09:00', '17:00']],
      thu: [['09:00', '17:00']], fri: [['09:00', '17:00']], sat: [], sun: [],
    });
    setTimezone('America/New_York');
    setQuestions([]);
    setError(null);
  }

  function addQuestion() {
    setQuestions([...questions, { id: crypto.randomUUID(), label: "", type: "text", required: false }]);
  }

  function updateQuestion(idx: number, updates: Partial<BookingQuestion>) {
    setQuestions(questions.map((q, i) => (i === idx ? { ...q, ...updates } : q)));
  }

  function removeQuestion(idx: number) {
    setQuestions(questions.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!name.trim()) return setError("Enter a name.");
    setSaving(true);
    setError(null);
    const payload = {
      name,
      description: description || undefined,
      meeting_type: meetingType,
      duration_min: duration,
      color,
      buffer_before_min: bufferBefore,
      buffer_after_min: bufferAfter,
      min_notice_h: minNotice,
      max_days_ahead: maxAhead,
      availability,
      timezone,
      questions: questions.filter((q) => q.label.trim()),
    };
    let err: string | null = null;
    if (isEdit && editingType) {
      const { error } = await updateAppointmentType(editingType.id, payload as any);
      err = error;
    } else {
      const { error } = await createAppointmentType(payload as any);
      err = error;
    }
    setSaving(false);
    if (err) return setError(err);
    if (!isEdit) reset();
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o && !isEdit) reset(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Appointment Type" : "New Appointment Type"}</DialogTitle>
          <DialogDescription>Configure a meeting type that clients can book.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 30-min Discovery Call" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Meeting Type</Label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as any)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="video">Video</option>
                <option value="phone">Phone</option>
                <option value="in_person">In Person</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duration (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5} step={5} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Buffer Before (min)</Label>
              <Input type="number" value={bufferBefore} onChange={(e) => setBufferBefore(Number(e.target.value))} min={0} step={5} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Buffer After (min)</Label>
              <Input type="number" value={bufferAfter} onChange={(e) => setBufferAfter(Number(e.target.value))} min={0} step={5} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded border border-border" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Min Notice (hours)</Label>
              <Input type="number" value={minNotice} onChange={(e) => setMinNotice(Number(e.target.value))} min={0} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max Days Ahead</Label>
              <Input type="number" value={maxAhead} onChange={(e) => setMaxAhead(Number(e.target.value))} min={1} />
            </div>
          </div>

          {/* Weekly Availability */}
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-xs font-semibold">Weekly Availability</Label>
            <p className="text-xs text-muted-foreground">Set which days and times clients can book.</p>
            {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((day) => {
              const dayLabel = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }[day];
              const ranges = availability[day] ?? [];
              const isAvailable = ranges.length > 0;
              return (
                <div key={day} className="rounded-lg border border-border bg-secondary/30 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAvailable}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAvailability({ ...availability, [day]: [['09:00', '17:00']] });
                          } else {
                            setAvailability({ ...availability, [day]: [] });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="font-medium">{dayLabel}</span>
                    </label>
                    {isAvailable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAvailability({ ...availability, [day]: [...ranges, ['09:00', '17:00']] })}
                        className="h-6 gap-1 text-xs px-2"
                      >
                        <Plus className="h-3 w-3" />
                        Add hours
                      </Button>
                    )}
                  </div>
                  {isAvailable && ranges.map((range, rIdx) => (
                    <div key={rIdx} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={range[0]}
                        onChange={(e) => {
                          const newRanges = ranges.map((r, i) => i === rIdx ? [e.target.value, r[1]] : r);
                          setAvailability({ ...availability, [day]: newRanges });
                        }}
                        className="h-7 rounded border border-border bg-card px-2 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <input
                        type="time"
                        value={range[1]}
                        onChange={(e) => {
                          const newRanges = ranges.map((r, i) => i === rIdx ? [r[0], e.target.value] : r);
                          setAvailability({ ...availability, [day]: newRanges });
                        }}
                        className="h-7 rounded border border-border bg-card px-2 text-xs"
                      />
                      {ranges.length > 1 && (
                        <button
                          onClick={() => setAvailability({ ...availability, [day]: ranges.filter((_, i) => i !== rIdx) })}
                          className="text-muted-foreground hover:text-red-400 p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="space-y-1.5">
              <Label className="text-xs">Timezone</Label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                {['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney', 'UTC'].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Questions */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Booking Form Questions</Label>
              <Button variant="ghost" size="sm" onClick={addQuestion} className="h-7 gap-1 text-xs">
                <Plus className="h-3 w-3" />
                Add Question
              </Button>
            </div>
            {questions.length === 0 && (
              <p className="text-xs text-muted-foreground">No custom questions. Clients will just enter name, email, and phone.</p>
            )}
            {questions.map((q, idx) => (
              <div key={q.id} className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={q.label}
                    onChange={(e) => updateQuestion(idx, { label: e.target.value })}
                    placeholder="Question text"
                    className="h-8 text-sm flex-1"
                  />
                  <button
                    onClick={() => removeQuestion(idx)}
                    className="text-muted-foreground hover:text-red-400 p-0.5 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(idx, { type: e.target.value as any })}
                    className="h-7 rounded border border-border bg-card px-2 text-xs"
                  >
                    <option value="text">Short text</option>
                    <option value="textarea">Long text</option>
                    <option value="select">Dropdown</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => updateQuestion(idx, { required: e.target.checked })}
                      className="rounded"
                    />
                    Required
                  </label>
                </div>
                {q.type === "select" && (
                  <Input
                    value={(q.options ?? []).join(", ")}
                    onChange={(e) => updateQuestion(idx, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    placeholder="Option 1, Option 2, Option 3"
                    className="h-7 text-xs"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── New Booking Link Dialog ──────────────────────────────────────────────────

function NewBookingLinkDialog({
  open,
  onOpenChange,
  appointmentTypes,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentTypes: AppointmentType[];
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setSelectedTypeIds([]);
    setError(null);
  }

  function toggleType(id: string) {
    setSelectedTypeIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    if (!title.trim()) return setError("Enter a title.");
    if (selectedTypeIds.length === 0) return setError("Select at least one appointment type.");
    setSaving(true);
    setError(null);
    const { error } = await createBookingLink({
      title,
      description: description || undefined,
      appointment_type_ids: selectedTypeIds,
    });
    setSaving(false);
    if (error) return setError(error);
    reset();
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Booking Link</DialogTitle>
          <DialogDescription>Create a shareable link for clients to book appointments.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Book a call with me" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Appointment Types</Label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {appointmentTypes.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-muted/30"
                >
                  <input
                    type="checkbox"
                    checked={selectedTypeIds.includes(t.id)}
                    onChange={() => toggleType(t.id)}
                    className="rounded"
                  />
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color ?? "#6366f1" }} />
                  <span className="text-sm">{t.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{t.duration_min} min</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Appointment Dialog ──────────────────────────────────────────────────

function EditAppointmentDialog({
  appt,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  appt: Appointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const startDate = new Date(appt.start_time);
  const endDate = new Date(appt.end_time);

  const [title, setTitle] = useState(appt.title);
  const [meetingType, setMeetingType] = useState(appt.meeting_type);
  const [date, setDate] = useState(startDate.toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(
    startDate.toTimeString().slice(0, 5)
  );
  const [duration, setDuration] = useState(
    Math.round((endDate.getTime() - startDate.getTime()) / 60000)
  );
  const [clientName, setClientName] = useState(appt.client_name ?? "");
  const [clientEmail, setClientEmail] = useState(appt.client_email ?? "");
  const [location, setLocation] = useState(appt.location ?? "");
  const [meetingUrl, setMeetingUrl] = useState(appt.meeting_url ?? "");
  const [notes, setNotes] = useState(appt.notes ?? "");
  const [status, setStatus] = useState(appt.status);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) return setError("Enter a title.");
    if (!date) return setError("Select a date.");

    const start = new Date(`${date}T${startTime}`);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    setSaving(true);
    setError(null);

    const { error } = await updateAppointment(appt.id, {
      title,
      meeting_type: meetingType,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      client_name: clientName || undefined,
      client_email: clientEmail || undefined,
      location: location || undefined,
      meeting_url: meetingUrl || undefined,
      notes: notes || undefined,
      status,
    });

    setSaving(false);
    if (error) return setError(error);
    onSaved();
  }

  async function handleDelete() {
    setDeleting(true);
    await deleteAppointment(appt.id);
    setDeleting(false);
    onDeleted();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Appointment</DialogTitle>
          <DialogDescription>Update or reschedule this appointment.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Meeting Type</Label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as any)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="video">Video</option>
                <option value="phone">Phone</option>
                <option value="in_person">In Person</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Start Time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duration (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5} step={5} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Client Name</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client Email</Label>
              <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
            </div>
          </div>

          {meetingType === "video" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Meeting URL</Label>
              <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="Auto-generated Google Meet link" />
            </div>
          )}
          {meetingType === "in_person" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleDelete} disabled={deleting} className="gap-2 text-red-400 mr-auto">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
