import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ACTIVITY_TYPES = [
  "Culture",
  "Food",
  "Nature",
  "Adventure",
  "Nightlife",
  "Shopping",
  "Relaxation",
  "History",
];

const fieldLabel = "font-mono text-[11px] uppercase tracking-[0.18em] text-[#78716C]";

function FieldLabel({ children, required, missing }) {
  return (
    <Label className={cn(fieldLabel, missing && "text-[#B23A1A]")}>
      {children}
      {required && <span className="ml-0.5 text-[#C05621]">*</span>}
    </Label>
  );
}

function DateField({ label, testid, value, onChange, required, missing }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel required={required} missing={missing}>{label}</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid={testid}
            className={cn(
              "flex h-11 w-full items-center gap-2 rounded-md border bg-white px-3 text-sm text-left transition-colors hover:border-[#C05621]/40",
              missing ? "border-[#B23A1A]" : "border-stone-200",
              !value && "text-[#a8a29e]"
            )}
          >
            <CalendarIcon className="h-4 w-4 text-[#78716C]" strokeWidth={1.5} />
            {value ? format(value, "MMM d, yyyy") : "Pick a date"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function PreferencesForm({ prefs, setPrefs, requiredKeys = [], missingKeys = [] }) {
  const update = (key, val) => setPrefs((p) => ({ ...p, [key]: val }));

  const isRequired = (k) => requiredKeys.includes(k);
  const isMissing = (k) => missingKeys.includes(k);

  const toggleActivity = (a) => {
    const current = prefs.activity_types || [];
    update(
      "activity_types",
      current.includes(a) ? current.filter((x) => x !== a) : [...current, a]
    );
  };

  return (
    <div className="space-y-5" data-testid="preferences-form">
      {missingKeys.length > 0 && (
        <div
          data-testid="prefs-error-banner"
          className="rounded-lg border border-[#B23A1A]/30 bg-[#FBEDE6] px-4 py-3 text-xs text-[#7A2B14]"
        >
          Please fill in the fields marked with <span className="font-semibold">*</span> before generating an itinerary.
        </div>
      )}

      {/* Destination — hero block */}
      <div
        className={cn(
          "rounded-xl border p-4",
          isMissing("destination")
            ? "border-[#B23A1A] bg-[#FBEDE6]"
            : "border-stone-200 bg-[#EFECE5]"
        )}
      >
        <FieldLabel required={isRequired("destination")} missing={isMissing("destination")}>
          Destination
        </FieldLabel>
        <Input
          data-testid="pref-destination"
          value={prefs.destination || ""}
          onChange={(e) => update("destination", e.target.value)}
          placeholder="e.g. Kyoto, Japan"
          className="mt-1.5 border-0 bg-transparent px-0 text-lg font-heading font-medium shadow-none focus-visible:ring-0 placeholder:text-[#a8a29e]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DateField
          label="Start Date"
          testid="pref-start-date"
          value={prefs.start_date}
          onChange={(d) => update("start_date", d)}
          required={isRequired("start_date")}
          missing={isMissing("start_date")}
        />
        <DateField
          label="End Date"
          testid="pref-end-date"
          value={prefs.end_date}
          onChange={(d) => update("end_date", d)}
          required={isRequired("end_date")}
          missing={isMissing("end_date")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <FieldLabel>Age</FieldLabel>
          <Input
            type="number"
            data-testid="pref-age"
            value={prefs.age || ""}
            onChange={(e) => update("age", e.target.value)}
            placeholder="30"
            className="h-11 bg-white border-stone-200"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel required={isRequired("num_travelers")} missing={isMissing("num_travelers")}>
            Travelers
          </FieldLabel>
          <Input
            type="number"
            min="1"
            data-testid="pref-travelers"
            value={prefs.num_travelers || ""}
            onChange={(e) => update("num_travelers", e.target.value)}
            placeholder="2"
            className={cn(
              "h-11 bg-white",
              isMissing("num_travelers") ? "border-[#B23A1A]" : "border-stone-200"
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <FieldLabel required={isRequired("budget")} missing={isMissing("budget")}>
            Budget
          </FieldLabel>
          <Select value={prefs.budget || ""} onValueChange={(v) => update("budget", v)}>
            <SelectTrigger
              data-testid="pref-budget"
              className={cn(
                "h-11 bg-white",
                isMissing("budget") ? "border-[#B23A1A]" : "border-stone-200"
              )}
            >
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Budget">Budget</SelectItem>
              <SelectItem value="Mid-range">Mid-range</SelectItem>
              <SelectItem value="Luxury">Luxury</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Travel Style</FieldLabel>
          <Select value={prefs.travel_style || ""} onValueChange={(v) => update("travel_style", v)}>
            <SelectTrigger data-testid="pref-style" className="h-11 bg-white border-stone-200">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Relaxed">Relaxed</SelectItem>
              <SelectItem value="Balanced">Balanced</SelectItem>
              <SelectItem value="Fast-paced">Fast-paced</SelectItem>
              <SelectItem value="Adventurous">Adventurous</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <FieldLabel>Hotel Preference</FieldLabel>
          <Select value={prefs.hotel_preference || ""} onValueChange={(v) => update("hotel_preference", v)}>
            <SelectTrigger data-testid="pref-hotel" className="h-11 bg-white border-stone-200">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Hostel">Hostel</SelectItem>
              <SelectItem value="Budget Hotel">Budget Hotel</SelectItem>
              <SelectItem value="Boutique">Boutique</SelectItem>
              <SelectItem value="Luxury Resort">Luxury Resort</SelectItem>
              <SelectItem value="Apartment / Airbnb">Apartment / Airbnb</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Food Preference</FieldLabel>
          <Input
            data-testid="pref-food"
            value={prefs.food_preferences || ""}
            onChange={(e) => update("food_preferences", e.target.value)}
            placeholder="e.g. Vegetarian, local"
            className="h-11 bg-white border-stone-200"
          />
        </div>
      </div>

      {/* Walking tolerance slider */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <FieldLabel>Walking Tolerance</FieldLabel>
          <span className="font-mono text-xs text-[#C05621]">
            {prefs.walking_tolerance ?? 5}/10
          </span>
        </div>
        <Slider
          data-testid="pref-walking"
          value={[prefs.walking_tolerance ?? 5]}
          min={1}
          max={10}
          step={1}
          onValueChange={(v) => update("walking_tolerance", v[0])}
        />
        <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-[#a8a29e]">
          <span>Minimal</span>
          <span>Marathon</span>
        </div>
      </div>

      {/* Activity types chips */}
      <div className="space-y-2.5">
        <FieldLabel>Preferred Activities</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_TYPES.map((a) => {
            const active = (prefs.activity_types || []).includes(a);
            return (
              <button
                key={a}
                type="button"
                data-testid={`pref-activity-${a.toLowerCase()}`}
                onClick={() => toggleActivity(a)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                  active
                    ? "border-[#C05621] bg-[#C05621] text-white"
                    : "border-stone-200 bg-white text-[#57534E] hover:border-[#C05621]/40"
                )}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
