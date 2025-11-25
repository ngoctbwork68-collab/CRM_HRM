import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getCurrentUser, getUserProfile, getUserRole, updatePassword } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Lock, Bell, Moon, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NotificationSettings {
  email_new_tasks: boolean;
  email_approvals: boolean;
  email_daily_reports: boolean;
  in_app_notifications: boolean;
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [role, setRole] = useState<UserRole>('staff');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  // Password & Security State
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Notifications State
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_new_tasks: true,
    email_approvals: true,
    email_daily_reports: true,
    in_app_notifications: true
  });
  const [notificationLoading, setNotificationLoading] = useState(false);

  // Theme State
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>('system');
  const [themeLoading, setThemeLoading] = useState(false);

  // Load user data and settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);

        // Get current user
        const user = await getCurrentUser();
        if (!user) {
          navigate('/auth/login');
          return;
        }

        setUserId(user.id);
        setUserEmail(user.email || '');

        // Get user role
        const userRole = await getUserRole(user.id);
        setRole(userRole);

        // Fetch profile with notification settings
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('notification_settings, theme_preference')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        if (profileData?.notification_settings) {
          setNotificationSettings(profileData.notification_settings);
        }

        if (profileData?.theme_preference) {
          setThemePreference(profileData.theme_preference);
          applyTheme(profileData.theme_preference);
        }

        // Load theme from localStorage as fallback
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
        if (savedTheme) {
          setThemePreference(savedTheme);
          applyTheme(savedTheme);
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
    };

    loadSettings();
  }, [navigate, toast]);

  // Apply theme to DOM
  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  };

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    // Validation
    if (!passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Mật khẩu mới không khớp');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải tối thiểu 6 ký tự');
      return;
    }

    try {
      setPasswordLoading(true);

      // First verify old password by attempting to re-auth
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: passwordData.oldPassword
      });

      if (signInError) {
        setPasswordError('Mật khẩu cũ không chính xác');
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (updateError) throw updateError;

      toast({
        title: "Thành Công",
        description: "Mật khẩu của bạn đã được thay đổi",
      });

      setPasswordData({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      setPasswordError((error as Error).message);
      toast({
        title: "Lỗi",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle notification settings change
  const handleNotificationChange = async (key: keyof NotificationSettings) => {
    try {
      setNotificationLoading(true);

      const updatedSettings = {
        ...notificationSettings,
        [key]: !notificationSettings[key]
      };

      const { error } = await supabase
        .from('profiles')
        .update({ notification_settings: updatedSettings })
        .eq('id', userId);

      if (error) throw error;

      setNotificationSettings(updatedSettings);

      toast({
        title: "Thành Công",
        description: "Cài đặt thông báo đã được cập nhật",
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setNotificationLoading(false);
    }
  };

  // Handle theme change
  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    try {
      setThemeLoading(true);

      // Update in database
      const { error } = await supabase
        .from('profiles')
        .update({ theme_preference: newTheme })
        .eq('id', userId);

      if (error) throw error;

      // Update localStorage
      localStorage.setItem('theme', newTheme);

      // Apply theme
      setThemePreference(newTheme);
      applyTheme(newTheme);

      toast({
        title: "Thành Công",
        description: "Chế độ giao diện đã được thay đổi",
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setThemeLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role={role}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Đang tải cài đặt...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6 animate-fade-in pb-20 md:pb-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent text-2xl md:text-3xl lg:text-4xl">
            Cài Đặt
          </h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
            Quản lý tài khoản, bảo mật, thông báo và giao diện
          </p>
        </div>

        <Tabs defaultValue="security" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Bảo Mật</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Thông Báo</span>
            </TabsTrigger>
            <TabsTrigger value="theme" className="flex items-center gap-2">
              <Moon className="h-4 w-4" />
              <span className="hidden sm:inline">Giao Diện</span>
            </TabsTrigger>
          </TabsList>

          {/* ===== PASSWORD & SECURITY ===== */}
          <TabsContent value="security" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Mật Khẩu & Bảo Mật
                </CardTitle>
                <CardDescription>
                  Thay đổi mật khẩu tài khoản của bạn
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                  {passwordError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{passwordError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="oldPassword">Mật Khẩu Cũ *</Label>
                    <Input
                      id="oldPassword"
                      type="password"
                      placeholder="Nhập mật khẩu hiện tại"
                      value={passwordData.oldPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Mật Khẩu Mới *</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Xác Nhận Mật Khẩu Mới *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Nhập lại mật khẩu mới"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={passwordLoading}
                    className="w-full"
                  >
                    {passwordLoading ? "Đang cập nhật..." : "Thay Đổi Mật Khẩu"}
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    Mật khẩu của bạn sẽ được mã hóa an toàn trên máy chủ.
                  </p>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== NOTIFICATIONS ===== */}
          <TabsContent value="notifications" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Cài Đặt Thông Báo
                </CardTitle>
                <CardDescription>
                  Quản lý các loại thông báo mà bạn nhận được
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Email Notifications */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Thông Báo Email</h3>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">Công Việc Mới</p>
                      <p className="text-sm text-muted-foreground">
                        Nhận thông báo khi được giao công việc mới
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.email_new_tasks}
                      onCheckedChange={() => handleNotificationChange('email_new_tasks')}
                      disabled={notificationLoading}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">Yêu Cầu Phê Duyệt</p>
                      <p className="text-sm text-muted-foreground">
                        Nhận thông báo khi có yêu cầu phê duyệt cần xử lý
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.email_approvals}
                      onCheckedChange={() => handleNotificationChange('email_approvals')}
                      disabled={notificationLoading}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">Báo Cáo Hàng Ngày</p>
                      <p className="text-sm text-muted-foreground">
                        Nhận tóm tắt hoạt động hàng ngày
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.email_daily_reports}
                      onCheckedChange={() => handleNotificationChange('email_daily_reports')}
                      disabled={notificationLoading}
                    />
                  </div>
                </div>

                {/* In-App Notifications */}
                <div className="space-y-4 border-t pt-6">
                  <h3 className="font-semibold text-lg">Thông Báo Trong Ứng Dụng</h3>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">Bật Thông Báo Trong App</p>
                      <p className="text-sm text-muted-foreground">
                        Hiển thị thông báo trong ứng dụng (badge, popup)
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.in_app_notifications}
                      onCheckedChange={() => handleNotificationChange('in_app_notifications')}
                      disabled={notificationLoading}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== THEME & UI ===== */}
          <TabsContent value="theme" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Moon className="h-5 w-5" />
                  Chế Độ Giao Diện
                </CardTitle>
                <CardDescription>
                  Chọn chế độ hiển thị sáng hoặc tối
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    {/* Light Mode */}
                    <div
                      onClick={() => handleThemeChange('light')}
                      className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                        themePreference === 'light'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">Chế Độ Sáng</h3>
                        {themePreference === 'light' && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Giao diện sáng (trắng)
                      </p>
                    </div>

                    {/* Dark Mode */}
                    <div
                      onClick={() => handleThemeChange('dark')}
                      className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                        themePreference === 'dark'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">Chế Độ Tối</h3>
                        {themePreference === 'dark' && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Giao diện tối (đen)
                      </p>
                    </div>

                    {/* System */}
                    <div
                      onClick={() => handleThemeChange('system')}
                      className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                        themePreference === 'system'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">Theo Hệ Thống</h3>
                        {themePreference === 'system' && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Theo cài đặt hệ thống
                      </p>
                    </div>
                  </div>

                  {themeLoading && (
                    <p className="text-sm text-muted-foreground">Đang cập nhật...</p>
                  )}

                  <Alert>
                    <AlertDescription>
                      Chế độ giao diện được lưu trên cơ sở dữ liệu và sẽ được tải khi bạn đăng nhập lần tới.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
