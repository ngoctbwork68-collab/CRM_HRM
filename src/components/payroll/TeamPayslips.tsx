import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, Eye } from "lucide-react";
import { format } from "date-fns";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { SkeletonStatCard } from "@/components/ui/skeleton-card";
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Salary {
  id: string;
  user_id: string;
  base_salary: number;
  allowances: number;
  bonus: number;
  deductions: number;
  tax_amount: number;
  net_salary: number;
  pay_period_start: string;
  pay_period_end: string;
  payment_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  team_id: string;
}

interface PayslipDetails {
  salary: Salary;
  userEmail: string;
  userName: string;
}

const TeamPayslips = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [payslips, setPayslips] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipDetails | null>(null);
  const { toast } = useToast();

  const fetchTeamMembers = useCallback(async () => {
    try {
      setLoading(true);

      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        toast({
          title: "Lỗi",
          description: "Không thể xác định người dùng hiện tại.",
          variant: "destructive",
        });
        return;
      }

      // Get current user's profile to find team_id
      const { data: currentUserProfile, error: profileError } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (!currentUserProfile?.team_id) {
        toast({
          title: "Lỗi",
          description: "Bạn không thuộc đội nào.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Fetch team members (excluding leader themselves)
      const { data: members, error: membersError } = await supabase
        .from("profiles")
        .select("id, full_name, email, team_id")
        .eq("team_id", currentUserProfile.team_id);

      if (membersError) throw membersError;

      const filteredMembers = (members || []).filter(m => m.id !== user.id);
      setTeamMembers(filteredMembers);

      if (filteredMembers.length > 0) {
        setSelectedMember(filteredMembers[0].id);
      }
    } catch (error) {
      toast({
        title: "Lỗi Tải Dữ Liệu",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  const fetchPayslipsForMember = useCallback(async (memberId: string) => {
    try {
      const { data: salaryData, error: salaryError } = await supabase
        .from("salaries")
        .select("*")
        .eq("user_id", memberId)
        .order("pay_period_start", { ascending: false });

      if (salaryError) throw salaryError;

      setPayslips(salaryData || []);
    } catch (error) {
      toast({
        title: "Lỗi Tải Dữ Liệu",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (selectedMember) {
      fetchPayslipsForMember(selectedMember);
    }
  }, [selectedMember, fetchPayslipsForMember]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };

  const getPaymentStatusDisplay = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string } } = {
      pending: { label: "Chờ xử lý", color: "text-yellow-600" },
      paid: { label: "Đã thanh toán", color: "text-green-600" },
      failed: { label: "Thất bại", color: "text-red-600" },
    };
    const displayStatus = statusMap[status] || { label: status, color: "text-gray-600" };
    return <span className={displayStatus.color}>{displayStatus.label}</span>;
  };

  const getSelectedMemberName = () => {
    const member = teamMembers.find(m => m.id === selectedMember);
    return member?.full_name || "";
  };

  const getSelectedMemberEmail = () => {
    const member = teamMembers.find(m => m.id === selectedMember);
    return member?.email || "";
  };

  const exportToExcel = () => {
    const memberName = getSelectedMemberName();
    const exportData = payslips.map((salary) => ({
      "Kỳ Lương Từ": format(new Date(salary.pay_period_start), "yyyy-MM-dd"),
      "Kỳ Lương Đến": format(new Date(salary.pay_period_end), "yyyy-MM-dd"),
      "Lương Cơ Bản": formatCurrency(salary.base_salary),
      "Phụ Cấp": formatCurrency(salary.allowances),
      "Thưởng": formatCurrency(salary.bonus),
      "Khấu Trừ": formatCurrency(salary.deductions),
      "Thuế": formatCurrency(salary.tax_amount),
      "Lương Ròng": formatCurrency(salary.net_salary),
      "Trạng Thái": salary.payment_status,
      "Ghi Chú": salary.notes || "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Phiếu Lương");

    ws["!cols"] = [
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 25 },
    ];

    XLSX.writeFile(wb, `Phieu_Luong_${memberName}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

    toast({
      title: "Thành Công",
      description: "Phiếu lương đã được xuất thành công",
    });
  };

  const exportToCSV = () => {
    const memberName = getSelectedMemberName();
    const exportData = payslips.map((salary) => ({
      "Kỳ Lương Từ": format(new Date(salary.pay_period_start), "yyyy-MM-dd"),
      "Kỳ Lương Đến": format(new Date(salary.pay_period_end), "yyyy-MM-dd"),
      "Lương Cơ Bản": salary.base_salary,
      "Phụ Cấp": salary.allowances,
      "Thưởng": salary.bonus,
      "Khấu Trừ": salary.deductions,
      "Thuế": salary.tax_amount,
      "Lương Ròng": salary.net_salary,
      "Trạng Thái": salary.payment_status,
      "Ghi Chú": salary.notes || "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Phieu_Luong_${memberName}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Thành Công",
      description: "Phiếu lương đã được xuất thành công",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonStatCard />
        <SkeletonTable rows={8} columns={9} />
      </div>
    );
  }

  if (teamMembers.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Không có thành viên nào trong đội của bạn</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalNetSalary = payslips.reduce((sum, p) => sum + p.net_salary, 0);

  return (
    <div className="space-y-6">
      {/* Member Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Chọn Thành Viên</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedMember} onValueChange={setSelectedMember}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn thành viên" />
            </SelectTrigger>
            <SelectContent>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.full_name} - {member.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="shadow-medium overflow-hidden relative border-l-4 border-l-primary">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm font-medium">Tổng Lương Ròng</CardTitle>
            <CardDescription className="mt-1">{getSelectedMemberName()}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatCurrency(totalNetSalary)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Tổng từ {payslips.length} phiếu lương
          </p>
        </CardContent>
      </Card>

      {/* Payslips Table */}
      <Card className="shadow-strong">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Phiếu Lương {getSelectedMemberName()}</CardTitle>
              <CardDescription>Danh sách phiếu lương của thành viên</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Xuất CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <Download className="h-4 w-4 mr-2" />
                Xuất Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kỳ Lương</TableHead>
                  <TableHead>Lương Cơ Bản</TableHead>
                  <TableHead>Phụ Cấp</TableHead>
                  <TableHead>Thưởng</TableHead>
                  <TableHead>Khấu Trừ</TableHead>
                  <TableHead>Thuế</TableHead>
                  <TableHead>Lương Ròng</TableHead>
                  <TableHead>Trạng Thái</TableHead>
                  <TableHead>Hành Động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Chưa có phiếu lương nào
                    </TableCell>
                  </TableRow>
                ) : (
                  payslips.map((payslip) => (
                    <TableRow key={payslip.id}>
                      <TableCell className="font-medium">
                        {format(new Date(payslip.pay_period_start), "MM/yyyy")}
                      </TableCell>
                      <TableCell>{formatCurrency(payslip.base_salary)}</TableCell>
                      <TableCell>{formatCurrency(payslip.allowances)}</TableCell>
                      <TableCell className="text-success">{formatCurrency(payslip.bonus)}</TableCell>
                      <TableCell className="text-destructive">
                        {formatCurrency(payslip.deductions)}
                      </TableCell>
                      <TableCell>{formatCurrency(payslip.tax_amount)}</TableCell>
                      <TableCell className="font-bold">{formatCurrency(payslip.net_salary)}</TableCell>
                      <TableCell>{getPaymentStatusDisplay(payslip.payment_status)}</TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedPayslip({
                                  salary: payslip,
                                  userEmail: getSelectedMemberEmail(),
                                  userName: getSelectedMemberName(),
                                });
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Chi Tiết Phiếu Lương</DialogTitle>
                            </DialogHeader>
                            {selectedPayslip && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Tên Nhân Viên
                                    </p>
                                    <p className="text-lg font-semibold">{selectedPayslip.userName}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                                    <p className="text-lg">{selectedPayslip.userEmail}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Kỳ Lương Từ
                                    </p>
                                    <p className="text-lg">
                                      {format(new Date(selectedPayslip.salary.pay_period_start), "dd/MM/yyyy")}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Kỳ Lương Đến
                                    </p>
                                    <p className="text-lg">
                                      {format(new Date(selectedPayslip.salary.pay_period_end), "dd/MM/yyyy")}
                                    </p>
                                  </div>
                                </div>

                                <div className="border-t pt-4">
                                  <h3 className="font-semibold mb-4">Chi Tiết Lương</h3>
                                  <div className="space-y-3">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Lương Cơ Bản</span>
                                      <span className="font-semibold">
                                        {formatCurrency(selectedPayslip.salary.base_salary)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Phụ Cấp</span>
                                      <span className="font-semibold text-success">
                                        +{formatCurrency(selectedPayslip.salary.allowances)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Thưởng</span>
                                      <span className="font-semibold text-success">
                                        +{formatCurrency(selectedPayslip.salary.bonus)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Khấu Trừ</span>
                                      <span className="font-semibold text-destructive">
                                        -{formatCurrency(selectedPayslip.salary.deductions)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Thuế</span>
                                      <span className="font-semibold text-destructive">
                                        -{formatCurrency(selectedPayslip.salary.tax_amount)}
                                      </span>
                                    </div>
                                    <div className="border-t pt-3 flex justify-between">
                                      <span className="font-semibold">Lương Ròng</span>
                                      <span className="font-bold text-lg text-success">
                                        {formatCurrency(selectedPayslip.salary.net_salary)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="border-t pt-4">
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Trạng Thái
                                    </p>
                                    <div className="mt-2">
                                      {getPaymentStatusDisplay(selectedPayslip.salary.payment_status)}
                                    </div>
                                  </div>
                                  {selectedPayslip.salary.notes && (
                                    <div className="mt-4">
                                      <p className="text-sm font-medium text-muted-foreground">
                                        Ghi Chú
                                      </p>
                                      <p className="text-sm mt-1">{selectedPayslip.salary.notes}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamPayslips;
