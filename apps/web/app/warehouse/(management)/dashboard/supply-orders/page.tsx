"use client";

import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  InboxIcon,
  Loader2,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import { Fragment, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TableSkeleton from "@/components/table-skeleton";
import { orpc } from "@/utils/orpc";

/* ─── Types ─── */
interface OrderItem {
  id: number;
  productName: string;
  productSize: string | null;
  productImage: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

interface Order {
  id: number;
  orderNumber: string;
  status: string;
  total: string;
  paymentMethod: string | null;
  createdAt: string;
  buyerName: string | null;
  buyerShopName: string | null;
  buyerWarehouseName: string | null;
  shippingName: string | null;
  shippingPhone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingArea: string | null;
  items: OrderItem[];
}

/* ─── Status badge ─── */
const STATUS_MAP: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: "Pending", icon: Clock, className: "text-amber-700 border-amber-200 bg-amber-50" },
  confirmed: { label: "Confirmed", icon: CheckCircle, className: "text-blue-700 border-blue-200 bg-blue-50" },
  processing: { label: "Processing", icon: Package, className: "text-purple-700 border-purple-200 bg-purple-50" },
  delivered: { label: "Delivered", icon: Truck, className: "text-emerald-700 border-emerald-200 bg-emerald-50" },
  returned: { label: "Returned", icon: RotateCcw, className: "text-orange-700 border-orange-200 bg-orange-50" },
  cancelled: { label: "Cancelled", icon: XCircle, className: "text-red-700 border-red-200 bg-red-50" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending;
  const Icon = s.icon;
  return (
    <Badge variant="outline" className={`gap-1 text-[10px] font-semibold ${s.className}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </Badge>
  );
}

/* ─── Editable item row ─── */
function EditableItemRow({
  item,
  isEditing,
  editQty,
  onQtyChange,
}: {
  item: OrderItem;
  isEditing: boolean;
  editQty: number;
  onQtyChange: (qty: number) => void;
}) {
  const unitPrice = Number(item.unitPrice);
  const displayQty = isEditing ? editQty : item.quantity;
  const displayTotal = isEditing ? (unitPrice * editQty).toFixed(2) : item.totalPrice;
  const isRemoved = isEditing && editQty === 0;

  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 border transition-all ${
      isRemoved ? "border-destructive/30 bg-destructive/5 opacity-60" : "border-border bg-background"
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        {item.productImage ? (
          <img src={item.productImage} alt="" className="w-9 h-9 rounded-md object-cover flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className={`text-sm font-medium truncate ${isRemoved ? "line-through text-muted-foreground" : ""}`}>
            {item.productName}
          </p>
          {item.productSize && (
            <p className="text-xs text-muted-foreground">{item.productSize}</p>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => onQtyChange(Math.max(0, editQty - 1))}
              className="px-2 py-1.5 hover:bg-muted transition-colors"
            >
              {editQty === 1 ? <Trash2 className="w-3.5 h-3.5 text-destructive" /> : <Minus className="w-3.5 h-3.5" />}
            </button>
            <input
              type="number"
              min={0}
              value={editQty}
              onChange={(e) => onQtyChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-12 text-center text-sm font-semibold border-x py-1.5 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => onQtyChange(editQty + 1)}
              className="px-2 py-1.5 hover:bg-muted transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground min-w-[55px] text-right">
            × ৳{unitPrice.toLocaleString()}
          </span>
          <span className={`text-sm font-bold min-w-[65px] text-right ${isRemoved ? "text-destructive line-through" : ""}`}>
            ৳{Number(displayTotal).toLocaleString()}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <span className="text-sm font-medium">{displayQty}×</span>
            <span className="text-xs text-muted-foreground ml-1">@ ৳{unitPrice.toLocaleString()}</span>
          </div>
          <span className="text-sm font-bold min-w-[65px] text-right">
            ৳{Number(displayTotal).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Expanded Order Detail Row ─── */
function ExpandedOrderDetail({
  order: o,
  onAction,
  actionLoading,
  onSaveItems,
  savingItems,
}: {
  order: Order;
  onAction: (orderId: number, newStatus: string) => void;
  actionLoading: boolean;
  onSaveItems: (orderId: number, items: { itemId: number; quantity: number }[]) => void;
  savingItems: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editQuantities, setEditQuantities] = useState<Record<number, number>>({});

  const startEditing = useCallback(() => {
    const initial: Record<number, number> = {};
    (o.items || []).forEach((item) => {
      initial[item.id] = item.quantity;
    });
    setEditQuantities(initial);
    setIsEditing(true);
  }, [o.items]);

  const cancelEditing = () => {
    setIsEditing(false);
    setEditQuantities({});
  };

  const hasChanges = (o.items || []).some(
    (item) => editQuantities[item.id] !== undefined && editQuantities[item.id] !== item.quantity
  );

  const editedTotal = isEditing
    ? (o.items || []).reduce((sum, item) => {
        const qty = editQuantities[item.id] ?? item.quantity;
        return sum + Number(item.unitPrice) * qty;
      }, 0)
    : Number(o.total);

  const handleSave = () => {
    const items = (o.items || [])
      .filter((item) => editQuantities[item.id] !== undefined && editQuantities[item.id] !== item.quantity)
      .map((item) => ({ itemId: item.id, quantity: editQuantities[item.id]! }));

    if (items.length > 0) {
      onSaveItems(o.id, items);
      setIsEditing(false);
      setEditQuantities({});
    }
  };

  return (
    <tr className="bg-muted/20">
      <td colSpan={6} className="p-0">
        <div className="border-t">
          {/* Items Section */}
          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Order Items ({o.items?.length ?? 0})
              </p>
              {o.status === "pending" && !isEditing && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={startEditing}>
                  <Edit3 className="w-3.5 h-3.5 mr-1" />
                  Edit Quantities
                </Button>
              )}
              {isEditing && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEditing}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleSave}
                    disabled={!hasChanges || savingItems}
                  >
                    {savingItems ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                    Save Changes
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              {(o.items || []).map((item) => (
                <EditableItemRow
                  key={item.id}
                  item={item}
                  isEditing={isEditing}
                  editQty={editQuantities[item.id] ?? item.quantity}
                  onQtyChange={(qty) =>
                    setEditQuantities((prev) => ({ ...prev, [item.id]: qty }))
                  }
                />
              ))}
            </div>

            {/* Edited total summary */}
            {isEditing && hasChanges && (
              <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
                <span className="text-xs font-medium text-primary">Updated Total</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground line-through">৳{Number(o.total).toLocaleString()}</span>
                  <span className="text-sm font-bold text-primary">৳{editedTotal.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Shipping + Actions */}
          <div className="px-6 py-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/10">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Shipping Details
              </p>
              {o.shippingName && (
                <div className="flex items-center gap-1.5 text-sm">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{o.shippingName}</span>
                </div>
              )}
              {o.shippingPhone && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{o.shippingPhone}</span>
                </div>
              )}
              {o.shippingAddress && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{o.shippingAddress}{o.shippingCity ? `, ${o.shippingCity}` : ""}{o.shippingArea ? ` (${o.shippingArea})` : ""}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            {o.status !== "delivered" && o.status !== "cancelled" && o.status !== "returned" && (
              <div className="flex items-center gap-2">
                {o.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => onAction(o.id, "confirmed")}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                      Confirm
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={() => onAction(o.id, "cancelled")}
                      disabled={actionLoading}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </>
                )}
                {o.status === "confirmed" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => onAction(o.id, "delivered")}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Truck className="w-4 h-4 mr-1" />}
                    Mark Delivered
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ─── Main Page ─── */
export default function SupplyOrdersPage() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [globalFilter, setGlobalFilter] = useState("");
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [confirmAction, setConfirmAction] = useState<{ orderId: number; status: string; message: string } | null>(null);
  const queryClient = useQueryClient();

  // Fetch orders
  const { data, isLoading, error } = useQuery({
    queryKey: ["warehouse", "incoming-orders", activeTab],
    queryFn: () =>
      orpc.warehouse.getIncomingOrders.call({
        status: activeTab as any,
        page: 1,
        limit: 50,
      }),
  });

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: string }) =>
      orpc.warehouse.updateIncomingOrderStatus.call({
        orderId,
        status: status as any,
      }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "incoming-orders"] });
      toast.success(result.message || "Order status updated");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update order");
    },
  });

  // Update items mutation
  const updateItems = useMutation({
    mutationFn: ({ orderId, items }: { orderId: number; items: { itemId: number; quantity: number }[] }) =>
      orpc.warehouse.updateIncomingOrderItems.call({ orderId, items }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "incoming-orders"] });
      toast.success(result.message || "Order items updated");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update items");
    },
  });

  const handleAction = (orderId: number, newStatus: string) => {
    const messages: Record<string, string> = {
      confirmed: "Confirm this order? The shop owner will be notified.",
      delivered: "Mark as delivered? This will convert trade inventory → shop retail inventory.",
      cancelled: "Cancel this order? This action cannot be undone.",
    };
    setConfirmAction({
      orderId,
      status: newStatus,
      message: messages[newStatus] || `Set order to ${newStatus}?`,
    });
  };

  const handleSaveItems = (orderId: number, items: { itemId: number; quantity: number }[]) => {
    updateItems.mutate({ orderId, items });
  };

  const orders: Order[] = (data?.orders as Order[]) ?? [];

  // Column definitions
  const columns: ColumnDef<Order>[] = useMemo(
    () => [
      {
        id: "expander",
        header: "",
        size: 40,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              row.toggleExpanded();
            }}
            className="p-1"
          >
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${
                row.getIsExpanded() ? "" : "-rotate-90"
              }`}
            />
          </button>
        ),
      },
      {
        accessorKey: "orderNumber",
        header: "Order",
        cell: ({ row }) => {
          const o = row.original;
          const createdDate = o.createdAt ? format(new Date(o.createdAt), "dd MMM yyyy, hh:mm a") : "";
          return (
            <div>
              <p className="text-sm font-semibold">{o.orderNumber}</p>
              <p className="text-xs text-muted-foreground">{createdDate}</p>
            </div>
          );
        },
      },
      {
        id: "customer",
        header: "Customer",
        cell: ({ row }) => {
          const o = row.original;
          const buyerName = o.buyerShopName || o.buyerWarehouseName || o.buyerName || "Unknown";
          return (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <span className="text-sm truncate max-w-[150px]">{buyerName}</span>
            </div>
          );
        },
      },
      {
        id: "items",
        header: "Items",
        cell: ({ row }) => {
          const itemCount = row.original.items?.length ?? 0;
          return (
            <span className="text-sm text-muted-foreground">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "total",
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => {
          const o = row.original;
          return (
            <div className="text-right">
              <p className="text-sm font-bold">৳{Number(o.total || 0).toLocaleString()}</p>
              {o.paymentMethod && (
                <p className="text-[10px] text-muted-foreground uppercase">
                  {o.paymentMethod.replace(/_/g, " ")}
                </p>
              )}
            </div>
          );
        },
      },
    ],
    [],
  );

  // Filter orders by search
  const filteredOrders = useMemo(() => {
    if (!globalFilter.trim()) return orders;
    const q = globalFilter.toLowerCase();
    return orders.filter((o) =>
      o.orderNumber?.toLowerCase().includes(q) ||
      o.buyerShopName?.toLowerCase().includes(q) ||
      o.buyerWarehouseName?.toLowerCase().includes(q) ||
      o.buyerName?.toLowerCase().includes(q) ||
      o.shippingName?.toLowerCase().includes(q)
    );
  }, [orders, globalFilter]);

  const table = useReactTable({
    data: filteredOrders,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowCanExpand: () => true,
    initialState: {
      pagination: { pageSize: 15 },
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Supply Orders</h1>
          <p className="text-sm text-muted-foreground">Manage incoming B2B orders from shop owners</p>
        </div>
        <TableSkeleton columns={6} rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Supply Orders</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/30">
          <XCircle className="w-10 h-10 text-destructive/40 mb-3" />
          <p className="text-sm text-destructive">Failed to load orders</p>
          <p className="text-xs text-muted-foreground mt-1">{(error as any)?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Supply Orders</h1>
        <p className="text-sm text-muted-foreground">
          Manage incoming B2B orders from shop owners
        </p>
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
          <TabsTrigger value="returned">Returned</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search + summary */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search by order #, customer, shop..."
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
          {orders.length > 0 && (
            <span className="ml-1 font-medium">
              · ৳{orders.reduce((s, o) => s + Number(o.total || 0), 0).toLocaleString()}
            </span>
          )}
        </p>
      </div>

      {/* Table */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border rounded-lg bg-muted/30">
          <InboxIcon className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No orders found</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            {globalFilter
              ? "No orders match your search. Try a different term."
              : activeTab === "all"
                ? "No supply orders received yet. Orders from shop owners will appear here."
                : `No ${activeTab} orders at the moment.`}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <Fragment key={row.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => row.toggleExpanded()}
                      data-state={row.getIsExpanded() ? "expanded" : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {row.getIsExpanded() && (
                      <ExpandedOrderDetail
                        order={row.original}
                        onAction={handleAction}
                        actionLoading={updateStatus.isPending}
                        onSaveItems={handleSaveItems}
                        savingItems={updateItems.isPending}
                      />
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between px-2">
              <p className="text-xs text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) {
                  updateStatus.mutate({ orderId: confirmAction.orderId, status: confirmAction.status });
                  setConfirmAction(null);
                }
              }}
              className={confirmAction?.status === "cancelled" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {updateStatus.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {confirmAction?.status === "confirmed" ? "Confirm Order" :
               confirmAction?.status === "delivered" ? "Mark Delivered" :
               confirmAction?.status === "cancelled" ? "Cancel Order" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
