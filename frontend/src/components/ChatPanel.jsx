import { useEffect, useRef } from "react";
import { Send, Sparkles, RefreshCw, Save, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ItineraryView from "@/components/ItineraryView";

const AI_AVATAR =
  "https://static.prod-images.emergentagent.com/jobs/a7fd30bd-3884-4739-b1aa-0936349ac211/images/22966a4ab277d78792812415445bf64a5136850c6e6c57db821d9925a197078d.png";
const EMPTY_TEXTURE =
  "https://static.prod-images.emergentagent.com/jobs/a7fd30bd-3884-4739-b1aa-0936349ac211/images/1595797195a93bda544bfec07098eb9af943441915ff1f785aa3462048006209.png";

function Message({ message }) {
  const { role, text, itinerary } = message;
  if (role === "user") {
    return (
      <div className="flex justify-end odys-fade-up">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#C05621] px-5 py-3 text-sm text-white">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 odys-fade-up">
      <img src={AI_AVATAR} alt="OdysAI" className="h-8 w-8 rounded-full object-cover" />
      <div className={itinerary ? "w-full min-w-0" : "max-w-[90%]"}>
        <div className="pt-1 text-sm leading-relaxed text-[#292524]">{text}</div>
        {itinerary && (
          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
            <ItineraryView itinerary={itinerary} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({
  messages,
  input,
  setInput,
  onGenerate,
  onUpdate,
  onSave,
  onClear,
  loading,
  saving,
  hasItinerary,
  missingPrefs = [],
}) {
  const hasMissing = missingPrefs.length > 0;
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onGenerate();
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#F7F6F2]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-8 py-8">
          {messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <img
                src={EMPTY_TEXTURE}
                alt=""
                className="mb-6 h-28 w-28 opacity-70"
              />
              <h2 className="font-heading text-3xl font-medium text-[#292524]">
                Where to next?
              </h2>
              <p className="mt-2 max-w-md text-sm text-[#78716C]">
                Fill in your travel preferences on the right, then tell OdysAI what you're dreaming of.
                Try “Plan a relaxed 4-day food tour of Rome.”
              </p>
              {hasMissing && (
                <p
                  data-testid="empty-state-missing-prefs"
                  className="mt-4 max-w-md rounded-md border border-[#B23A1A]/30 bg-[#FBEDE6] px-4 py-2 text-xs text-[#7A2B14]"
                >
                  Required before generating:{" "}
                  <span className="font-semibold">
                    {missingPrefs.map((m) => m.label).join(", ")}
                  </span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <Message key={m.id} message={m} />
              ))}
              {loading && (
                <div className="flex items-center gap-3 text-sm text-[#78716C]">
                  <img src={AI_AVATAR} alt="OdysAI" className="h-8 w-8 rounded-full object-cover" />
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Crafting your itinerary…
                  </span>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input + actions */}
      <div className="border-t border-stone-200 bg-[#F7F6F2]/80 px-4 sm:px-8 py-4 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-3xl space-y-3">
          <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white/70 px-5 py-2 shadow-sm backdrop-blur-xl">
            <input
              data-testid="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask OdysAI to plan or change your trip…"
              className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-[#a8a29e]"
            />
            <Button
              data-testid="chat-send-btn"
              size="icon"
              onClick={onGenerate}
              disabled={loading}
              className="h-9 w-9 rounded-full bg-[#C05621] hover:bg-[#A8481B] text-white"
            >
              <Send className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              data-testid="generate-btn"
              onClick={onGenerate}
              disabled={loading}
              className="bg-[#C05621] hover:bg-[#A8481B] text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
            >
              <Sparkles className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> Generate Itinerary
            </Button>
            <Button
              data-testid="update-btn"
              variant="outline"
              onClick={onUpdate}
              disabled={loading || !hasItinerary}
              className="border-stone-300 bg-white text-[#292524] hover:bg-stone-50 transition-all hover:-translate-y-0.5"
            >
              <RefreshCw className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> Update
            </Button>
            <Button
              data-testid="save-btn"
              variant="outline"
              onClick={onSave}
              disabled={saving || !hasItinerary}
              className="border-[#3F5E4D]/30 bg-white text-[#3F5E4D] hover:bg-[#E5EBE8] transition-all hover:-translate-y-0.5"
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
              )}
              Save
            </Button>
            <Button
              data-testid="clear-btn"
              variant="ghost"
              onClick={onClear}
              disabled={loading}
              className="text-[#78716C] hover:text-[#292524] transition-all"
            >
              <Trash2 className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> Clear
            </Button>
          </div>

          {hasMissing && (
            <p
              data-testid="missing-prefs-hint"
              className="text-xs text-[#7A2B14]"
            >
              Fill in your preferences to generate:{" "}
              <span className="font-semibold">
                {missingPrefs.map((m) => m.label).join(", ")}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
