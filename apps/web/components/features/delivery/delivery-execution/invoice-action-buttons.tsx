import { CheckCircle, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface InvoiceActionButtonsProps {
  onDelivered: () => void;
  onFailed: () => void;
  onReturn: () => void;
}

export function InvoiceActionButtons({
  onDelivered,
  onFailed,
  onReturn,
}: InvoiceActionButtonsProps) {
  return (
    <>
      <Separator className="my-3 sm:mb-4" />
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 sm:h-9 text-xs sm:text-sm text-destructive hover:text-destructive"
          onClick={onFailed}
        >
          <XCircle className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Failed
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 sm:h-9 text-xs sm:text-sm text-amber-600 hover:text-amber-600 hover:bg-amber-50"
          onClick={onReturn}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Return
        </Button>
        <Button
          size="sm"
          className="w-full h-8 sm:h-9 text-xs sm:text-sm"
          onClick={onDelivered}
        >
          <CheckCircle className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Delivered
        </Button>
      </div>
    </>
  );
}
