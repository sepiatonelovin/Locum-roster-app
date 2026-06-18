import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Check, X, User, UserPlus, Stethoscope } from "lucide-react";
import { supabase } from "./supabaseClient";

const COLORS = {
  paper: "#F2EAD8",
  card: "#FAF6EC",
  ink: "#4A3324",
  sub: "#8C7C68",
  faint: "#B0A693",
  line: "#D8CFC0",
  sage: "#7E9468",
  grey: "#D9D2C2",
  brown: "#5C3A21",
  brownSoftBg: "#EDE6D8",
  tan: "#EAD9BD",
  tanText: "#8B5E34",
  reject: "#6B645A",
  sundayBg: "#E8E2D3",
};

const HEADER_FONT = '"Times New Roman", Times, serif';
const BODY_FONT = "'Lato', system-ui, sans-serif";
const ADMIN_CODE = "admin2026";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SLOT_LABELS = {
  AM: "AM · 8am–1pm",
  PM: "PM · 2pm–5pm",
  WHOLE: "Whole day · 8am–5pm",
};

function getMonthKey(year, month) {
  return `${year}-${month}`;
}

function parseMonthKey(key) {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getDayType(year, month, day) {
  const dow = new Date(year, month, day).getDay();
  if (dow === 0) return "sunday";
  if (dow === 6) return "saturday";
  return "weekday";
}

function slotTypesForDayType(dayType) {
  if (dayType === "sunday") return [];
  if (dayType === "saturday") return ["AM"];
  return ["AM", "PM", "WHOLE"];
}

function getAvailableTypes(dayType, openSlots, bookings) {
  const open = openSlots || {};
  const b = bookings || {};
  if (dayType === "sunday") return [];
  if (dayType === "saturday") {
    if (!open.AM) return [];
    return b.AM ? [] : ["AM"];
  }
  const amTaken = !!b.AM;
  const pmTaken = !!b.PM;
  const wholeTaken = !!b.WHOLE;
  const types = [];
  if (open.WHOLE && !amTaken && !pmTaken && !wholeTaken) types.push("WHOLE");
  if (open.AM && !amTaken && !wholeTaken) types.push("AM");
  if (open.PM && !pmTaken && !wholeTaken) types.push("PM");
  return types;
}

function buildCalendarCells(year, month) {
  const firstDow = new Date(year, month, 1).getDay();
  const total = daysInMonth(year, month);
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= total; d++) {
    cells.push({ day: d, dayType: getDayType(year, month, d), dow: new Date(year, month, d).getDay() });
  }
  return cells;
}

// Turns the flat rows Supabase returns for one month into the nested shape
// the rest of the app already works with: { openSlots: { day: {AM,PM,WHOLE} }, bookings: { day: {AM:{name,status}, ...} } }
function rowsToMonthShape(rows) {
  const openSlots = {};
  const bookings = {};
  for (const row of rows) {
    if (row.is_open) {
      openSlots[row.day] = { ...(openSlots[row.day] || {}), [row.slot_type]: true };
    }
    if (row.status) {
      bookings[row.day] = { ...(bookings[row.day] || {}), [row.slot_type]: { name: row.locum_name, status: row.status } };
    }
  }
  return { openSlots, bookings };
}

function SectionHeading({ children }) {
  return (
    <h2 className="text-sm uppercase font-bold mb-2" style={{ fontFamily: HEADER_FONT, color: COLORS.ink, letterSpacing: "0.1em" }}>
      {children}
    </h2>
  );
}

function CalendarGrid({ cells, isAvailable, selectedDay, onSelect, isTodayFn, selectMode = false, selectedDates = [], onToggleSelect }) {
  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_SHORT.map((w) => (
          <div key={w} className="text-center text-xs font-semibold py-1" style={{ color: COLORS.sub }}>
            {w[0]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={i} />;
          if (c.dayType === "sunday") {
            return (
              <div key={i} className="aspect-square flex items-center justify-center rounded-lg text-xs" style={{ backgroundColor: COLORS.sundayBg, color: COLORS.sub }}>
                {c.day}
              </div>
            );
          }
          const available = isAvailable(c);
          const isSel = selectedDay === c.day;
          const isPicked = selectMode && selectedDates.includes(c.day);
          return (
            <button
              key={i}
              onClick={() => (selectMode ? onToggleSelect(c.day) : onSelect(c.day))}
              className="relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-semibold transition-colors duration-150"
              style={{
                backgroundColor: available ? COLORS.sage : COLORS.grey,
                color: available ? "#fff" : COLORS.ink,
                boxShadow: isPicked ? `0 0 0 2px ${COLORS.brown}` : isSel ? `0 0 0 2px ${COLORS.ink}` : "none",
              }}
            >
              {isPicked && (
                <span className="absolute flex items-center justify-center rounded-full" style={{ top: -4, right: -4, width: 14, height: 14, backgroundColor: COLORS.brown }}>
                  <Check size={9} color="#fff" />
                </span>
              )}
              {c.day}
              {isTodayFn(c.day) && (
                <span className="block w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: available ? "#fff" : COLORS.ink }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const today = new Date();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [role, setRole] = useState("admin");
  const [adminTab, setAdminTab] = useState("roster");
  const [locumTab, setLocumTab] = useState("calendar");
  const [locumName, setLocumName] = useState("");
  const [loggedInLocumId, setLoggedInLocumId] = useState(null);
  const [locumUsers, setLocumUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [newLocumName, setNewLocumName] = useState("");
  const [newLocumEmail, setNewLocumEmail] = useState("");
  const [newLocumCode, setNewLocumCode] = useState("");
  const [addLocumError, setAddLocumError] = useState("");
  const [monthData, setMonthData] = useState({});
  const [activeMonthKey, setActiveMonthKey] = useState(null);
  const [myAllRequests, setMyAllRequests] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);

  const monthKey = getMonthKey(year, month);
  const data = monthData[monthKey] || { openSlots: {}, bookings: {} };

  // ---- Supabase fetch helpers ----

  async function fetchMonth(key) {
    const { data: rows, error } = await supabase.from("roster_slots").select("*").eq("month_key", key);
    if (error) {
      console.error("fetchMonth error:", error);
      return;
    }
    setMonthData((prev) => ({ ...prev, [key]: rowsToMonthShape(rows || []) }));
  }

  async function fetchLocumUsers() {
    const { data: rows, error } = await supabase.from("locums").select("*").order("name");
    if (error) {
      console.error("fetchLocumUsers error:", error);
      setUsersLoaded(true);
      return;
    }
    setLocumUsers(rows || []);
    setUsersLoaded(true);
  }

  async function fetchActiveMonth() {
    const { data: row, error } = await supabase.from("app_state").select("active_month_key").eq("id", 1).single();
    if (error) {
      console.error("fetchActiveMonth error:", error);
      return;
    }
    setActiveMonthKey(row ? row.active_month_key : null);
  }

  async function fetchMyRequests(locumId) {
    if (!locumId) {
      setMyAllRequests([]);
      return;
    }
    const { data: rows, error } = await supabase.from("roster_slots").select("*").eq("locum_id", locumId).not("status", "is", null);
    if (error) {
      console.error("fetchMyRequests error:", error);
      return;
    }
    const list = (rows || [])
      .map((row) => {
        const { year: y, month: m } = parseMonthKey(row.month_key);
        const dow = new Date(y, m, row.day).getDay();
        return { year: y, month: m, day: row.day, dow, type: row.slot_type, name: row.locum_name, status: row.status };
      })
      .sort((a, b) => a.year - b.year || a.month - b.month || a.day - b.day);
    setMyAllRequests(list);
  }

  // ---- Initial loads ----

  useEffect(() => {
    fetchLocumUsers();
    fetchActiveMonth();
  }, []);

  useEffect(() => {
    fetchMonth(monthKey);
  }, [monthKey]);

  useEffect(() => {
    if (activeMonthKey) fetchMonth(activeMonthKey);
  }, [activeMonthKey]);

  useEffect(() => {
    fetchMyRequests(loggedInLocumId);
  }, [loggedInLocumId]);

  // ---- Realtime sync (one subscription for the life of the app) ----

  const monthKeyRef = useRef(monthKey);
  const activeMonthKeyRef = useRef(activeMonthKey);
  const loggedInLocumIdRef = useRef(loggedInLocumId);
  useEffect(() => { monthKeyRef.current = monthKey; }, [monthKey]);
  useEffect(() => { activeMonthKeyRef.current = activeMonthKey; }, [activeMonthKey]);
  useEffect(() => { loggedInLocumIdRef.current = loggedInLocumId; }, [loggedInLocumId]);

  useEffect(() => {
    const channel = supabase
      .channel("roster-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_slots" }, () => {
        fetchMonth(monthKeyRef.current);
        if (activeMonthKeyRef.current) fetchMonth(activeMonthKeyRef.current);
        if (loggedInLocumIdRef.current) fetchMyRequests(loggedInLocumIdRef.current);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "locums" }, () => {
        fetchLocumUsers();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "app_state" }, () => {
        fetchActiveMonth();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ---- Mutations ----

  function updateMonthDataFor(key, updater) {
    setMonthData((prev) => {
      const current = prev[key] || { openSlots: {}, bookings: {} };
      return { ...prev, [key]: updater(current) };
    });
  }

  async function toggleSlot(day, type) {
    const daySlots = data.openSlots[day] || {};
    const nextValue = !daySlots[type];
    updateMonthDataFor(monthKey, (curr) => {
      const ds = curr.openSlots[day] || {};
      return { ...curr, openSlots: { ...curr.openSlots, [day]: { ...ds, [type]: nextValue } } };
    });
    const { error } = await supabase
      .from("roster_slots")
      .upsert({ month_key: monthKey, day, slot_type: type, is_open: nextValue }, { onConflict: "month_key,day,slot_type" });
    if (error) {
      console.error("toggleSlot error:", error);
      fetchMonth(monthKey);
    }
  }

  async function requestSlot(day, type) {
    if (!locumName.trim() || !loggedInLocumId || !activeMonthKey) return;
    updateMonthDataFor(activeMonthKey, (curr) => ({
      ...curr,
      bookings: {
        ...curr.bookings,
        [day]: { ...(curr.bookings[day] || {}), [type]: { name: locumName.trim(), status: "pending" } },
      },
    }));
    // Conditional update: only succeeds if the slot is still open and unclaimed,
    // so two locums tapping the same slot at the same moment can't both win it.
    const { data: updated, error } = await supabase
      .from("roster_slots")
      .update({ status: "pending", locum_id: loggedInLocumId, locum_name: locumName.trim() })
      .eq("month_key", activeMonthKey)
      .eq("day", day)
      .eq("slot_type", type)
      .eq("is_open", true)
      .is("status", null)
      .select();
    if (error || !updated || updated.length === 0) {
      fetchMonth(activeMonthKey);
    } else {
      fetchMyRequests(loggedInLocumId);
    }
  }

  async function approveRequest(day, type) {
    updateMonthDataFor(monthKey, (curr) => ({
      ...curr,
      bookings: { ...curr.bookings, [day]: { ...curr.bookings[day], [type]: { ...curr.bookings[day][type], status: "booked" } } },
    }));
    const { error } = await supabase
      .from("roster_slots")
      .update({ status: "booked" })
      .eq("month_key", monthKey)
      .eq("day", day)
      .eq("slot_type", type);
    if (error) {
      console.error("approveRequest error:", error);
      fetchMonth(monthKey);
    }
  }

  async function rejectRequest(day, type) {
    updateMonthDataFor(monthKey, (curr) => {
      const dayBookings = { ...curr.bookings[day] };
      delete dayBookings[type];
      return { ...curr, bookings: { ...curr.bookings, [day]: dayBookings } };
    });
    const { error } = await supabase
      .from("roster_slots")
      .update({ status: null, locum_id: null, locum_name: null })
      .eq("month_key", monthKey)
      .eq("day", day)
      .eq("slot_type", type);
    if (error) {
      console.error("rejectRequest error:", error);
      fetchMonth(monthKey);
    }
  }

  function changeMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
    setSelectedDay(null);
    setSelectMode(false);
    setSelectedDates([]);
  }

  async function toggleActiveMonth() {
    const nextValue = activeMonthKey === monthKey ? null : monthKey;
    setActiveMonthKey(nextValue);
    const { error } = await supabase.from("app_state").update({ active_month_key: nextValue }).eq("id", 1);
    if (error) {
      console.error("toggleActiveMonth error:", error);
      fetchActiveMonth();
    }
  }

  function handleLogin() {
    const code = loginCode.trim();
    if (!code) return;
    if (code === ADMIN_CODE) {
      setRole("admin");
      setLocumName("");
      setLoggedInLocumId(null);
      setIsLoggedIn(true);
      setLoginError("");
      setLoginCode("");
      return;
    }
    const matchedUser = locumUsers.find((u) => u.code && u.code === code);
    if (matchedUser) {
      setRole("locum");
      setLocumName(matchedUser.name);
      setLoggedInLocumId(matchedUser.id);
      setIsLoggedIn(true);
      setLoginError("");
      setLoginCode("");
      return;
    }
    setLoginError("Invalid code. Please try again.");
  }

  function handleLogout() {
    setIsLoggedIn(false);
    setRole("admin");
    setLocumName("");
    setLoggedInLocumId(null);
    setLoginCode("");
    setLoginError("");
    setSelectedDay(null);
    setSelectMode(false);
    setSelectedDates([]);
    setAdminTab("roster");
    setLocumTab("calendar");
  }

  function enterSelectMode() {
    setSelectedDay(null);
    setSelectedDates([]);
    setSelectMode(true);
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedDates([]);
  }

  function toggleDateSelection(day) {
    setSelectedDates((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function confirmSelectedDates() {
    const rows = [];
    for (const day of selectedDates) {
      const dayType = getDayType(year, month, day);
      for (const type of slotTypesForDayType(dayType)) {
        rows.push({ month_key: monthKey, day, slot_type: type, is_open: true });
      }
    }
    updateMonthDataFor(monthKey, (curr) => {
      const nextOpenSlots = { ...curr.openSlots };
      for (const day of selectedDates) {
        const dayType = getDayType(year, month, day);
        const merged = { ...(nextOpenSlots[day] || {}) };
        for (const type of slotTypesForDayType(dayType)) merged[type] = true;
        nextOpenSlots[day] = merged;
      }
      return { ...curr, openSlots: nextOpenSlots };
    });
    exitSelectMode();
    const { error } = await supabase.from("roster_slots").upsert(rows, { onConflict: "month_key,day,slot_type" });
    if (error) {
      console.error("confirmSelectedDates error:", error);
      fetchMonth(monthKey);
    }
  }

  async function handleAddLocum() {
    const trimmedName = newLocumName.trim();
    const trimmedCode = newLocumCode.trim();
    if (!trimmedName || !trimmedCode) {
      setAddLocumError("Name and log in code are both required.");
      return;
    }
    const { data: inserted, error } = await supabase
      .from("locums")
      .insert({ name: trimmedName, email: newLocumEmail.trim() || null, code: trimmedCode })
      .select()
      .single();
    if (error) {
      setAddLocumError(error.code === "23505" ? "That log in code is already in use." : "Could not add locum. Please try again.");
      return;
    }
    setLocumUsers((prev) => [...prev, inserted].sort((a, b) => a.name.localeCompare(b.name)));
    setNewLocumName("");
    setNewLocumEmail("");
    setNewLocumCode("");
    setAddLocumError("");
  }

  function removeLocumUser(id) {
    setLocumUsers((prev) => prev.filter((u) => u.id !== id));
    supabase
      .from("locums")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("removeLocumUser error:", error);
      });
  }

  function isTodayIn(y, m, d) {
    return y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
  }

  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);
  const days = useMemo(() => cells.filter(Boolean), [cells]);

  const activeParts = activeMonthKey ? parseMonthKey(activeMonthKey) : null;
  const activeData = activeMonthKey ? (monthData[activeMonthKey] || { openSlots: {}, bookings: {} }) : { openSlots: {}, bookings: {} };
  const activeCells = useMemo(
    () => (activeParts ? buildCalendarCells(activeParts.year, activeParts.month) : []),
    [activeMonthKey]
  );

  const pendingRequests = useMemo(() => {
    const list = [];
    for (const d of days) {
      const b = data.bookings[d.day];
      if (!b) continue;
      for (const type of slotTypesForDayType(d.dayType)) {
        if (b[type] && b[type].status === "pending") list.push({ day: d.day, dow: d.dow, type, ...b[type] });
      }
    }
    return list;
  }, [data, days]);

  const bookedSlots = useMemo(() => {
    const list = [];
    for (const d of days) {
      const b = data.bookings[d.day];
      if (!b) continue;
      for (const type of slotTypesForDayType(d.dayType)) {
        if (b[type] && b[type].status === "booked") list.push({ day: d.day, dow: d.dow, type, ...b[type] });
      }
    }
    return list;
  }, [data, days]);

  const myPending = myAllRequests.filter((r) => r.status === "pending");
  const myBooked = myAllRequests.filter((r) => r.status === "booked");

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: COLORS.paper, fontFamily: BODY_FONT, color: COLORS.ink }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap');
          *:focus-visible { outline: 2px solid ${COLORS.sage}; outline-offset: 2px; }
        `}</style>
        <div className="w-full max-w-xs">
          <div className="flex flex-col items-center mb-8 text-center">
            <Stethoscope size={26} style={{ color: COLORS.sage }} />
            <span className="text-xs font-bold uppercase mt-2" style={{ color: COLORS.sage, letterSpacing: "0.15em" }}>Locum Roster</span>
            <h1 className="text-2xl font-semibold mt-1" style={{ fontFamily: HEADER_FONT }}>Polyclinic duty board</h1>
          </div>
          <label className="text-xs uppercase font-bold block mb-1" style={{ color: COLORS.ink, letterSpacing: "0.08em" }}>Log in code</label>
          <input
            value={loginCode}
            onChange={(e) => { setLoginCode(e.target.value); setLoginError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
            placeholder="Enter your code"
            className="w-full rounded-lg px-3 py-2 text-sm mb-2"
            style={{ border: `1px solid ${COLORS.line}`, backgroundColor: COLORS.card }}
          />
          {loginError && <p className="text-xs mb-2" style={{ color: COLORS.reject }}>{loginError}</p>}
          {!usersLoaded && <p className="text-xs mb-2" style={{ color: COLORS.faint }}>Loading…</p>}
          <button
            onClick={handleLogin}
            disabled={!usersLoaded}
            className="w-full text-sm font-semibold px-3 py-2 rounded-lg transition-colors duration-150 disabled:opacity-50"
            style={{ backgroundColor: COLORS.sage, color: "#fff" }}
          >
            Log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.paper, fontFamily: BODY_FONT, color: COLORS.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap');
        @keyframes stampIn {
          0% { opacity: 0; transform: scale(1.4) rotate(-14deg); }
          60% { opacity: 1; transform: scale(0.92) rotate(-2deg); }
          100% { opacity: 1; transform: scale(1) rotate(-3deg); }
        }
        .stamp-anim { animation: stampIn 0.35s ease-out; }
        @media (prefers-reduced-motion: reduce) { .stamp-anim { animation: none; } }
        *:focus-visible { outline: 2px solid ${COLORS.sage}; outline-offset: 2px; }
      `}</style>

      <div className="max-w-xl mx-auto px-4 pt-6 pb-16">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Stethoscope size={18} style={{ color: COLORS.sage }} />
              <span className="text-xs font-bold uppercase" style={{ color: COLORS.sage, letterSpacing: "0.15em" }}>
                Locum Roster
              </span>
            </div>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: HEADER_FONT }}>Polyclinic duty board</h1>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold mb-1" style={{ color: COLORS.ink }}>{role === "admin" ? "Admin" : locumName}</p>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors duration-150"
              style={{ border: `1px solid ${COLORS.line}`, color: COLORS.sub }}
            >
              Log out
            </button>
          </div>
        </header>

        {role === "admin" && (
          <div className="flex gap-2 mb-5">
            {["roster", "locums"].map((t) => (
              <button
                key={t}
                onClick={() => setAdminTab(t)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors duration-150"
                style={
                  adminTab === t
                    ? { backgroundColor: COLORS.ink, color: "#fff" }
                    : { border: `1px solid ${COLORS.line}`, color: COLORS.sub }
                }
              >
                {t === "roster" ? "Roster" : "Locums"}
              </button>
            ))}
          </div>
        )}

        {role === "locum" && (
          <div className="flex gap-2 mb-5">
            {["calendar", "requests"].map((t) => (
              <button
                key={t}
                onClick={() => setLocumTab(t)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors duration-150"
                style={
                  locumTab === t
                    ? { backgroundColor: COLORS.ink, color: "#fff" }
                    : { border: `1px solid ${COLORS.line}`, color: COLORS.sub }
                }
              >
                {t === "calendar" ? "Available slots" : "My Requests"}
              </button>
            ))}
          </div>
        )}

        {role === "admin" ? (
          adminTab === "locums" ? (
            <div className="space-y-6">
              <section>
                <SectionHeading>Add a locum</SectionHeading>
                <div className="space-y-2">
                  <input
                    value={newLocumName}
                    onChange={(e) => setNewLocumName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddLocum(); }}
                    placeholder="Name, e.g. Dr Tan"
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ border: `1px solid ${COLORS.line}`, backgroundColor: COLORS.card }}
                  />
                  <input
                    value={newLocumEmail}
                    onChange={(e) => setNewLocumEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddLocum(); }}
                    placeholder="Email"
                    type="email"
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ border: `1px solid ${COLORS.line}`, backgroundColor: COLORS.card }}
                  />
                  <input
                    value={newLocumCode}
                    onChange={(e) => setNewLocumCode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddLocum(); }}
                    placeholder="Log in code, e.g. 4821"
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ border: `1px solid ${COLORS.line}`, backgroundColor: COLORS.card }}
                  />
                  {addLocumError && <p className="text-xs" style={{ color: COLORS.reject }}>{addLocumError}</p>}
                  <button
                    onClick={handleAddLocum}
                    className="w-full flex items-center justify-center gap-1 text-sm font-semibold px-3 py-2 rounded-lg transition-colors duration-150"
                    style={{ backgroundColor: COLORS.sage, color: "#fff" }}
                  >
                    <UserPlus size={15} /> Add locum
                  </button>
                </div>
              </section>

              <section>
                <SectionHeading>Registered locums ({locumUsers.length})</SectionHeading>
                {locumUsers.length === 0 ? (
                  <p className="text-sm" style={{ color: COLORS.faint }}>No locums added yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {locumUsers.map((u) => (
                      <div key={u.id} className="rounded-lg px-3 py-2.5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.line}` }}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold flex items-center gap-1.5"><User size={14} /> {u.name}</span>
                          <button onClick={() => removeLocumUser(u.id)} aria-label={`Remove ${u.name}`} className="p-1 rounded-full" style={{ color: COLORS.reject }}>
                            <X size={14} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1 text-xs" style={{ color: COLORS.sub }}>
                          <span>{u.email || "No email"}</span>
                          <span>Code: {u.code || "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => changeMonth(-1)} aria-label="Previous month" className="p-1.5 rounded-full transition-colors duration-150 hover:bg-gray-100">
                    <ChevronLeft size={18} style={{ color: COLORS.ink }} />
                  </button>
                  <span className="text-sm font-bold">{MONTH_NAMES[month].toUpperCase()} {year}</span>
                  <button onClick={() => changeMonth(1)} aria-label="Next month" className="p-1.5 rounded-full transition-colors duration-150 hover:bg-gray-100">
                    <ChevronRight size={18} style={{ color: COLORS.ink }} />
                  </button>
                </div>

                <div className="flex justify-center mb-4">
                  <button
                    onClick={toggleActiveMonth}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors duration-150"
                    style={
                      activeMonthKey === monthKey
                        ? { backgroundColor: COLORS.sage, color: "#fff" }
                        : { border: `1px solid ${COLORS.line}`, color: COLORS.sub }
                    }
                  >
                    {activeMonthKey === monthKey ? "✓ Visible to locums" : "Make visible to locums"}
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-3 text-xs" style={{ color: COLORS.sub }}>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.sage }} /> Has open slots
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.grey, border: `1px solid ${COLORS.line}` }} /> Nothing open
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-sm" style={{ color: COLORS.sub }}>
                    {selectMode ? "Tap dates to select them, then confirm." : "Tap a date to choose its slots and review requests."}
                  </p>
                  <button
                    onClick={selectMode ? exitSelectMode : enterSelectMode}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors duration-150"
                    style={{ border: `1px solid ${COLORS.line}`, color: COLORS.sub }}
                  >
                    {selectMode ? "Cancel" : "Select dates"}
                  </button>
                </div>

                <CalendarGrid
                  cells={cells}
                  isAvailable={(c) => {
                    const slots = data.openSlots[c.day] || {};
                    return Object.values(slots).some(Boolean);
                  }}
                  selectedDay={selectedDay}
                  onSelect={(d) => setSelectedDay((prev) => (prev === d ? null : d))}
                  isTodayFn={(d) => isTodayIn(year, month, d)}
                  selectMode={selectMode}
                  selectedDates={selectedDates}
                  onToggleSelect={toggleDateSelection}
                />

                {selectMode ? (
                  <div className="flex items-center justify-between rounded-lg p-3 mt-3" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.line}` }}>
                    <span className="text-sm" style={{ color: COLORS.sub }}>
                      {selectedDates.length === 0 ? "No dates selected yet." : `${selectedDates.length} date${selectedDates.length > 1 ? "s" : ""} selected`}
                    </span>
                    <button
                      onClick={confirmSelectedDates}
                      disabled={selectedDates.length === 0}
                      className="text-xs font-semibold px-4 py-1.5 rounded-full transition-colors duration-150 disabled:opacity-40"
                      style={{ backgroundColor: COLORS.sage, color: "#fff" }}
                    >
                      Confirm
                    </button>
                  </div>
                ) : (
                  selectedDay && (() => {
                    const dayType = getDayType(year, month, selectedDay);
                    const dow = new Date(year, month, selectedDay).getDay();
                    const daySlots = data.openSlots[selectedDay] || {};
                    const dayBookings = data.bookings[selectedDay] || {};
                    const types = slotTypesForDayType(dayType);
                    const hasAnyRequest = types.some((type) => dayBookings[type]);
                    return (
                      <div className="rounded-lg p-3 mt-3" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.line}` }}>
                        <div className="mb-2.5">
                          <span className="text-sm font-bold">{String(selectedDay).padStart(2, "0")} {WEEKDAY_SHORT[dow]}</span>
                        </div>
                        <p className="text-xs mb-2" style={{ color: COLORS.sub }}>Choose which slots locums can request:</p>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {types.map((type) => {
                            const isOpen = !!daySlots[type];
                            return (
                              <button
                                key={type}
                                onClick={() => toggleSlot(selectedDay, type)}
                                className="text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors duration-150"
                                style={{ backgroundColor: isOpen ? COLORS.sage : COLORS.grey, color: isOpen ? "#fff" : COLORS.ink }}
                              >
                                {SLOT_LABELS[type]}
                              </button>
                            );
                          })}
                        </div>
                        <div className="space-y-1.5">
                          {!hasAnyRequest ? (
                            <p className="text-sm" style={{ color: COLORS.faint }}>No requests yet for this day.</p>
                          ) : (
                            types.map((type) => {
                              const b = dayBookings[type];
                              if (!b) return null;
                              return (
                                <div key={type} className="flex items-center justify-between text-sm">
                                  <span className="flex items-center gap-1"><User size={13} /> {SLOT_LABELS[type]} — {b.name}</span>
                                  {b.status === "pending" ? (
                                    <div className="flex gap-1.5">
                                      <button onClick={() => approveRequest(selectedDay, type)} aria-label="Approve" className="p-1.5 rounded-full" style={{ backgroundColor: COLORS.sage, color: "#fff" }}>
                                        <Check size={13} />
                                      </button>
                                      <button onClick={() => rejectRequest(selectedDay, type)} aria-label="Reject" className="p-1.5 rounded-full" style={{ backgroundColor: COLORS.reject, color: "#fff" }}>
                                        <X size={13} />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: COLORS.brownSoftBg, color: COLORS.ink }}>Booked</span>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              <section>
                <SectionHeading>Pending requests{pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ""}</SectionHeading>
                {pendingRequests.length === 0 ? (
                  <p className="text-sm py-1" style={{ color: COLORS.faint }}>No pending requests for this month.</p>
                ) : (
                  <div className="space-y-2">
                    {pendingRequests.map((r, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.line}` }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold">{String(r.day).padStart(2, "0")} {WEEKDAY_SHORT[r.dow]}</span>
                          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: COLORS.tan, color: COLORS.tanText }}>{SLOT_LABELS[r.type]}</span>
                          <span className="text-sm flex items-center gap-1"><User size={13} /> {r.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => approveRequest(r.day, r.type)} aria-label="Approve" className="p-1.5 rounded-full" style={{ backgroundColor: COLORS.sage, color: "#fff" }}>
                            <Check size={14} />
                          </button>
                          <button onClick={() => rejectRequest(r.day, r.type)} aria-label="Reject" className="p-1.5 rounded-full" style={{ backgroundColor: COLORS.reject, color: "#fff" }}>
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <SectionHeading>Confirmed roster</SectionHeading>
                {bookedSlots.length === 0 ? (
                  <p className="text-sm py-1" style={{ color: COLORS.faint }}>No confirmed slots yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {bookedSlots.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b" style={{ borderColor: COLORS.line }}>
                        <span className="flex items-center gap-2">
                          <span className="font-bold">{String(r.day).padStart(2, "0")} {WEEKDAY_SHORT[r.dow]}</span>
                          <span style={{ color: COLORS.sub }}>{SLOT_LABELS[r.type]}</span>
                        </span>
                        <span
                          className="stamp-anim inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: COLORS.brown, color: "#fff", transform: "rotate(-3deg)", fontFamily: HEADER_FONT, letterSpacing: "0.03em" }}
                        >
                          <Check size={12} /> {r.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )
        ) : locumTab === "requests" ? (
          <div className="space-y-6">
            {!locumName.trim() ? (
              <p className="text-sm" style={{ color: COLORS.faint }}>Log in to see your requests.</p>
            ) : (
              <>
                <section>
                  <SectionHeading>Requested ({myPending.length})</SectionHeading>
                  {myPending.length === 0 ? (
                    <p className="text-sm" style={{ color: COLORS.faint }}>No requested slots.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {myPending.map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b" style={{ borderColor: COLORS.line }}>
                          <span className="font-bold">{MONTH_NAMES[r.month].slice(0, 3)} {String(r.day).padStart(2, "0")} · {SLOT_LABELS[r.type]}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS.tan, color: COLORS.tanText }}>Requested</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <SectionHeading>Approved ({myBooked.length})</SectionHeading>
                  {myBooked.length === 0 ? (
                    <p className="text-sm" style={{ color: COLORS.faint }}>No approved slots yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {myBooked.map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b" style={{ borderColor: COLORS.line }}>
                          <span className="font-bold">{MONTH_NAMES[r.month].slice(0, 3)} {String(r.day).padStart(2, "0")} · {SLOT_LABELS[r.type]}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS.brownSoftBg, color: COLORS.ink }}>Approved</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        ) : !activeMonthKey ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: COLORS.faint }}>No month is open for requests yet. Check back soon.</p>
          </div>
        ) : (
          <div>
            <div className="text-center mb-4">
              <span className="text-sm font-bold">{MONTH_NAMES[activeParts.month].toUpperCase()} {activeParts.year}</span>
            </div>

            <div className="flex items-center gap-4 mb-3 text-xs" style={{ color: COLORS.sub }}>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.sage }} /> Available
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.grey, border: `1px solid ${COLORS.line}` }} /> Unavailable
              </span>
            </div>
            <p className="text-sm mb-3" style={{ color: COLORS.sub }}>Tap a green date to request AM, PM or a whole day.</p>

            <CalendarGrid
              cells={activeCells}
              isAvailable={(c) => {
                const slots = activeData.openSlots[c.day] || {};
                const b = activeData.bookings[c.day] || {};
                return getAvailableTypes(c.dayType, slots, b).length > 0;
              }}
              selectedDay={selectedDay}
              onSelect={(d) => setSelectedDay((prev) => (prev === d ? null : d))}
              isTodayFn={(d) => isTodayIn(activeParts.year, activeParts.month, d)}
            />

            {selectedDay && (() => {
              const dayType = getDayType(activeParts.year, activeParts.month, selectedDay);
              const dow = new Date(activeParts.year, activeParts.month, selectedDay).getDay();
              const daySlots = activeData.openSlots[selectedDay] || {};
              const anyOpen = Object.values(daySlots).some(Boolean);
              const dayBookings = activeData.bookings[selectedDay] || {};
              const available = anyOpen ? getAvailableTypes(dayType, daySlots, dayBookings) : [];
              const allTypes = slotTypesForDayType(dayType);
              return (
                <div className="rounded-lg p-3 mt-3" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.line}` }}>
                  <div className="mb-2">
                    <span className="text-sm font-bold">{String(selectedDay).padStart(2, "0")} {WEEKDAY_SHORT[dow]}</span>
                  </div>
                  {!anyOpen ? (
                    <p className="text-sm" style={{ color: COLORS.faint }}>Not open for requests.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {allTypes.map((type) => {
                        const booking = dayBookings[type];
                        if (!booking) {
                          if (available.includes(type)) {
                            return (
                              <button
                                key={type}
                                onClick={() => requestSlot(selectedDay, type)}
                                disabled={!locumName.trim()}
                                className="text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors duration-150 disabled:opacity-40"
                                style={{ border: `1.5px solid ${COLORS.sage}`, color: COLORS.sage }}
                              >
                                + {SLOT_LABELS[type]}
                              </button>
                            );
                          }
                          return null;
                        }
                        const mine = booking.name.toLowerCase() === locumName.trim().toLowerCase();
                        return (
                          <span
                            key={type}
                            className="text-xs font-medium px-2.5 py-1.5 rounded-full"
                            style={{
                              backgroundColor: booking.status === "booked" ? COLORS.brownSoftBg : COLORS.tan,
                              color: booking.status === "booked" ? COLORS.ink : COLORS.tanText,
                            }}
                          >
                            {SLOT_LABELS[type]} · {mine ? "You · " : ""}{booking.status === "booked" ? "Approved" : "Requested"}
                          </span>
                        );
                      })}
                      {available.length === 0 && Object.keys(dayBookings).length > 0 && (
                        <p className="text-xs w-full mt-1" style={{ color: COLORS.faint }}>No slots left to request for this day.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
