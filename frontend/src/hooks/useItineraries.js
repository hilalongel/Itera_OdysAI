import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";

const buildPayload = (it, fallbackDest) => ({
  title: it.title || fallbackDest || "Trip",
  destination: it.destination || fallbackDest || "",
  start_date: it.start_date || "",
  end_date: it.end_date || "",
  days: (it.days || []).map((d) => ({
    day_number: d.day_number,
    weather_snapshot: d.weather_snapshot || "",
    activities: (d.activities || []).map((a) => ({
      title: a.title,
      description: a.description || "",
      time_slot: a.time_slot || "",
      estimated_cost: a.estimated_cost || 0,
      latitude: a.latitude ?? null,
      longitude: a.longitude ?? null,
      activity_type: a.activity_type || "Activity",
      booking_reference_url: a.booking_reference_url || "",
    })),
  })),
});

const errMsg = (e) => formatApiError(e.response?.data?.detail) || e.message;

export default function useItineraries() {
  const [itineraries, setItineraries] = useState([]);
  const [currentItinerary, setCurrentItinerary] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      const { data } = await api.get("/itineraries");
      setItineraries(data);
    } catch (e) {
      console.error("Failed to load saved itineraries:", e);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveItinerary = useCallback(
    async (fallbackDest) => {
      if (!currentItinerary) return;
      setSaving(true);
      try {
        const payload = buildPayload(currentItinerary, fallbackDest);
        const { data } = savedId
          ? await api.put(`/itineraries/${savedId}`, payload)
          : await api.post("/itineraries", payload);
        setSavedId(data.itinerary_id);
        setCurrentItinerary(data);
        await reload();
        toast.success("Itinerary saved!");
      } catch (e) {
        toast.error(errMsg(e));
      } finally {
        setSaving(false);
      }
    },
    [currentItinerary, savedId, reload]
  );

  const selectItinerary = useCallback(async (id) => {
    try {
      const { data } = await api.get(`/itineraries/${id}`);
      setCurrentItinerary(data);
      setSavedId(id);
      return data;
    } catch (e) {
      toast.error(errMsg(e));
      return null;
    }
  }, []);

  const deleteItinerary = useCallback(
    async (id) => {
      try {
        await api.delete(`/itineraries/${id}`);
        setSavedId((cur) => {
          if (cur === id) setCurrentItinerary(null);
          return cur === id ? null : cur;
        });
        await reload();
        toast.success("Itinerary deleted.");
      } catch (e) {
        toast.error(errMsg(e));
      }
    },
    [reload]
  );

  return {
    itineraries,
    currentItinerary,
    setCurrentItinerary,
    savedId,
    setSavedId,
    saving,
    reload,
    saveItinerary,
    selectItinerary,
    deleteItinerary,
  };
}
