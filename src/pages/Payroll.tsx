import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getUserRole, getCurrentUser } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MyPayslips from "@/components/payroll/MyPayslips";
import TeamPayslips from "@/components/payroll/TeamPayslips";
import PayrollManagement from "@/components/payroll/PayrollManagement";
import { DollarSign, Users, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast"; // Giữ lại useToast

const Payroll = () => {
    const { toast } = useToast();
    const [role, setRole] = useState<UserRole>('staff');
    const [userId, setUserId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('my-payslips');

    useEffect(() => {
        const loadUserData = async () => {
            try {
                setLoading(true);
                const user = await getCurrentUser();
                
                if (!user) {
                    // Nếu không có user, navigate sẽ xảy ra ở cấp layout, nhưng ta vẫn báo lỗi
                    toast({ title: "Lỗi", description: "Không thể xác định người dùng.", variant: "destructive" });
                    setLoading(false);
                    return;
                }

                setUserId(user.id);
                const userRole = await getUserRole(user.id);
                setRole(userRole);

                // --- Logic xác định Tab mặc định khi load ---
                if (userRole === 'admin' || userRole === 'hr') {
                    setActiveTab("payroll-management");
                } else if (userRole === 'leader') {
                    setActiveTab("team-payslips"); // Leader ưu tiên xem team
                } else {
                    setActiveTab("my-payslips");
                }

            } catch (error) {
                toast({
                    title: "Lỗi Tải Dữ liệu",
                    description: (error as Error).message,
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };

        loadUserData();
    }, [toast]);

    if (loading) {
        return (
            <DashboardLayout role={role}>
                <div className="text-center py-12">
                    <p className="text-muted-foreground">Đang tải dữ liệu Lương thưởng...</p>
                </div>
            </DashboardLayout>
        );
    }

    // --- Xác định các Roles được xem Tab ---
    const canSeeTeamPayslips = ['admin', 'hr', 'leader'].includes(role);
    const canManagePayroll = ['admin', 'hr'].includes(role);

    // --- Logic hiển thị Tab Team Payslips ---
    // Leader/Admin/HR cần thấy Team Payslips và Management.
    // Nếu là Leader, tab này sẽ hiện. Nếu là Admin/HR, họ cũng có thể thấy.

    return (
        <DashboardLayout role={role}>
            <div className="space-y-6 animate-fade-in pb-20 md:pb-6">
                <div className="mb-2">
                    <h1 className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent text-2xl md:text-3xl lg:text-4xl">
                        Quản Lý Lương Thưởng
                    </h1>
                    <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
                        Xem và quản lý phiếu lương, phụ cấp, thưởng và lợi ích khác
                    </p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    {/* Tabs List */}
                    <TabsList className="bg-secondary shadow-soft flex flex-wrap h-auto gap-1 p-1">
                        
                        <TabsTrigger value="my-payslips" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            <span className="hidden sm:inline">Lương của tôi</span>
                        </TabsTrigger>

                        {/* Team Payslips - Visible to Leader, Admin, HR */}
                        {canSeeTeamPayslips && (
                            <TabsTrigger value="team-payslips" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span className="hidden sm:inline">Lương Team</span>
                            </TabsTrigger>
                        )}

                        {/* Payroll Management - Only for Admin/HR */}
                        {canManagePayroll && (
                            <TabsTrigger value="payroll-management" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                <span className="hidden sm:inline">Quản lý Lương</span>
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {/* Tabs Content */}
                    <TabsContent value="my-payslips" className="mt-6">
                        <MyPayslips userId={userId} role={role} />
                    </TabsContent>

                    {canSeeTeamPayslips && (
                        <TabsContent value="team-payslips" className="mt-6">
                            <TeamPayslips userId={userId} role={role} />
                        </TabsContent>
                    )}

                    {canManagePayroll && (
                        <TabsContent value="payroll-management" className="mt-6">
                            <PayrollManagement />
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </DashboardLayout>
    );
};

export default Payroll;