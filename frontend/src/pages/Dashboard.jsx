import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { SlidersHorizontal, Map } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";
import PreferencesForm from "@/components/PreferencesForm";
import ItineraryView from "@/components/ItineraryView";
import { useAuth } from "@/context/AuthContext";
import useItineraries from "@/hooks/useItineraries";
import api, { formatApiError } from "@/lib/api";

// Required preference fields users must fill before generating an itinerary
const REQUIRED_FIELDS = [
  { key: "destination", label: "Destination" },
  { key: "start_date", label: "Start Date" },
  { key: "end_date", label: "End Date" },
  { key: "budget", label: "Budget" },
  { key: "num_travelers", label: "Travelers" },
];

const getMissingPrefs = (prefs) =>
  REQUIRED_FIELDS.filter((f) => {
    const v = prefs?.[f.key];
    if (v === undefined || v === null) return true;
    if (typeof v === "string") return v.trim() === "";
    return false;
  });

const serializePrefs = (p) => ({
  age: p.age || "",
  destination: p.destination || "",
  start_date: p.start_date ? format(p.start_date, "yyyy-MM-dd") : "",
  end_date: p.end_date ? format(p.end_date, "yyyy-MM-dd") : "",
  budget: p.budget || "",
  travel_style: p.travel_style || "",
  activity_types: p.activity_types || [],
  walking_tolerance: p.walking_tolerance ?? 5,
  food_preferences: p.food_preferences || "",
  hotel_preference: p.hotel_preference || "",
  num_travelers: p.num_travelers || "",
});

const mkMsg = (role, text, itinerary = null) => ({
  id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  role,
  text,
  itinerary,
});

export default function Dashboard() {
  const { user, logout } = useAuth();
  const {
    itineraries,
    currentItinerary,
    setCurrentItinerary,
    savedId,
    setSavedId,
    saving,
    saveItinerary,
    selectItinerary,
    deleteItinerary,
  } = useItineraries();

  const [prefs, setPrefs] = useState({ walking_tolerance: 5, activity_types: [] });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("preferences");
  const [showErrors, setShowErrors] = useState(false);

  const missing = useMemo(() => getMissingPrefs(prefs), [prefs]);
  const missingKeys = useMemo(() => missing.map((m) => m.key), [missing]);

  const runChat = async (intent) => {
    if (loading) return;

    // Enforce required preferences BEFORE the first itinerary is generated.
    // Once an itinerary exists, users can freely chat to refine/update it.
    if (!currentItinerary && missing.length > 0) {
      setShowErrors(true);
      setTab("preferences");
      const labels = missing.map((m) => m.label).join(", ");
      toast.error(`Please fill in your preferences first: ${labels}`);
      return;
    }

    const userText =
      input.trim() ||
      (intent === "update"
        ? "Please update my itinerary based on my preferences."
        : "Create a travel itinerary based on my preferences.");
    // Send recent conversation so the AI keeps context across turns.
    const history = messages.slice(-12).map((m) => ({
      role: m.role === "ai" ? "assistant" : "user",
      text: m.text,
    }));
    setMessages((m) => [...m, mkMsg("user", userText)]);
    setInput("");
    setLoading(true);
    try {
      const { data } = await api.post("/chat", {
        message: userText,
        preferences: serializePrefs(prefs),
        current_itinerary: currentItinerary,
        history,
      });
      const it = data.itinerary && data.itinerary.days ? data.itinerary : null;
      setMessages((m) => [...m, mkMsg("ai", data.reply, it)]);
      if (it) {
        setCurrentItinerary(it);
        if (data.action === "create") setSavedId(null);
        setTab("itinerary");
      }
    } catch (e) {
      const msg = formatApiError(e.response?.data?.detail) || e.message;
      setMessages((m) => [...m, mkMsg("ai", `Sorry, something went wrong: ${msg}`)]);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (id) => {
    const data = await selectItinerary(id);
    if (data) {
      setMessages([mkMsg("ai", `Loaded your saved itinerary: ${data.title || data.destination}.`, data)]);
      setTab("itinerary");
    }
  };

  const handleClear = () => {
    setMessages([]);
    setCurrentItinerary(null);
    setSavedId(null);
    setInput("");
    setShowErrors(false);
    setTab("preferences");
  };

  // Only block on first generation. After an itinerary exists, all buttons stay enabled.
  const blockCreate = !currentItinerary && missing.length > 0;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        itineraries={itineraries}
        activeId={savedId}
        onSelect={handleSelect}
        onNew={handleClear}
        onDelete={deleteItinerary}
        user={user}
        onLogout={logout}
      />

      <main className="flex-1 min-w-0">
        <ChatPanel
          messages={messages}
          input={input}
          setInput={setInput}
          onGenerate={() => runChat("create")}
          onUpdate={() => runChat("update")}
          onSave={() => saveItinerary(serializePrefs(prefs).destination)}
          onClear={handleClear}
          loading={loading}
          saving={saving}
          hasItinerary={!!currentItinerary}
          missingPrefs={blockCreate ? missing : []}
        />
      </main>

      <section className="hidden lg:flex w-[440px] flex-col border-l border-stone-200 bg-white h-screen">
        <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
          <div className="border-b border-stone-200 px-6 pt-6">
            <TabsList className="bg-[#EFECE5]">
              <TabsTrigger value="preferences" data-testid="tab-preferences" className="data-[state=active]:bg-white">
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} /> Preferences
              </TabsTrigger>
              <TabsTrigger value="itinerary" data-testid="tab-itinerary" className="data-[state=active]:bg-white">
                <Map className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} /> Itinerary
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="preferences" className="mt-0">
              <PreferencesForm
                prefs={prefs}
                setPrefs={setPrefs}
                requiredKeys={REQUIRED_FIELDS.map((f) => f.key)}
                missingKeys={showErrors ? missingKeys : []}
              />
            </TabsContent>
            <TabsContent value="itinerary" className="mt-0">
              {currentItinerary ? (
                <ItineraryView itinerary={currentItinerary} />
              ) : (
                <p className="text-sm text-[#78716C]">
                  No itinerary yet. Set your preferences and hit “Generate Itinerary”.
                </p>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </section>
    </div>
  );
}
