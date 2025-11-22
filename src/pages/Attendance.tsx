import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DailyAttendanceWidget from "@/components/attendance/DailyAttendanceWidget";
import AttendanceManagementWidget from "@/components/attendance/AttendanceManagementWidget";
import { getUserRole, getCurrentUser } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import VietnamClock from "@/components/VietnamClock";
import LeaveModal from "@/components/leave/LeaveModal";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

const Attendance = () => {
  const [role, setRole] = useState<UserRole>('staff');
  const [isAdminOrLeader, setIsAdminOrLeader] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  useEffect(() => {
    const loadRole = async () => {
      const user = await getCurrentUser();
      if (!user) return;
      const userRole = await getUserRole(user.id);
      setRole(userRole);
      setIsAdminOrLeader(userRole === 'admin' || userRole === 'leader' || userRole === 'hr');
    };
    loadRole();
  }, []);

  return (
    <DashboardLayout role={role}>
      <div className="space-y-4 md:space-y-6 animate-fade-in pb-20 md:pb-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 md:gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent text-2xl md:text-3xl lg:text-4xl">
              Chấm Công
            </h1>
            <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
              {isAdminOrLeader ? 'Quản lý chấm công toàn công ty và theo dõi chi tiết' : 'Quản lý chấm công theo ca làm việc và theo dõi tăng ca'}
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-3">
            <Button
              onClick={() => setIsLeaveModalOpen(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Nghỉ Phép
            </Button>
            <VietnamClock />
          </div>
        </div>

        {/* Content */}
        {isAdminOrLeader ? <AttendanceManagementWidget /> : <DailyAttendanceWidget />}
      </div>

      {/* Leave Modal */}
      <LeaveModal
        open={isLeaveModalOpen}
        onOpenChange={setIsLeaveModalOpen}
        role={role}
      />
    </DashboardLayout>
  );
};

export default Attendance;
