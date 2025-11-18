import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { 
    Loader2, Upload, User, Mail, Phone, Calendar, Users, Clock, Briefcase, Save, 
    FileText, Eye, Download
} from "lucide-react"; 
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// --- SCHEMA & TYPES ---
const profileSchema = z.object({
  first_name: z.string().min(1, "Tên là bắt buộc").max(100),
  last_name: z.string().min(1, "Họ là bắt buộc").max(100),
  phone: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface Team {
    id: string;
    name: string;
}

interface Shift {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
}

interface UserProfile {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    cv_url: string | null; // Cột này cần được lấy từ DB
    team_id: string | null;
    shift_id: string | null;
    phone: string | null;
    date_of_birth: string | null;
    annual_leave_balance: number;
}


const Profile = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [cvUploading, setCvUploading] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    
    // ĐÃ KHÔI PHỤC TYPES BỊ THIẾU
    const [team, setTeam] = useState<Team | null>(null); 
    const [shift, setShift] = useState<Shift | null>(null);

    const form = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            first_name: "",
            last_name: "",
            phone: "",
            date_of_birth: "",
        },
    });

    // --- LOGIC TẢI DỮ LIỆU ---
    const loadProfile = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate("/login");
                return;
            }

            // SỬA LỖI 2352: Phải chọn tường minh cv_url
            const { data: profileData, error: profileError } = await supabase
                .from("profiles")
                // Đã thêm cv_url vào select list
                .select("*, cv_url") 
                .eq("id", user.id)
                .single();

            if (profileError) throw profileError;

            // Ép kiểu an toàn (as UserProfile)
            const userProfile = profileData as UserProfile;
            setProfile(userProfile);
            
            form.reset({
                first_name: userProfile.first_name || "",
                last_name: userProfile.last_name || "",
                phone: userProfile.phone || "",
                date_of_birth: userProfile.date_of_birth || "",
            });

            // Lấy Team
            if (userProfile.team_id) {
                const { data: teamData } = await supabase
                    .from("teams")
                    .select("id, name")
                    .eq("id", userProfile.team_id)
                    .single();
                setTeam(teamData as Team);
            } else {
                setTeam(null);
            }

            // Lấy Shift
            if (userProfile.shift_id) {
                const { data: shiftData } = await supabase
                    .from("shifts")
                    .select("id, name, start_time, end_time")
                    .eq("id", userProfile.shift_id)
                    .single();
                setShift(shiftData as Shift);
            } else {
                setShift(null);
            }

        } catch (error) {
            console.error("Lỗi tải hồ sơ:", error);
            toast.error("Không thể tải hồ sơ người dùng.");
        } finally {
            setLoading(false);
        }
    }, [navigate, form]); 

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    // --- XỬ LÝ CẬP NHẬT THÔNG TIN ---
    const onSubmit = useCallback(async (data: ProfileFormData) => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from("profiles")
                .update({
                    first_name: data.first_name,
                    last_name: data.last_name,
                    phone: data.phone || null,
                    date_of_birth: data.date_of_birth || null,
                })
                .eq("id", user.id);

            if (error) throw error;

            toast.success("Hồ sơ đã được cập nhật thành công!");
            await loadProfile();
        } catch (error) {
            console.error("Lỗi cập nhật hồ sơ:", error);
            toast.error("Cập nhật hồ sơ thất bại.");
        } finally {
            setLoading(false);
        }
    }, [loadProfile]);

    // --- XỬ LÝ UPLOAD AVATAR ---
    const handleAvatarUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const file = event.target.files?.[0];
            if (!file) return;

            if (file.size > 2 * 1024 * 1024) {
                toast.error("Kích thước file phải nhỏ hơn 2MB.");
                return;
            }

            setUploading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const fileExt = file.name.split(".").pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`; 

            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from("avatars")
                .getPublicUrl(filePath);

            // SỬA LỖI 2353: Cập nhật avatar_url
            const { error: updateError } = await supabase
                .from("profiles")
                .update({ avatar_url: publicUrl }) 
                .eq("id", user.id);

            if (updateError) throw updateError;

            toast.success("Ảnh đại diện đã được cập nhật thành công!");
            await loadProfile();
        } catch (error) {
            console.error("Lỗi tải ảnh đại diện:", error);
            toast.error("Tải ảnh đại diện thất bại.");
        } finally {
            setUploading(false);
        }
    }, [loadProfile]);
    
    // --- XỬ LÝ UPLOAD CV CÁ NHÂN ---
    const handleCvUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const file = event.target.files?.[0];
            if (!file) return;

            if (file.type !== 'application/pdf') {
                toast.error("Vui lòng tải lên file định dạng PDF.");
                return;
            }

            if (file.size > 5 * 1024 * 1024) { 
                toast.error("Kích thước file phải nhỏ hơn 5MB.");
                return;
            }

            setCvUploading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const filePath = `${user.id}/${Date.now()}_cv.pdf`; 

            const { error: uploadError } = await supabase.storage
                .from("documents") // SỬ DỤNG BUCKET 'documents'
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from("documents")
                .getPublicUrl(filePath);

            // Lưu CV URL vào cột cv_url
            const { error: updateError } = await supabase
                .from("profiles")
                .update({ cv_url: publicUrl })
                .eq("id", user.id);

            if (updateError) throw updateError;

            toast.success("Hồ sơ (CV) đã được tải lên thành công!");
            await loadProfile();
        } catch (error) {
            console.error("Lỗi tải CV:", error);
            toast.error("Tải CV thất bại.");
        } finally {
            setCvUploading(false);
        }
    }, [loadProfile]);
    
    // --- UI/RENDER ---

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-screen">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    if (!profile) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-screen">
                    <p className="text-muted-foreground">Không tìm thấy hồ sơ người dùng.</p>
                </div>
            </DashboardLayout>
        );
    }

    const initials = `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase();

    return (
        <DashboardLayout>
            <div className="container mx-auto py-8 px-4 max-w-5xl">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                        Cài đặt Hồ sơ Cá nhân
                    </h1>
                    <p className="text-muted-foreground mt-2">Quản lý thông tin cá nhân và tài liệu của bạn.</p>
                </div>

                <div className="grid gap-6">
                    {/* --- 1. Thẻ Ảnh Đại diện --- */}
                    <Card className="shadow-medium transition-smooth hover:shadow-strong">
                        <CardHeader>
                            <CardTitle>Ảnh Đại diện</CardTitle>
                            <CardDescription>Tải lên ảnh để cá nhân hóa tài khoản của bạn.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col sm:flex-row items-center gap-6">
                            <Avatar className="h-32 w-32 ring-4 ring-primary/20 shadow-lg">
                                <AvatarImage src={profile.avatar_url || undefined} />
                                <AvatarFallback className="text-3xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                                    {initials || <User className="h-12 w-12" />}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-center sm:text-left">
                                <Label htmlFor="avatar-upload" className="cursor-pointer">
                                    <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-md transition-smooth">
                                        {uploading ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                Đang tải lên...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="h-5 w-5" />
                                                Tải Ảnh Mới
                                            </>
                                        )}
                                    </div>
                                </Label>
                                <Input
                                    id="avatar-upload"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleAvatarUpload}
                                    disabled={uploading}
                                />
                                <p className="text-sm text-muted-foreground mt-2">
                                    Chỉ chấp nhận JPG, PNG hoặc GIF. Tối đa 2MB.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* --- 2. Thẻ CV Cá nhân --- */}
                    <Card className="shadow-medium transition-smooth hover:shadow-strong">
                        <CardHeader>
                            <CardTitle>Hồ sơ (CV) Cá nhân</CardTitle>
                            <CardDescription>Tải lên hoặc xem hồ sơ cá nhân (CV) mới nhất của bạn (Chỉ PDF).</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-center gap-6">
                            <div className="p-4 rounded-xl bg-secondary/70 border border-border flex items-center justify-center shrink-0">
                                <FileText className="h-10 w-10 text-primary" />
                            </div>
                            <div className="flex-1 space-y-3">
                                
                                {/* Trạng thái và nút Xem/Tải lên */}
                                <div className="flex items-center gap-4">
                                    {profile.cv_url ? (
                                        <>
                                            <a href={profile.cv_url} target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline" className="text-primary hover:bg-secondary">
                                                    <Eye className="h-4 w-4 mr-2" /> Xem CV
                                                </Button>
                                            </a>
                                            <a href={profile.cv_url} download>
                                                <Button variant="secondary" className="bg-green-600 hover:bg-green-700 text-white">
                                                    <Download className="h-4 w-4 mr-2" /> Tải xuống
                                                </Button>
                                            </a>
                                        </>
                                    ) : (
                                        <p className="text-sm text-warning font-semibold">Chưa có hồ sơ được tải lên.</p>
                                    )}
                                    
                                    {/* Nút Upload */}
                                    <Label htmlFor="cv-upload" className="cursor-pointer">
                                        <Button asChild className="h-9 px-4 bg-primary hover:bg-primary/90 shadow-md" disabled={cvUploading}>
                                            <div>
                                                {cvUploading ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                        Đang tải...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="h-4 w-4 mr-2" /> Tải lên CV (PDF)
                                                    </>
                                                )}
                                            </div>
                                        </Button>
                                    </Label>
                                    <Input
                                        id="cv-upload"
                                        type="file"
                                        accept=".pdf"
                                        className="hidden"
                                        onChange={handleCvUpload}
                                        disabled={cvUploading}
                                    />
                                </div>
                                
                                <p className="text-xs text-muted-foreground">
                                    Chỉ chấp nhận định dạng PDF. Tối đa 5MB. Việc tải lên sẽ ghi đè lên file cũ.
                                </p>
                            </div>
                        </CardContent>
                    </Card>


                    {/* --- 3. Thẻ Thông tin Cá nhân --- (Sửa từ số 2 cũ) */}
                    <Card className="shadow-medium transition-smooth hover:shadow-strong">
                        <CardHeader>
                            <CardTitle>Thông tin Cá nhân</CardTitle>
                            <CardDescription>Cập nhật chi tiết hồ sơ của bạn.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    {/* ... (Các trường Form giữ nguyên) ... */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* First Name */}
                                        <FormField
                                            control={form.control}
                                            name="first_name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Tên</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                            <Input {...field} className="pl-10" placeholder="Ví dụ: Văn" />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Last Name */}
                                        <FormField
                                            control={form.control}
                                            name="last_name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Họ</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                            <Input {...field} className="pl-10" placeholder="Ví dụ: Nguyễn" />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Phone Number */}
                                        <FormField
                                            control={form.control}
                                            name="phone"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Số điện thoại</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                            <Input {...field} type="tel" className="pl-10" placeholder="090-xxx-xxxx" />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Date of Birth */}
                                        <FormField
                                            control={form.control}
                                            name="date_of_birth"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Ngày sinh</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                            <Input {...field} type="date" className="pl-10" />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Email (Disabled) */}
                                        <div className="space-y-2 col-span-1 md:col-span-2">
                                            <Label>Địa chỉ Email</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input value={profile.email} disabled className="pl-10 bg-secondary/50 font-semibold" />
                                            </div>
                                            <p className="text-sm text-muted-foreground">Email là thông tin cố định và không thể thay đổi.</p>
                                        </div>
                                    </div>

                                    <Button type="submit" disabled={loading} className="w-full sm:w-auto h-10 px-8 bg-primary hover:bg-primary/90 shadow-md transition-smooth">
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Đang lưu...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="mr-2 h-4 w-4" />
                                                Lưu Thay đổi
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                    
                    {/* --- 4. Thẻ Thông tin Tổ chức --- (Sửa từ số 3 cũ) */}
                    <Card className="shadow-medium transition-smooth hover:shadow-strong">
                        <CardHeader>
                            <CardTitle>Thông tin Tổ chức</CardTitle>
                            <CardDescription>Chi tiết về đội nhóm, ca làm việc và quyền lợi của bạn.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Team Info */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-primary" />
                                        Đội nhóm
                                    </Label>
                                    <div className="px-4 py-3 bg-secondary/50 rounded-lg border border-border font-medium text-sm">
                                        {team?.name || "Chưa được phân công"}
                                    </div>
                                </div>

                                {/* Shift Info */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-primary" />
                                        Ca làm việc
                                    </Label>
                                    <div className="px-4 py-3 bg-secondary/50 rounded-lg border border-border font-medium text-sm">
                                        {shift ? `${shift.name} (${shift.start_time} - ${shift.end_time})` : "Chưa được phân công"}
                                    </div>
                                </div>

                                {/* Annual Leave Balance */}
                                <div className="space-y-2 col-span-1 md:col-span-2">
                                    <Label className="flex items-center gap-2">
                                        <Briefcase className="h-4 w-4 text-primary" />
                                        Số ngày nghỉ phép thường niên
                                    </Label>
                                    <div className="px-5 py-4 bg-gradient-to-r from-primary to-primary-glow rounded-lg shadow-lg">
                                        <p className="text-3xl font-extrabold text-primary-foreground">
                                            {profile.annual_leave_balance} ngày
                                        </p>
                                        <p className="text-xs text-primary-foreground/80 mt-1">còn lại trong năm</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default Profile;