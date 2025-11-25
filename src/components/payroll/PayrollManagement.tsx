import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign, TrendingUp, Users, Download, FileSpreadsheet, Trash2, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { SkeletonStatCard } from "@/components/ui/skeleton-card";
import * as XLSX from 'xlsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

const PayrollManagement = () => {
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSalaryId, setSelectedSalaryId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    base_salary: "",
    allowances: "0",
    bonus: "0",
    deductions: "0",
    tax_amount: "0",
    payment_status: "pending",
    notes: ""
  });

  const getUserName = (userId: string) => {
    const profile = profiles.find(p => p.id === userId);
    return profile ? profile.full_name : 'Không rõ';
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch all salaries
      const { data: salaryData, error: salaryError } = await supabase
        .from('salaries')
        .select('*')
        .order('pay_period_start', { ascending: false });

      if (salaryError) throw salaryError;

      // Fetch all profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email');

      if (profileError) throw profileError;

      setSalaries(salaryData || []);
      setProfiles(profileData || []);
    } catch (error) {
      toast({
        title: "Lỗi Tải Dữ liệu",
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (salary?: Salary) => {
    if (salary) {
      setIsEditing(true);
      setSelectedSalaryId(salary.id);
      setSelectedUser(salary.user_id);
      setSelectedMonth(salary.pay_period_start.substring(0, 7));
      setFormData({
        base_salary: salary.base_salary.toString(),
        allowances: salary.allowances.toString(),
        bonus: salary.bonus.toString(),
        deductions: salary.deductions.toString(),
        tax_amount: salary.tax_amount.toString(),
        payment_status: salary.payment_status,
        notes: salary.notes || ""
      });
    } else {
      setIsEditing(false);
      setSelectedSalaryId(null);
      setSelectedUser("");
      setSelectedMonth(format(new Date(), 'yyyy-MM'));
      setFormData({
        base_salary: "",
        allowances: "0",
        bonus: "0",
        deductions: "0",
        tax_amount: "0",
        payment_status: "pending",
        notes: ""
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser || !selectedMonth || !formData.base_salary) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn nhân viên, tháng và nhập lương cơ bản.",
        variant: "destructive"
      });
      return;
    }

    try {
      const payPeriodStart = selectedMonth + '-01';
      const payPeriodEnd = new Date(new Date(payPeriodStart).getFullYear(), new Date(payPeriodStart).getMonth() + 1, 0)
        .toISOString()
        .split('T')[0];

      if (isEditing && selectedSalaryId) {
        // Update existing salary
        const { error } = await supabase
          .from('salaries')
          .update({
            base_salary: parseFloat(formData.base_salary),
            allowances: parseFloat(formData.allowances),
            bonus: parseFloat(formData.bonus),
            deductions: parseFloat(formData.deductions),
            tax_amount: parseFloat(formData.tax_amount),
            payment_status: formData.payment_status,
            notes: formData.notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedSalaryId);

        if (error) throw error;
        toast({
          title: "Thành công",
          description: "Bản ghi lương đã được cập nhật.",
        });
      } else {
        // Create new salary
        const { error } = await supabase
          .from('salaries')
          .insert({
            user_id: selectedUser,
            base_salary: parseFloat(formData.base_salary),
            allowances: parseFloat(formData.allowances),
            bonus: parseFloat(formData.bonus),
            deductions: parseFloat(formData.deductions),
            tax_amount: parseFloat(formData.tax_amount),
            net_salary: parseFloat(formData.base_salary) + parseFloat(formData.allowances) + parseFloat(formData.bonus) - parseFloat(formData.deductions) - parseFloat(formData.tax_amount),
            pay_period_start: payPeriodStart,
            pay_period_end: payPeriodEnd,
            payment_status: formData.payment_status,
            notes: formData.notes || null,
          } as Salary);

        if (error) throw error;
        toast({
          title: "Thành công",
          description: "Bản ghi lương đã được tạo.",
        });
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({
        title: "Lỗi Lưu Trữ",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (salaryId: string) => {
    try {
      const { error } = await supabase
        .from('salaries')
        .delete()
        .eq('id', salaryId);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Bản ghi lương đã được xóa.",
      });

      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      toast({
        title: "Lỗi Xóa",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  };

  const exportToExcel = () => {
    const exportData = salaries.map(salary => ({
      'Nhân viên': getUserName(salary.user_id),
      'Email': profiles.find(p => p.id === salary.user_id)?.email || '',
      'Kỳ Lương Từ': format(new Date(salary.pay_period_start), 'yyyy-MM-dd'),
      'Kỳ Lương Đến': format(new Date(salary.pay_period_end), 'yyyy-MM-dd'),
      'Lương Cơ bản (VND)': Number(salary.base_salary).toFixed(2),
      'Phụ Cấp (VND)': Number(salary.allowances).toFixed(2),
      'Thưởng (VND)': Number(salary.bonus).toFixed(2),
      'Khấu Trừ (VND)': Number(salary.deductions).toFixed(2),
      'Thuế (VND)': Number(salary.tax_amount).toFixed(2),
      'Lương Ròng (VND)': Number(salary.net_salary).toFixed(2),
      'Trạng Thái': salary.payment_status,
      'Ghi chú': salary.notes || '',
      'Ngày Tạo': format(new Date(salary.created_at), 'yyyy-MM-dd HH:mm')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quản Lý Lương");

    ws['!cols'] = [
      { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
      { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 30 }, { wch: 18 }
    ];

    XLSX.writeFile(wb, `Quan_Ly_Luong_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

    toast({ title: "Xuất file thành công", description: "Dữ liệu lương đã được xuất ra Excel" });
  };

  const exportToCSV = () => {
    const exportData = salaries.map(salary => ({
      'Employee': getUserName(salary.user_id),
      'Email': profiles.find(p => p.id === salary.user_id)?.email || '',
      'Pay Period Start': format(new Date(salary.pay_period_start), 'yyyy-MM-dd'),
      'Pay Period End': format(new Date(salary.pay_period_end), 'yyyy-MM-dd'),
      'Base Salary': salary.base_salary,
      'Allowances': salary.allowances,
      'Bonus': salary.bonus,
      'Deductions': salary.deductions,
      'Tax': salary.tax_amount,
      'Net Salary': salary.net_salary,
      'Payment Status': salary.payment_status,
      'Notes': salary.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Quan_Ly_Luong_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "Xuất file thành công", description: "Dữ liệu lương đã được xuất ra CSV" });
  };

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>
        <SkeletonTable rows={8} columns={10} />
      </div>
    );
  }

  const totalNetSalary = salaries.reduce((sum, s) => sum + s.net_salary, 0);
  const totalBonus = salaries.reduce((sum, s) => sum + s.bonus, 0);
  const employeeCount = new Set(salaries.map(s => s.user_id)).size;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-medium overflow-hidden relative border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng Chi Lương</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(totalNetSalary)}</div>
            <p className="text-xs text-muted-foreground mt-1">Tổng lương ròng</p>
          </CardContent>
        </Card>

        <Card className="shadow-medium overflow-hidden relative border-l-4 border-l-success">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng Thưởng</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(totalBonus)}</div>
            <p className="text-xs text-muted-foreground mt-1">Đã phát thưởng</p>
          </CardContent>
        </Card>

        <Card className="shadow-medium overflow-hidden relative border-l-4 border-l-warning">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nhân Viên</CardTitle>
            <Users className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{employeeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Trong bản ghi lương</p>
          </CardContent>
        </Card>
      </div>

      {/* Management Card */}
      <Card className="shadow-strong">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Quản Lý Bản Ghi Lương</CardTitle>
              <CardDescription>Tạo, sửa, xóa và quản lý phiếu lương toàn bộ nhân viên.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => exportToCSV()}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Xuất CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToExcel()}>
                <Download className="h-4 w-4 mr-2" />
                Xuất Excel
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90" onClick={() => handleOpenDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm Lương
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{isEditing ? "Sửa" : "Thêm"} Bản ghi Lương</DialogTitle>
                    <DialogDescription>
                      {isEditing ? "Cập nhật" : "Tạo"} thông tin lương cho nhân viên.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nhân viên</Label>
                      <Select value={selectedUser} onValueChange={setSelectedUser} disabled={isEditing}>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn nhân viên" />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map(profile => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.full_name} - {profile.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Kỳ Lương (Từ Tháng)</Label>
                      <Input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        disabled={isEditing}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Lương Cơ Bản (VND)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.base_salary}
                        onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Phụ Cấp (VND)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.allowances}
                          onChange={(e) => setFormData({ ...formData, allowances: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Thưởng (VND)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.bonus}
                          onChange={(e) => setFormData({ ...formData, bonus: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Khấu Trừ (VND)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.deductions}
                          onChange={(e) => setFormData({ ...formData, deductions: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Thuế (VND)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.tax_amount}
                          onChange={(e) => setFormData({ ...formData, tax_amount: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Trạng Thái Thanh Toán</Label>
                      <Select value={formData.payment_status} onValueChange={(value) => setFormData({ ...formData, payment_status: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Chờ xử lý</SelectItem>
                          <SelectItem value="paid">Đã thanh toán</SelectItem>
                          <SelectItem value="failed">Thất bại</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Ghi Chú</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Ghi chú thêm..."
                      />
                    </div>

                    <Button type="submit" className="w-full">
                      {isEditing ? "Cập Nhật" : "Tạo"} Bản Ghi Lương
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead>Kỳ Lương</TableHead>
                  <TableHead>Lương CB</TableHead>
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
                {salaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Chưa có bản ghi lương nào
                    </TableCell>
                  </TableRow>
                ) : (
                  salaries.map((salary) => (
                    <TableRow key={salary.id}>
                      <TableCell className="font-medium">{getUserName(salary.user_id)}</TableCell>
                      <TableCell>{format(new Date(salary.pay_period_start), 'MM/yyyy')}</TableCell>
                      <TableCell>{formatCurrency(salary.base_salary)}</TableCell>
                      <TableCell>{formatCurrency(salary.allowances)}</TableCell>
                      <TableCell className="text-success">{formatCurrency(salary.bonus)}</TableCell>
                      <TableCell className="text-destructive">{formatCurrency(salary.deductions)}</TableCell>
                      <TableCell>{formatCurrency(salary.tax_amount)}</TableCell>
                      <TableCell className="font-bold">{formatCurrency(salary.net_salary)}</TableCell>
                      <TableCell>{getPaymentStatusDisplay(salary.payment_status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(salary)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <AlertDialog open={deleteConfirm === salary.id} onOpenChange={(open) => setDeleteConfirm(open ? salary.id : null)}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm(salary.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Xóa Bản Ghi Lương</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Bạn chắc chắn muốn xóa bản ghi lương của {getUserName(salary.user_id)} từ {format(new Date(salary.pay_period_start), 'MM/yyyy')}? Hành động này không thể hoàn tác.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogAction
                                onClick={() => handleDelete(salary.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Xóa
                              </AlertDialogAction>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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

export default PayrollManagement;
