"use client";

type CylinderSaleMode = "new" | "exchange";

export function CylinderSaleModeToggle({
  value,
  onChange,
}: {
  value: CylinderSaleMode;
  onChange: (mode: CylinderSaleMode) => void;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Cylinder Sale
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {(["new", "exchange"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
              value === mode
                ? "border-teal-500 bg-teal-50 text-teal-800"
                : "border-gray-200 bg-white text-gray-600 hover:border-teal-300"
            }`}
          >
            <span className="block text-xs font-bold capitalize">{mode}</span>
            <span className="block text-[10px] mt-0.5">
              {mode === "new"
                ? "No empty cylinder returned"
                : "Return 1 empty cylinder"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
