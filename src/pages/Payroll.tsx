import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getUserRole, getCurrentUser } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MyPayslips from "@/components/payroll/MyPayslips";
import TeamPayslips from "@/components/payroll/TeamPayslips";
import PayrollManagement from "@/components/payroll/PayrollManagement";
import { DollarSign, Users, Settings } from "lucide-react";

const Payroll = () => {
  const [role, setRole] = useState<UserRole>('staff');
  const [userId, setUserId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('my-payslips');

  useEffect(() => {
    const loadUserData = async () => {
      const user = await getCurrentUser();
      if (!user) return;

      setUserId(user.id);
      const userRole = await getUserRole(user.id);
      setRole(userRole);
    };
    loadUserData();
  }, []);

  return (
    <DashboardLayout role={role} payrollSection={activeTab} onPayrollSectionChange={setActiveTab}>
      <div className="space-y-6 animate-fade-in pb-20 md:pb-6">
        <div className="mb-2">
          <h1 className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent text-2xl md:text-3xl lg:text-4xl">
            Lương thưởng
          </h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">Quản lý và xem phiếu lương</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-secondary shadow-soft flex flex-wrap h-auto gap-1 p-1">
            {/* My Payslips - Visible to all roles */}
            <TabsTrigger value="my-payslips" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Lương của tôi</span>
            </TabsTrigger>

            {/* Team Payslips - Only for Leaders */}
            {(role === 'leader' || role === 'admin' || role === 'hr') && (
              <TabsTrigger value="team-payslips" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Lương Team</span>
              </TabsTrigger>
            )}

            {/* Payroll Management - Only for Admin/HR */}
            {(role === 'admin' || role === 'hr') && (
              <TabsTrigger value="payroll-management" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Quản lý Lương</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* My Payslips Tab */}
          <TabsContent value="my-payslips" className="mt-6">
            <MyPayslips userId={userId} role={role} />
          </TabsContent>

          {/* Team Payslips Tab - Only for Leaders */}
          {(role === 'leader' || role === 'admin' || role === 'hr') && (
            <TabsContent value="team-payslips" className="mt-6">
              <TeamPayslips role={role} userId={userId} />
            </TabsContent>
          )}

          {/* Payroll Management Tab - Only for Admin/HR */}
          {(role === 'admin' || role === 'hr') && (
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
