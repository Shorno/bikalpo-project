import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "./section-header";

type CartonNotesProps = {
  note: string;
  onNoteChange: (value: string) => void;
};

export function CartonNotes({ note, onNoteChange }: CartonNotesProps) {
  return (
    <div>
      <SectionHeader
        title="Notes"
        description="Optional internal notes for warehouse staff."
      />
      <div>
        <Label htmlFor="carton-note" className="text-sm font-medium text-foreground/80 mb-2 block">
          Note
        </Label>
        <Textarea
          id="carton-note"
          placeholder="Add any internal notes about this carton..."
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={3}
          className="resize-none text-sm"
        />
      </div>
    </div>
  );
}
