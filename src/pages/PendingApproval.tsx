import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, AlertCircle, LogOut, Mail, Info } from "lucide-react";

const PendingApproval = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    const checkApprovalStatus = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          navigate("/auth/login");
          return;
        }

        const userProfile = await getUserProfile(user.id);
        setProfile(userProfile);

        if (userProfile?.rejection_reason) {
          setRejectionReason(userProfile.rejection_reason);
        }

        // If already approved, redirect to dashboard
        if (userProfile?.approval_status === "approved") {
          navigate("/dashboard");
          return;
        }
      } catch (error) {
        console.error("Error checking approval status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkApprovalStatus();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth/login");
  };

  const handleReApply = async () => {
    try {
      // Update last_approval_request to allow re-application
      const { error } = await supabase
        .from("profiles")
        .update({ 
          approval_status: "pending",
          last_approval_request: new Date().toISOString()
        })
        .eq("id", profile.id);

      if (error) throw error;

      setRejectionReason(null);
      setProfile({ ...profile, approval_status: "pending", rejection_reason: null });
    } catch (error) {
      console.error("Error re-applying:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <div className="animate-spin">
              <Clock className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
              <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <CardTitle className="text-2xl">Chờ Phê Duyệt</CardTitle>
          <CardDescription>
            Tài khoản của bạn đang chờ được phê duyệt bởi Admin/HR
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* User Info */}
          <div className="space-y-2 p-4 bg-secondary/50 rounded-lg">
            <div className="text-sm">
              <span className="font-medium text-foreground">Tên:</span>
              <p className="text-muted-foreground">
                {profile?.last_name} {profile?.first_name}
              </p>
            </div>
            <div className="text-sm">
              <span className="font-medium text-foreground">Email:</span>
              <p className="text-muted-foreground">{profile?.email}</p>
            </div>
            <div className="text-sm">
              <span className="font-medium text-foreground">Số điện thoại:</span>
              <p className="text-muted-foreground">{profile?.phone || "Chưa cung cấp"}</p>
            </div>
          </div>

          {/* Rejection Reason Alert (if rejected) */}
          {rejectionReason && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Đăng ký Bị Từ chối</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="font-medium mb-1">Lý do:</p>
                <p>{rejectionReason}</p>
                <p className="text-xs mt-3 opacity-75">
                  Bạn có thể liên hệ với bộ phận HR để được hỗ trợ hoặc đăng ký lại.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Pending Status Info */}
          {profile?.approval_status === "pending" && !rejectionReason && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Trạng thái</AlertTitle>
              <AlertDescription>
                Yêu cầu đăng ký của bạn đang được xem xét. Vui lòng chờ Admin/HR phê duyệt.
                Quá trình này thường mất 1-2 ngày làm việc.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {rejectionReason && (
              <Button onClick={handleReApply} className="w-full" size="lg">
                Đăng ký Lại
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              disabled
            >
              <Mail className="h-4 w-4" />
              Liên hệ HR (Coming Soon)
            </Button>

            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-xs text-muted-foreground text-center space-y-1 pt-4 border-t">
            <p>Có vấn đề? Liên hệ bộ phận HR:</p>
            <p className="font-medium text-foreground">hr@company.com</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
