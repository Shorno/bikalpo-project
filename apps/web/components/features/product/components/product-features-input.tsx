"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
    <div className="space-y-4">
      {value.map((group, groupIndex) => (
        <Card key={groupIndex} className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
              <div className="flex-1">
                <Input
                  placeholder="Feature group title (e.g., Specifications)"
                  value={group.title}
                  onChange={(e) => updateGroupTitle(groupIndex, e.target.value)}
                  className="font-medium"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeFeatureGroup(groupIndex)}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {group.items.map((item, itemIndex) => (
              <div key={itemIndex} className="flex items-center gap-2">
                <Input
                  placeholder="Key (e.g., Weight)"
                  value={item.key}
                  onChange={(e) =>
                    updateFeatureItem(
                      groupIndex,
                      itemIndex,
                      "key",
                      e.target.value,
                    )
                  }
                  className="flex-1"
                />
                <Input
                  placeholder="Value (e.g., 500g)"
                  value={item.value}
                  onChange={(e) =>
                    updateFeatureItem(
                      groupIndex,
                      itemIndex,
                      "value",
                      e.target.value,
                    )
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFeatureItem(groupIndex, itemIndex)}
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addFeatureItem(groupIndex)}
              className="w-full mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Feature Item
            </Button>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addFeatureGroup}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Feature Group
      </Button>
    </div>
  );
}
