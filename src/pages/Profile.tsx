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
    FileText, Eye, Download, Info, Zap, GraduationCap, CheckCircle
} from "lucide-react"; 
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator"; 
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select"; 
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns"; 


// --- SCHEMA & TYPES ---

interface Team { id: string; name: string; }
interface Shift { id: string; name: string; start_time: string; end_time: string; }

interface UserProfile {
    id: string; email: string; first_name: string | null; last_name: string | null;
    avatar_url: string | null; cv_url: string | null; team_id: string | null;
    shift_id: string | null; phone: string | null; date_of_birth: string | null;
    annual_leave_balance: number;
    gender: 'Nam' | 'Nữ' | 'Khác' | null;
    employment_status: 'Employed' | 'Student' | 'Trainee' | null;
    university: string | null; major: string | null;
    degree: 'HighSchool' | 'Bachelor' | 'Master' | 'PhD' | null; 
}

// Khung logic Zod cho các trường user ĐƯỢC PHÉP SỬA
const profileSchema = z.object({
  first_name: z.string().min(1, "Tên là bắt buộc").max(100),
  last_name: z.string().min(1, "Họ là bắt buộc").max(100),
  phone: z.string().optional().nullable().transform(e => e === "" ? null : e), 
  date_of_birth: z.string().optional().nullable().transform(e => e === "" ? null : e),
  gender: z.enum(['Nam', 'Nữ', 'Khác']).nullable().optional(),
  
  degree: z.enum(['HighSchool', 'Bachelor', 'Master', 'PhD']).nullable().optional(),
  employment_status: z.enum(['Employed', 'Student', 'Trainee']).nullable().optional(),
  university: z.string().optional().nullable().transform(e => e === "" ? null : e),
  major: z.string().optional().nullable().transform(e => e === "" ? null : e),
});

type ProfileFormData = z.infer<typeof profileSchema>;


const Profile = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [cvUploading, setCvUploading] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [team, setTeam] = useState<Team | null>(null); 
    const [shift, setShift] = useState<Shift | null>(null);
    const [completion, setCompletion] = useState(0);
    const [userRoleDisplay, setUserRoleDisplay] = useState(''); // State hiển thị Role

    const form = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            first_name: "", last_name: "", phone: "", date_of_birth: "",
            gender: null, 
            employment_status: null, university: "", major: "",
            degree: null, 
        },
    });

    // Hàm chuyển đổi ENUM Bằng cấp sang Tiếng Việt
    const getDegreeDisplayName = (degree: UserProfile['degree'] | null | undefined): string => {
        switch (degree) {
            case 'HighSchool': return 'Tốt nghiệp cấp 3';
            case 'Bachelor': return 'Cử nhân';
            case 'Master': return 'Thạc sĩ';
            case 'PhD': return 'Tiến sĩ';
            default: return '—';
        }
    };
    
    // Hàm chuyển đổi ENUM Role sang Tiếng Việt
    const getRoleDisplayName = (r: string) => {
        if (r === 'admin') return 'Quản trị';
        if (r === 'hr') return 'Nhân sự';
        if (r === 'leader') return 'Trưởng nhóm';
        if (r === 'teacher') return 'Giáo viên';
        if (r === 'it') return 'IT';
        if (r === 'content') return 'Content';
        if (r === 'design') return 'Designer';
        return r.charAt(0).toUpperCase() + r.slice(1);
    };


    // --- LOGIC TÍNH ĐỘ HOÀN THIỆN ---
    const calculateCompletion = (p: UserProfile | null): number => {
        if (!p) return 0;
        let score = 0;
        const requiredFields = [p.first_name, p.last_name, p.email, p.phone, p.date_of_birth, p.gender, p.employment_status, p.university, p.major, p.avatar_url, p.cv_url, p.degree];
        const filledFields = requiredFields.filter(val => val && val !== "").length;
        
        score = Math.round((filledFields / 12) * 100);
        return Math.min(score, 100);
    };

    // --- TẠO SIGNED URL BẢO MẬT ---
    const getCvDownloadUrl = useCallback(async (cvUrl: string) => {
        try {
            const bucketName = 'documents';
            const pathSegments = cvUrl.split(`${bucketName}/`);
            if (pathSegments.length < 2) { toast.error("Lỗi: Không tìm thấy đường dẫn file trong URL."); return null; }
            const filePath = pathSegments[1]; 
            const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(filePath, 300); 
            if (error) throw error;
            return data.signedUrl;
        } catch (error) {
            console.error("Lỗi tạo URL bảo mật:", error);
            toast.error("Không thể tạo liên kết xem CV.");
            return null;
        }
    }, []);

    // --- HÀM GỬI THÔNG BÁO CHO ADMIN/HR ---
    const notifyAdminOfChange = useCallback(async (name: string) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: adminRoles } = await supabase
                .from('user_roles')
                .select('user_id')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .in('role', ['admin', 'hr'] as any); 

            if (!adminRoles) return;

            const notifications = adminRoles.map(r => ({
                user_id: r.user_id,
                type: 'PROFILE_UPDATE',
                title: 'Cập nhật Hồ sơ chờ duyệt!',
                message: `User ${name} vừa cập nhật thông tin cá nhân. Cần kiểm tra lại hồ sơ.`,
                link: '/organization/users', 
            }));

            await supabase.from('notifications').insert(notifications);
        } catch (e) {
            console.error("Lỗi gửi thông báo:", e);
        }
    }, []);


    // --- LOGIC TẢI DỮ LIỆU ---
    const loadProfile = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { navigate("/login"); return; }

            const { data: profileData, error: profileError } = await supabase
                .from("profiles")
                .select(`
                    id, email, first_name, last_name, avatar_url, cv_url,
                    team_id, shift_id, phone, date_of_birth, annual_leave_balance,
                    gender, employment_status, university, major, degree
                `) 
                .eq("id", user.id)
                .single();

            // FIX: LẤY VAI TRÒ (ROLE) HIỆN TẠI
            const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .single();
            
            // Xử lý vai trò hiển thị
            setUserRoleDisplay(getRoleDisplayName(roleData?.role || 'staff'));
            
            if (profileError) throw profileError;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const userProfile = profileData as any as UserProfile; 
            setProfile(userProfile);
            setCompletion(calculateCompletion(userProfile)); 
            
            form.reset({
                first_name: userProfile.first_name || "", last_name: userProfile.last_name || "", 
                phone: userProfile.phone || "", date_of_birth: userProfile.date_of_birth || "",
                gender: userProfile.gender || null, 
                employment_status: userProfile.employment_status || null, 
                university: userProfile.university || "", 
                major: userProfile.major || "",
                degree: userProfile.degree || null, 
            });

            // Tải thông tin tổ chức (READ-ONLY)
            if (userProfile.team_id) {
                const { data: teamData } = await supabase.from("teams").select("id, name").eq("id", userProfile.team_id).single();
                setTeam(teamData as Team);
            } else { setTeam(null); }

            if (userProfile.shift_id) {
                const { data: shiftData } = await supabase.from("shifts").select("id, name, start_time, end_time").eq("id", userProfile.shift_id).single();
                setShift(shiftData as Shift);
            } else { setShift(null); }

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

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await supabase
                .from("profiles")
                .update({
                    first_name: data.first_name, last_name: data.last_name, phone: data.phone,
                    date_of_birth: data.date_of_birth, gender: data.gender, 
                    employment_status: data.employment_status, 
                    university: data.university, 
                    major: data.major,
                    degree: data.degree,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any) 
                .eq("id", user.id);

            if (error) throw error;

            const userName = `${data.last_name} ${data.first_name}`;
            notifyAdminOfChange(userName); 

            toast.success("Hồ sơ đã được cập nhật thành công! Đang chờ Admin/HR xem xét.");
            await loadProfile(); 
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Lỗi cập nhật hồ sơ:", errorMessage);
            toast.error("Cập nhật hồ sơ thất bại.");
        } finally {
            setLoading(false);
        }
    }, [loadProfile, notifyAdminOfChange]);

    // ... (handleAvatarUpload và handleCvUpload giữ nguyên logic) ...
    const handleAvatarUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) { toast.error("Kích thước file phải nhỏ hơn 2MB."); return; }

            setUploading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const fileExt = file.name.split(".").pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`; 

            const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);

            const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
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
    
    const handleCvUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.type !== 'application/pdf') { toast.error("Vui lòng tải lên file định dạng PDF."); return; }
            if (file.size > 5 * 1024 * 1024) { toast.error("Kích thước file phải nhỏ hơn 5MB."); return; }

            setCvUploading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const filePath = `${user.id}/${Date.now()}_cv.pdf`; 

            const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file, { upsert: true });
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(filePath);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: updateError } = await supabase.from("profiles").update({ cv_url: publicUrl } as any).eq("id", user.id);
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
    const shiftInfoTime = shift ? `${shift.start_time} - ${shift.end_time}` : "Chưa phân công";


    return (
        <DashboardLayout>
            <div className="container mx-auto py-8 px-4 max-w-5xl">
                <Card className="shadow-2xl transition-all duration-500 hover:shadow-primary/30">
                    <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent border-b rounded-t-xl">
                        <CardTitle className="text-2xl font-extrabold flex items-center gap-3 text-primary tracking-tight">
                            <Info className="h-6 w-6" /> CÀI ĐẶT H��� SƠ CÁ NHÂN
                        </CardTitle>
                        <CardDescription>Quản lý thông tin cá nhân và tài liệu của bạn.</CardDescription>
                    </CardHeader>
                    
                    <CardContent className="p-4 md:p-8">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            
                            {/* --- CỘT TRÁI: AVATAR & THÔNG TIN TỔ CHỨC (Cột 1) --- */}
                            <div className="lg:col-span-1 space-y-8 order-1">
                                
                                {/* Khối 1: Ảnh Đại diện */}
                                <div className="space-y-4 p-4 border border-border/70 rounded-xl bg-secondary/30">
                                    <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2 text-primary"><User className="h-4 w-4" /> Ảnh Đại Diện</h3>
                                    <div className="flex flex-col items-center gap-4">
                                        <Avatar className="h-32 w-32 ring-4 ring-primary/30 shadow-xl">
                                            <AvatarImage src={profile.avatar_url || undefined} />
                                            <AvatarFallback className="text-3xl bg-primary text-primary-foreground">{initials || <User className="h-12 w-12" />}</AvatarFallback>
                                        </Avatar>
                                        <Label htmlFor="avatar-upload" className="cursor-pointer">
                                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-md transition-smooth h-9 text-sm" aria-disabled={uploading}>
                                                {uploading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Đang tải...</>) : (<><Upload className="h-4 w-4" /> Tải Ảnh Mới</>)}
                                            </div>
                                        </Label>
                                        <Input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                                    </div>
                                </div>
                                
                                <Separator />

                                {/* Khối 2: Chi tiết Vận hành (READ-ONLY) */}
                                <div className="space-y-4 p-4 border border-border/70 rounded-xl bg-secondary/30">
                                    <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2 text-primary"><Briefcase className="h-4 w-4" /> Chi tiết Vận hành (Admin Phân loại)</h3>
                                    <div className="space-y-3">
                                        
                                        {/* Đội nhóm (READ-ONLY) */}
                                        <div className="space-y-1">
                                            <Label className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" /> Đội nhóm:</Label>
                                            <p className="font-semibold text-base">{team?.name || "Chưa phân công"}</p>
                                        </div>

                                        {/* Ca làm việc (READ-ONLY) */}
                                        <div className="space-y-1">
                                            <Label className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Ca làm việc:</Label>
                                            <p className="font-semibold text-base">{shift ? `${shift.name} (${shiftInfoTime})` : "Chưa phân công"}</p>
                                        </div>
                                        
                                        {/* Nghỉ phép (READ-ONLY) */}
                                        <div className="space-y-1">
                                            <Label className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-4 w-4" /> Nghỉ phép năm:</Label>
                                            <p className="font-semibold text-base text-orange-600">{profile?.annual_leave_balance || 0} ngày</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* --- CỘT GIỮA & PHẢI: FORM CHỈNH SỬA VÀ CV (Cột 2 & 3) --- */}
                            <div className="lg:col-span-2 space-y-8 order-2">
                                
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                        
                                        {/* Khối 1: Thông tin Cơ bản & Liên hệ (ĐƯỢC PHÉP SỬA) */}
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2 text-primary"><User className="h-4 w-4" /> Thông tin Cá nhân</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {/* 1. Họ, 2. Tên */}
                                                <FormField control={form.control} name="last_name" render={({ field }) => (<FormItem><FormLabel>1. Họ</FormLabel><FormControl><Input {...field} placeholder="Ví dụ: Võ" /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={form.control} name="first_name" render={({ field }) => (<FormItem><FormLabel>2. Tên</FormLabel><FormControl><Input {...field} placeholder="Ví dụ: Chí Nhân" /></FormControl><FormMessage /></FormItem>)} />
                                                
                                                {/* 3. Giới tính, 4. Ngày sinh */}
                                                <FormField control={form.control} name="gender" render={({ field }) => (
                                                    <FormItem><FormLabel>3. Giới tính</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Chọn giới tính" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Nam">Nam</SelectItem><SelectItem value="Nữ">Nữ</SelectItem><SelectItem value="Khác">Khác</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                                )} />
                                                <FormField control={form.control} name="date_of_birth" render={({ field }) => (<FormItem><FormLabel>4. Ngày sinh ({profile?.date_of_birth ? format(new Date(profile.date_of_birth), 'dd/MM/yyyy') : 'chưa có'})</FormLabel><FormControl><Input {...field} type="date" /></FormControl><FormMessage /></FormItem>)} />
                                                
                                                {/* 5. Số điện thoại */}
                                                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>5. Số điện thoại</FormLabel><FormControl><Input {...field} type="tel" placeholder="090-xxx-xxxx" /></FormControl><FormMessage /></FormItem>)} />
                                                
                                                {/* 6. Email (Thông tin cố định) */}
                                                <div className="space-y-2">
                                                    <Label>6. Địa chỉ Email (Không đổi)</Label>
                                                    <Input value={profile?.email} disabled className="bg-secondary/50 font-semibold" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Khối 2: Thông tin Học vấn & Nghề nghiệp (ĐƯỢC PHÉP SỬA) */}
                                        <div className="space-y-4 p-4 border border-border rounded-xl">
                                            <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2 text-primary"><GraduationCap className="h-4 w-4" /> Học vấn & Nghề nghiệp</h3>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                
                                                {/* TRƯỜNG BẰNG CẤP MỚI */}
                                                <FormField control={form.control} name="degree" render={({ field }) => (
                                                    <FormItem><FormLabel>Bằng cấp</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Chọn bằng cấp" /></SelectTrigger></FormControl><SelectContent>
                                                        <SelectItem value="HighSchool">{getDegreeDisplayName('HighSchool')}</SelectItem>
                                                        <SelectItem value="Bachelor">{getDegreeDisplayName('Bachelor')}</SelectItem>
                                                        <SelectItem value="Master">{getDegreeDisplayName('Master')}</SelectItem>
                                                        <SelectItem value="PhD">{getDegreeDisplayName('PhD')}</SelectItem>
                                                    </SelectContent></Select><FormMessage /></FormItem>
                                                )} />
                                                
                                                {/* 7. Nghề nghiệp */}
                                                <FormField control={form.control} name="employment_status" render={({ field }) => (
                                                    <FormItem><FormLabel>7. Tình trạng Nghề nghiệp</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Chọn tình trạng" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Employed">Đã đi làm</SelectItem><SelectItem value="Student">Sinh viên</SelectItem><SelectItem value="Trainee">Thực tập/Học sinh</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                                )} />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {/* 8. Trường Đại học */}
                                                <FormField control={form.control} name="university" render={({ field }) => (<FormItem><FormLabel>8. Trường Đại học/Cao đẳng</FormLabel><FormControl><Input {...field} placeholder="Ví dụ: ĐH Quốc gia" /></FormControl><FormMessage /></FormItem>)} />
                                                {/* 9. Chuyên ngành */}
                                                <FormField control={form.control} name="major" render={({ field }) => (<FormItem><FormLabel>9. Chuyên ngành</FormLabel><FormControl><Input {...field} placeholder="Ví dụ: CNTT" /></FormControl><FormMessage /></FormItem>)} />
                                            </div>

                                            <p className="text-xs text-muted-foreground pt-1">Thông tin Vị trí (Team/Shift) được quản lý bởi bộ phận Tổ chức.</p>
                                        </div>


                                        {/* Khối 3: Quản lý CV */}
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2 text-primary"><FileText className="h-4 w-4" /> Quản lý Hồ sơ (CV)</h3>
                                            <p className="text-sm text-muted-foreground">Tải lên file PDF (Tối đa 5MB). File sẽ được bảo mật và chỉ Admin/Leader xem được.</p>
                                            
                                            <div className="flex flex-wrap items-center gap-3">
                                                {profile?.cv_url ? (
                                                    <>
                                                        <Button variant="secondary" className="bg-primary hover:bg-primary/90 text-white h-9 px-4" onClick={async () => { const url = await getCvDownloadUrl(profile.cv_url!); if (url) { window.open(url, '_blank'); } }}><Eye className="h-4 w-4 mr-2" /> Xem CV</Button>
                                                        <Button variant="secondary" className="bg-green-600 hover:bg-green-700 text-white h-9 px-4" onClick={async () => { const url = await getCvDownloadUrl(profile.cv_url!); if (url) { window.open(url, '_self'); } }}><Download className="h-4 w-4 mr-2" /> Tải xuống</Button>
                                                    </>
                                                ) : (<p className="text-sm text-red-500 font-semibold">Chưa có hồ sơ được tải lên.</p>)}
                                                
                                                <Label htmlFor="cv-upload" className="cursor-pointer">
                                                    <Button asChild className="h-9 px-4 shadow-md" disabled={cvUploading} variant={profile?.cv_url ? "default" : "destructive"}>
                                                        <div>{cvUploading ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" /> Đang tải...</>) : (<><Upload className="h-4 w-4 mr-2" /> {profile?.cv_url ? "Cập nhật CV mới" : "Tải lên CV (PDF)"}</>)}</div>
                                                    </Button>
                                                </Label>
                                                <Input id="cv-upload" type="file" accept=".pdf" className="hidden" onChange={handleCvUpload} disabled={cvUploading} />
                                            </div>
                                        </div>

                                        {/* Nút Lưu thay đổi (Luôn ở cuối Form) */}
                                        <div className="flex justify-end pt-4 border-t border-border mt-8">
                                            <Button type="submit" disabled={loading} className="w-full sm:w-auto h-10 px-8">
                                                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang lưu...</>) : (<><Save className="mr-2 h-4 w-4" /> Lưu Thay đổi</>)}
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}

export default Profile;
