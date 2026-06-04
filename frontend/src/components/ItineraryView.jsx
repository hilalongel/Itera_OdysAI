import { Plane, Hotel, MapPin, Clock, ExternalLink, CloudSun } from "lucide-react";

const TYPE_STYLES = {
  Flight: { bg: "#FCEADD", text: "#C05621", Icon: Plane },
  Hotel: { bg: "#E5EBE8", text: "#3F5E4D", Icon: Hotel },
  Activity: { bg: "#EFECE5", text: "#57534E", Icon: MapPin },
};

// Build a reliable booking/reference link from data we trust (the activity
// name, its type, and the destination) instead of the model's invented URL,
// which is often broken. Each type routes to a real site that always resolves.
function buildBookingUrl(activity, destination) {
  const place = `${activity.title || ""} ${destination || ""}`.trim();
  const q = encodeURIComponent(place);
  switch (activity.activity_type) {
    case "Hotel":
      return `https://www.booking.com/searchresults.html?ss=${q}`;
    case "Flight":
      return `https://www.google.com/travel/flights?q=${encodeURIComponent(
        `flights to ${destination || ""}`.trim()
      )}`;
    default:
      return `https://www.getyourguide.com/s/?q=${q}`;
  }
}

function ActivityCard({ activity, index, destination }) {
  const style = TYPE_STYLES[activity.activity_type] || TYPE_STYLES.Activity;
  const { Icon } = style;
  const mapsUrl =
    activity.latitude != null && activity.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${activity.latitude},${activity.longitude}`
      : null;
  const bookingUrl = buildBookingUrl(activity, destination);

  return (
    <div
      data-testid={`activity-card-${index}`}
      className="relative rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-[#C05621]/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ backgroundColor: style.bg, color: style.text }}
          >
            <Icon className="h-3 w-3" strokeWidth={1.75} />
            {activity.activity_type}
          </span>
          {activity.time_slot && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#78716C]">
              <Clock className="h-3 w-3" strokeWidth={1.5} />
              {activity.time_slot}
            </span>
          )}
        </div>
        {typeof activity.estimated_cost === "number" && (
          <span className="font-mono text-sm font-medium text-[#292524]">
            {activity.estimated_cost > 0 ? `$${activity.estimated_cost}` : "Free"}
          </span>
        )}
      </div>

      <h4 className="mt-2.5 font-heading text-lg font-medium text-[#292524]">
        {activity.title}
      </h4>
      {activity.description && (
        <p className="mt-1 text-sm leading-relaxed text-[#57534E]">{activity.description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`activity-map-${index}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#3F5E4D] hover:underline"
          >
            <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
            View on map
          </a>
        )}
        {bookingUrl && (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`activity-booking-${index}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#C05621] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
            Booking / Reference
          </a>
        )}
      </div>
    </div>
  );
}

export default function ItineraryView({ itinerary }) {
  if (!itinerary || !itinerary.days || itinerary.days.length === 0) {
    return null;
  }

  let cardIdx = 0;

  return (
    <div className="space-y-8" data-testid="itinerary-view">
      <div>
        {itinerary.title && (
          <h2 className="font-heading text-3xl font-medium text-[#292524]">{itinerary.title}</h2>
        )}
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-[#78716C]">
          {itinerary.destination}
          {itinerary.start_date && ` · ${itinerary.start_date}`}
          {itinerary.end_date && ` → ${itinerary.end_date}`}
        </p>
      </div>

      <div className="relative space-y-8 border-l border-stone-200 pl-6">
        {itinerary.days.map((day) => (
          <div key={day.day_number} className="relative odys-fade-up">
            <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-[#C05621] font-mono text-[11px] font-medium text-white">
              {day.day_number}
            </span>
            <div className="mb-3 flex items-center gap-3">
              <h3 className="font-heading text-xl font-medium text-[#292524]">
                Day {day.day_number}
              </h3>
              {day.weather_snapshot && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#78716C]">
                  <CloudSun className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {day.weather_snapshot}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {(day.activities || []).map((act) => (
                <ActivityCard
                  key={cardIdx}
                  activity={act}
                  index={cardIdx++}
                  destination={itinerary.destination}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
