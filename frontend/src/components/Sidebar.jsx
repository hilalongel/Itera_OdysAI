import { Compass, Plus, MapPin, Trash2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Sidebar({
  itineraries,
  activeId,
  onSelect,
  onNew,
  onDelete,
  user,
  onLogout,
}) {
  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-stone-200 bg-[#EFECE5] h-screen p-5">
      <div className="flex items-center gap-2 px-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3F5E4D] text-white">
          <Compass className="h-4.5 w-4.5" strokeWidth={1.5} />
        </span>
        <span className="font-heading text-xl font-semibold text-[#292524]">OdysAI</span>
      </div>

      <Button
        data-testid="new-itinerary-btn"
        onClick={onNew}
        className="mt-6 w-full justify-start bg-[#C05621] hover:bg-[#A8481B] text-white transition-all hover:-translate-y-0.5"
      >
        <Plus className="mr-2 h-4 w-4" strokeWidth={1.75} /> New Itinerary
      </Button>

      <p className="mt-7 mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#a8a29e]">
        Saved Trips
      </p>
      <div className="flex-1 space-y-1 overflow-y-auto">
        {itineraries.length === 0 ? (
          <p className="px-1 text-xs text-[#a8a29e]">No saved trips yet.</p>
        ) : (
          itineraries.map((it) => (
            <div
              key={it.itinerary_id}
              data-testid={`saved-item-${it.itinerary_id}`}
              onClick={() => onSelect(it.itinerary_id)}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 transition-colors ${
                activeId === it.itinerary_id ? "bg-black/10" : "hover:bg-black/5"
              }`}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#78716C]" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#292524]">
                  {it.title || it.destination || "Untitled trip"}
                </p>
                <p className="truncate text-[11px] text-[#78716C]">{it.destination}</p>
              </div>
              <button
                data-testid={`delete-item-${it.itinerary_id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(it.itinerary_id);
                }}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5 text-[#a8a29e] hover:text-[#b91c1c]" strokeWidth={1.5} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 border-t border-stone-200 pt-4">
        <div className="flex items-center gap-2 px-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C05621] text-xs font-medium text-white">
            {(user?.full_name || "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#292524]">{user?.full_name}</p>
            <p className="truncate text-[11px] text-[#78716C]">{user?.email}</p>
          </div>
          <button data-testid="logout-btn" onClick={onLogout} title="Log out">
            <LogOut className="h-4 w-4 text-[#78716C] hover:text-[#292524]" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </aside>
  );
}
