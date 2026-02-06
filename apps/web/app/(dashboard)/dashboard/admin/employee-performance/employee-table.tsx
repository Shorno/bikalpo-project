"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmployeeDetailModal } from "./employee-detail-modal";

interface EmployeeTableProps {
  employees: any[];
  loading: boolean;
  role: "deliveryman" | "salesman";
}

export function EmployeeTable({
  employees,
  loading,
  role,
}: EmployeeTableProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleViewDetails = (employee: any) => {
    setSelectedEmployee(employee);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="rounded-md border">
        <div className="text-center py-8 text-muted-foreground text-sm">
          Loading employee data...
        </div>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-md border">
        <div className="text-center py-8 text-muted-foreground text-sm">
          No {role === "deliveryman" ? "deliverymen" : "salesmen"} found.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {role === "deliveryman" ? (
                <>
                  <TableHead className="text-right">Deliveries</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Success Rate</TableHead>
                  <TableHead className="text-right">Avg/Day</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="text-right">Estimates</TableHead>
                  <TableHead className="text-right">Approved</TableHead>
                  <TableHead className="text-right">Converted</TableHead>
                  <TableHead className="text-right">Conv Rate</TableHead>
                  <TableHead className="text-right">Sales Value</TableHead>
                </>
              )}
              <TableHead className="text-center w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => {
              if (role === "deliveryman") {
                const total = employee.totalDeliveries || 0;
                const completed = employee.completedDeliveries || 0;
                const failed = employee.failedDeliveries || 0;
                const successRate = employee.successRate || 0;
                const avgPerDay = employee.avgDeliveriesPerDay || 0;

                return (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {employee.name}
                    </TableCell>
                    <TableCell className="text-right">{total}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600 font-medium">
                        {completed}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {failed > 0 ? (
                        <span className="text-red-600">{failed}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          successRate >= 80
                            ? "default"
                            : successRate >= 60
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {successRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {avgPerDay.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(employee)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              } else {
                // Salesman
                const total = employee.totalEstimates || 0;
                const approved = employee.approvedEstimates || 0;
                const converted = employee.convertedEstimates || 0;
                const conversionRate = employee.conversionRate || 0;
                const salesValue = employee.totalSalesValue || 0;

                return (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {employee.name}
                    </TableCell>
                    <TableCell className="text-right">{total}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-blue-600 font-medium">
                        {approved}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600 font-medium">
                        {converted}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          conversionRate >= 50
                            ? "default"
                            : conversionRate >= 30
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {conversionRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">
                        ৳{salesValue.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(employee)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              }
            })}
          </TableBody>
        </Table>
      </div>

      {selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          open={modalOpen}
          onOpenChange={setModalOpen}
        />
      )}
    </>
  );
}
