"use client";



import { zodResolver } from "@hookform/resolvers/zod";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { format } from "date-fns";

import { CalendarIcon, Loader2 } from "lucide-react";

import { useEffect } from "react";

import { useForm } from "react-hook-form";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { Calendar } from "@/components/ui/calendar";

import {

  Dialog,

  DialogContent,

  DialogDescription,

  DialogFooter,

  DialogHeader,

  DialogTitle,

} from "@/components/ui/dialog";

import {

  Form,

  FormControl,

  FormField,

  FormItem,

  FormLabel,

  FormMessage,

} from "@/components/ui/form";

import {

  Popover,

  PopoverContent,

  PopoverTrigger,

} from "@/components/ui/popover";

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";

import {

  type AssignDeliverymanFormValues,

  assignDeliverymanSchema,

} from "@/schema/delivery.schema";

import { orpc } from "@/utils/orpc";



const VEHICLE_OPTIONS = [

  { value: "bike", label: "Bike" },

  { value: "car", label: "Car" },

  { value: "van", label: "Van" },

  { value: "truck", label: "Truck" },

] as const;



type PendingGroupOption = {

  id: number;

  groupName: string;

  areaLabel: string;

  totalInvoices: number;

};



type AssignRiderModalProps = {

  open: boolean;

  onOpenChange: (open: boolean) => void;

  groupId?: number;

  groupName?: string;

  orderShippingArea?: string | null;

  preselectedRiderId?: string;

  preselectedRiderName?: string;

  pendingGroups?: PendingGroupOption[];

  onSuccess?: () => void;

};



export function AssignRiderModal({

  open,

  onOpenChange,

  groupId,

  groupName,

  orderShippingArea,

  preselectedRiderId,

  preselectedRiderName,

  pendingGroups,

  onSuccess,

}: AssignRiderModalProps) {

  const queryClient = useQueryClient();

  const isRiderFirstMode = !!preselectedRiderId;



  const form = useForm<AssignDeliverymanFormValues>({

    resolver: zodResolver(assignDeliverymanSchema),

    defaultValues: {

      groupId: groupId ?? 0,

      deliverymanId: preselectedRiderId ?? "",

      vehicleType: undefined,

      expectedDeliveryAt: new Date().toISOString().split("T")[0],

    },

  });



  useEffect(() => {

    if (open) {

      form.reset({

        groupId: groupId ?? 0,

        deliverymanId: preselectedRiderId ?? "",

        vehicleType: undefined,

        expectedDeliveryAt: new Date().toISOString().split("T")[0],

      });

    }

  }, [open, groupId, preselectedRiderId, form]);



  const { data: deliverymenResult, isLoading: loadingDeliverymen } = useQuery({

    ...orpc.deliveryman.getDeliverymenForAssignment.queryOptions({

      input: { orderShippingArea: orderShippingArea ?? undefined },

    }),

    enabled: open && !isRiderFirstMode,

  });



  const assignMutation = useMutation(

    orpc.deliveryman.assignDeliveryman.mutationOptions({

      onSuccess: () => {

        void queryClient.invalidateQueries({

          queryKey: orpc.warehouse.getDeliveryTeamAssignments.key(),

        });

        void queryClient.invalidateQueries({

          queryKey: orpc.warehouse.getDeliveryTeamRidersOverview.key(),

        });

        void queryClient.invalidateQueries({

          queryKey: orpc.deliveryman.getGroupById.key(),

        });

        toast.success("Rider assigned successfully");

        onOpenChange(false);

        onSuccess?.();

      },

      onError: (error) => {

        toast.error(error.message || "Failed to assign rider");

      },

    }),

  );



  const deliverymen = deliverymenResult?.deliverymen ?? [];

  const groups = pendingGroups ?? [];



  const onSubmit = (data: AssignDeliverymanFormValues) => {

    if (!data.groupId || data.groupId <= 0) {

      toast.error("Select a delivery group");

      return;

    }

    if (!data.deliverymanId) {

      toast.error("Select a rider");

      return;

    }



    assignMutation.mutate({

      groupId: data.groupId,

      deliverymanId: data.deliverymanId,

      vehicleType: data.vehicleType || undefined,

      expectedDeliveryAt: data.expectedDeliveryAt || undefined,

    });

  };



  return (

    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="sm:max-w-md">

        <DialogHeader>

          <DialogTitle>Assign Rider</DialogTitle>

          <DialogDescription>

            {isRiderFirstMode

              ? preselectedRiderName

                ? `Assign a pending group to ${preselectedRiderName}.`

                : "Select a pending group for this rider."

              : groupName

                ? `Assign a delivery rider to ${groupName}.`

                : "Select a rider for this delivery group."}

          </DialogDescription>

        </DialogHeader>



        <Form {...form}>

          <form

            id="assign-rider-form"

            onSubmit={form.handleSubmit(onSubmit)}

            className="space-y-4"

          >

            {isRiderFirstMode ? (

              <>

                <FormItem>

                  <FormLabel>Rider</FormLabel>

                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">

                    {preselectedRiderName ?? "Selected rider"}

                  </div>

                </FormItem>

                <FormField

                  control={form.control}

                  name="groupId"

                  render={({ field }) => (

                    <FormItem>

                      <FormLabel>Pending group</FormLabel>

                      <Select

                        value={field.value > 0 ? String(field.value) : ""}

                        onValueChange={(value) =>

                          field.onChange(Number.parseInt(value, 10))

                        }

                      >

                        <FormControl>

                          <SelectTrigger>

                            <SelectValue placeholder="Select group" />

                          </SelectTrigger>

                        </FormControl>

                        <SelectContent>

                          {groups.length === 0 ? (

                            <SelectItem value="0" disabled>

                              No pending groups

                            </SelectItem>

                          ) : (

                            groups.map((group) => (

                              <SelectItem

                                key={group.id}

                                value={String(group.id)}

                              >

                                {group.groupName} — {group.areaLabel} (

                                {group.totalInvoices} orders)

                              </SelectItem>

                            ))

                          )}

                        </SelectContent>

                      </Select>

                      <FormMessage />

                    </FormItem>

                  )}

                />

              </>

            ) : (

              <FormField

                control={form.control}

                name="deliverymanId"

                render={({ field }) => (

                  <FormItem>

                    <FormLabel>Rider</FormLabel>

                    <Select

                      value={field.value}

                      onValueChange={field.onChange}

                      disabled={loadingDeliverymen}

                    >

                      <FormControl>

                        <SelectTrigger>

                          <SelectValue

                            placeholder={

                              loadingDeliverymen ? "Loading…" : "Select rider"

                            }

                          />

                        </SelectTrigger>

                      </FormControl>

                      <SelectContent>

                        {deliverymen.map((rider) => (

                          <SelectItem

                            key={rider.id}

                            value={rider.id}

                            disabled={rider.hasActiveGroup}

                          >

                            {rider.name}

                            {rider.phoneNumber ? ` (${rider.phoneNumber})` : ""}

                            {rider.hasActiveGroup ? " — busy" : ""}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                    <FormMessage />

                  </FormItem>

                )}

              />

            )}

            <FormField

              control={form.control}

              name="vehicleType"

              render={({ field }) => (

                <FormItem>

                  <FormLabel>Vehicle (optional)</FormLabel>

                  <Select

                    value={field.value ?? ""}

                    onValueChange={(value) =>

                      field.onChange(value || undefined)

                    }

                  >

                    <FormControl>

                      <SelectTrigger>

                        <SelectValue placeholder="None" />

                      </SelectTrigger>

                    </FormControl>

                    <SelectContent>

                      {VEHICLE_OPTIONS.map((option) => (

                        <SelectItem key={option.value} value={option.value}>

                          {option.label}

                        </SelectItem>

                      ))}

                    </SelectContent>

                  </Select>

                  <FormMessage />

                </FormItem>

              )}

            />

            <FormField

              control={form.control}

              name="expectedDeliveryAt"

              render={({ field }) => (

                <FormItem className="flex flex-col">

                  <FormLabel>Expected delivery date (optional)</FormLabel>

                  <Popover>

                    <PopoverTrigger asChild>

                      <FormControl>

                        <Button

                          type="button"

                          variant="outline"

                          className={`w-full justify-start text-left font-normal ${

                            !field.value ? "text-muted-foreground" : ""

                          }`}

                        >

                          <CalendarIcon className="mr-2 h-4 w-4" />

                          {field.value

                            ? format(new Date(field.value), "PPP")

                            : "Pick a date"}

                        </Button>

                      </FormControl>

                    </PopoverTrigger>

                    <PopoverContent className="w-auto p-0" align="start">

                      <Calendar

                        mode="single"

                        selected={

                          field.value ? new Date(field.value) : undefined

                        }

                        onSelect={(date) =>

                          field.onChange(

                            date ? format(date, "yyyy-MM-dd") : "",

                          )

                        }

                        initialFocus

                      />

                    </PopoverContent>

                  </Popover>

                  <FormMessage />

                </FormItem>

              )}

            />

          </form>

        </Form>



        <DialogFooter>

          <Button

            type="button"

            variant="outline"

            onClick={() => onOpenChange(false)}

            disabled={assignMutation.isPending}

          >

            Cancel

          </Button>

          <Button

            type="submit"

            form="assign-rider-form"

            disabled={

              assignMutation.isPending ||

              loadingDeliverymen ||

              (isRiderFirstMode && groups.length === 0)

            }

          >

            {assignMutation.isPending ? (

              <>

                <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                Assigning…

              </>

            ) : (

              "Assign Rider"

            )}

          </Button>

        </DialogFooter>

      </DialogContent>

    </Dialog>

  );

}


