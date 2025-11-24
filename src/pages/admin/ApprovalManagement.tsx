import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getCurrentUser, getUserRole, UserRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface PendingUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  approval_status: string;
  role?: string;
}

const ApprovalManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [role, setRole] = useState<UserRole>("staff");
  const [userId, setUserId] = useState<string>("");
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<PendingUser[]>([]);
  const [rejectedUsers, setRejectedUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  const [assignRole, setAssignRole] = useState("staff");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    checkAccessAndLoadData();
  }, []);

  const checkAccessAndLoadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        navigate("/auth/login");
        return;
      }

      setUserId(user.id);
      const userRole = await getUserRole(user.id);
      setRole(userRole);

      // Only allow admin and hr to access this page
      if (userRole !== "admin" && userRole !== "hr") {
        toast({
          variant: "destructive",
          title: "Truy cập Bị Từ chối",
          description: "Chỉ Admin/HR mới có thể truy cập trang này",
        });
        navigate("/dashboard");
        return;
      }

      await loadPendingApprovals();
    } catch (error) {
      console.error("Error checking access:", error);
      navigate("/dashboard");
    }
  };

  const loadPendingApprovals = async () => {
    try {
      setLoading(true);

      // Load pending users
      const { data: pending, error: pendingError } = await supabase
        .from("profiles")
        .select(
          `
          id, email, first_name, last_name, phone, avatar_url, 
          created_at, approval_status,
          user_roles(role)
        `
        )
        .eq("approval_status", "pending")
        .order("created_at", { ascending: false });

      if (pendingError) throw pendingError;

      const pendingUsersData = pending?.map((user: any) => ({
        ...user,
        role: user.user_roles?.[0]?.role || "pending",
      })) || [];

      setPendingUsers(pendingUsersData);

      // Load approved users
      const { data: approved, error: approvedError } = await supabase
        .from("profiles")
        .select(
          `
          id, email, first_name, last_name, phone, avatar_url, 
          created_at, approval_status,
          user_roles(role)
        `
        )
        .eq("approval_status", "approved")
        .order("created_at", { ascending: false });

      if (approvedError) throw approvedError;

      const approvedUsersData = approved?.map((user: any) => ({
        ...user,
        role: user.user_roles?.[0]?.role || "staff",
      })) || [];

      setApprovedUsers(approvedUsersData);

      // Load rejected users
      const { data: rejected, error: rejectedError } = await supabase
        .from("profiles")
        .select(
          `
          id, email, first_name, last_name, phone, avatar_url, 
          created_at, approval_status,
          user_roles(role)
        `
        )
        .eq("approval_status", "rejected")
        .order("created_at", { ascending: false })
        .limit(50);

      if (rejectedError) throw rejectedError;

      const rejectedUsersData = rejected?.map((user: any) => ({
        ...user,
        role: user.user_roles?.[0]?.role,
      })) || [];

      setRejectedUsers(rejectedUsersData);
    } catch (error) {
      console.error("Error loading approvals:", error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tải danh sách yêu cầu",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedUser) return;

    setIsProcessing(true);
    try {
      // Update approval status
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          approval_status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: userId,
        })
        .eq("id", selectedUser.id);

      if (updateError) throw updateError;

      // Insert or update user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert({
          user_id: selectedUser.id,
          role: assignRole,
        });

      if (roleError) throw roleError;

      toast({
        title: "✓ Phê Duyệt Thành Công",
        description: `${selectedUser.first_name} ${selectedUser.last_name} đã được phê duyệt`,
      });

      setIsApproveDialogOpen(false);
      setSelectedUser(null);
      await loadPendingApprovals();
    } catch (error) {
      console.error("Error approving user:", error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể phê duyệt người dùng",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedUser) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          approval_status: "rejected",
          rejected_at: new Date().toISOString(),
          rejected_by: userId,
          rejection_reason: rejectionReason || "Không rõ",
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      toast({
        title: "✓ Từ Chối Thành Công",
        description: `Yêu cầu của ${selectedUser.first_name} ${selectedUser.last_name} đã bị từ chối`,
      });

      setIsRejectDialogOpen(false);
      setSelectedUser(null);
      setRejectionReason("");
      await loadPendingApprovals();
    } catch (error) {
      console.error("Error rejecting user:", error);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể từ chối người dùng",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const UserRow = ({ user }: { user: PendingUser }) => (
    <TableRow className="hover:bg-secondary/50">
      <TableCell>
        <div>
          <p className="font-medium">{user.last_name} {user.first_name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </TableCell>
      <TableCell>{user.phone || "—"}</TableCell>
      <TableCell>{format(new Date(user.created_at), "MMM dd, yyyy HH:mm")}</TableCell>
      <TableCell>
        <Badge variant="outline">{user.role}</Badge>
      </TableCell>
    </TableRow>
  );

  if (loading) {
    return (
      <DashboardLayout role={role}>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6 animate-fade-in pb-20 md:pb-6">
        <div className="mb-2">
          <h2 className="text-4xl font-heading font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Phê Duyệt Đăng Ký
          </h2>
          <p className="text-muted-foreground mt-2">
            Quản lý yêu cầu đăng ký của người dùng mới
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Chờ Phê Duyệt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{pendingUsers.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Đã Phê Duyệt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{approvedUsers.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                Bị Từ Chối
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{rejectedUsers.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="bg-secondary">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Chờ Phê Duyệt ({pendingUsers.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Đã Phê Duyệt ({approvedUsers.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Bị Từ Chối ({rejectedUsers.length})
            </TabsTrigger>
          </TabsList>

          {/* Pending Users Tab */}
          <TabsContent value="pending" className="mt-6">
            {pendingUsers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Không có yêu cầu chờ phê duyệt</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tên & Email</TableHead>
                        <TableHead>Số Điện Thoại</TableHead>
                        <TableHead>Thời Gian Đăng Ký</TableHead>
                        <TableHead>Hành Động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingUsers.map((user) => (
                        <TableRow key={user.id} className="hover:bg-secondary/50">
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {user.last_name} {user.first_name}
                              </p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{user.phone || "—"}</TableCell>
                          <TableCell>
                            {format(new Date(user.created_at), "MMM dd, yyyy HH:mm")}
                          </TableCell>
                          <TableCell className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setAssignRole("staff");
                                setIsApproveDialogOpen(true);
                              }}
                              variant="default"
                            >
                              Phê Duyệt
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedUser(user);
                                setRejectionReason("");
                                setIsRejectDialogOpen(true);
                              }}
                            >
                              Từ Chối
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Approved Users Tab */}
          <TabsContent value="approved" className="mt-6">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên & Email</TableHead>
                      <TableHead>Số Điện Thoại</TableHead>
                      <TableHead>Vai Trò</TableHead>
                      <TableHead>Thời Gian Phê Duyệt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedUsers.map((user) => (
                      <UserRow key={user.id} user={user} />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rejected Users Tab */}
          <TabsContent value="rejected" className="mt-6">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên & Email</TableHead>
                      <TableHead>Số Điện Thoại</TableHead>
                      <TableHead>Thời Gian</TableHead>
                      <TableHead>Vai Trò</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rejectedUsers.map((user) => (
                      <UserRow key={user.id} user={user} />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Phê Duyệt Đăng Ký</DialogTitle>
            <DialogDescription>
              Phê duyệt yêu cầu của {selectedUser?.last_name} {selectedUser?.first_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="role">Gán Vai Trò</Label>
              <Select value={assignRole} onValueChange={setAssignRole}>
                <SelectTrigger id="role" className="bg-white dark:bg-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Nhân Viên (Staff)</SelectItem>
                  <SelectItem value="leader">Trưởng Nhóm (Leader)</SelectItem>
                  <SelectItem value="hr">Nhân Sự (HR)</SelectItem>
                  <SelectItem value="admin">Quản Trị (Admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApproveDialogOpen(false)}
              disabled={isProcessing}
            >
              Hủy
            </Button>
            <Button onClick={handleApprove} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                "Phê Duyệt"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ Chối Đăng Ký</DialogTitle>
            <DialogDescription>
              Từ chối yêu cầu của {selectedUser?.last_name} {selectedUser?.first_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Lý Do Từ Chối</Label>
              <Input
                id="reason"
                placeholder="Ví dụ: Dữ liệu không đầy đủ, Email không hợp lệ, v.v."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                disabled={isProcessing}
              />
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Chú ý</AlertTitle>
              <AlertDescription>
                Người dùng sẽ thấy lý do từ chối này và có thể đăng ký lại.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectDialogOpen(false)}
              disabled={isProcessing}
            >
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                "Từ Chối"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ApprovalManagement;
