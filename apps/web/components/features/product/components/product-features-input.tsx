"use client";

import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type FeatureItem = {
  key: string;
  value: string;
};

export type FeatureGroup = {
  title: string;
  items: FeatureItem[];
};

interface ProductFeaturesInputProps {
  value: FeatureGroup[];
  onChange: (features: FeatureGroup[]) => void;
}

export default function ProductFeaturesInput({
  value = [],
  onChange,
}: ProductFeaturesInputProps) {
  const addFeatureGroup = () => {
    onChange([
      ...value,
      {
        title: "",
        items: [{ key: "", value: "" }],
      },
    ]);
  };

  const removeFeatureGroup = (groupIndex: number) => {
    onChange(value.filter((_, index) => index !== groupIndex));
  };

  const updateGroupTitle = (groupIndex: number, title: string) => {
    const updated = [...value];
    updated[groupIndex] = { ...updated[groupIndex], title };
    onChange(updated);
  };

  const addFeatureItem = (groupIndex: number) => {
    const updated = [...value];
    updated[groupIndex] = {
      ...updated[groupIndex],
      items: [...updated[groupIndex].items, { key: "", value: "" }],
    };
    onChange(updated);
  };

  const removeFeatureItem = (groupIndex: number, itemIndex: number) => {
    const updated = [...value];
    updated[groupIndex] = {
      ...updated[groupIndex],
      items: updated[groupIndex].items.filter(
        (_, index) => index !== itemIndex,
      ),
    };
    // Remove group if no items left
    if (updated[groupIndex].items.length === 0) {
      onChange(updated.filter((_, index) => index !== groupIndex));
    } else {
      onChange(updated);
    }
  };

  const updateFeatureItem = (
    groupIndex: number,
    itemIndex: number,
    field: "key" | "value",
    newValue: string,
  ) => {
    const updated = [...value];
    updated[groupIndex] = {
      ...updated[groupIndex],
      items: updated[groupIndex].items.map((item, index) =>
        index === itemIndex ? { ...item, [field]: newValue } : item,
      ),
    };
    onChange(updated);
  };

  return (
    <div className="@container/features space-y-5">
      {value.length > 0 && (
        <div className="space-y-5">
          {value.map((group, groupIndex) => (
            <fieldset
              key={groupIndex}
              className="min-w-0 space-y-3 not-first:border-t not-first:pt-5"
            >
              <legend className="sr-only">
                Feature group {groupIndex + 1}
              </legend>
              <div className="flex items-end gap-2">
                <label className="min-w-0 flex-1 space-y-1.5">
                  <span className="block text-xs font-medium text-muted-foreground">
                    Group name
                  </span>
                  <Input
                    aria-label={`Feature group ${groupIndex + 1} name`}
                    placeholder="e.g. Specifications"
                    value={group.title}
                    onChange={(e) =>
                      updateGroupTitle(groupIndex, e.target.value)
                    }
                    className="font-medium"
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove feature group ${group.title || groupIndex + 1}`}
                  title="Remove group"
                  onClick={() => removeFeatureGroup(groupIndex)}
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3">
                {group.items.map((item, itemIndex) => (
                  <div
                    key={itemIndex}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 @sm/features:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    <label className="min-w-0 space-y-1.5">
                      <span
                        className={`block text-xs font-medium text-muted-foreground ${itemIndex > 0 ? "@sm/features:sr-only" : ""}`}
                      >
                        Key
                      </span>
                      <Input
                        aria-label={`Group ${groupIndex + 1}, feature ${itemIndex + 1} key`}
                        placeholder="e.g. Weight"
                        value={item.key}
                        onChange={(e) =>
                          updateFeatureItem(
                            groupIndex,
                            itemIndex,
                            "key",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="col-start-1 min-w-0 space-y-1.5 @sm/features:col-start-2">
                      <span
                        className={`block text-xs font-medium text-muted-foreground ${itemIndex > 0 ? "@sm/features:sr-only" : ""}`}
                      >
                        Value
                      </span>
                      <Input
                        aria-label={`Group ${groupIndex + 1}, feature ${itemIndex + 1} value`}
                        placeholder="e.g. 500g"
                        value={item.value}
                        onChange={(e) =>
                          updateFeatureItem(
                            groupIndex,
                            itemIndex,
                            "value",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove feature ${item.key || itemIndex + 1} from group ${groupIndex + 1}`}
                      title="Remove item"
                      onClick={() => removeFeatureItem(groupIndex, itemIndex)}
                      className="col-start-2 row-span-2 row-start-1 h-8 w-8 self-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive @sm/features:col-start-3 @sm/features:row-span-1 @sm/features:self-end"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addFeatureItem(groupIndex)}
                  className="-ml-2 w-fit text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Add item
                </Button>
              </div>
            </fieldset>
          ))}
        </div>
      )}

      <div className={value.length > 0 ? "border-t pt-4" : undefined}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addFeatureGroup}
          className="w-full @sm/features:w-auto"
        >
          <Plus className="h-4 w-4" />
          Add feature group
        </Button>
      </div>
    </div>
  );
}
