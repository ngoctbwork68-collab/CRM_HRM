import { supabase } from "@/integrations/supabase/client";
import { User, Session, VerifyOtpParams } from "@supabase/supabase-js";

// Loại bỏ các role không cần thiết nếu chưa sử dụng
export type UserRole = 'admin' | 'hr' | 'leader' | 'staff';

// Mở rộng Profile interface để bao gồm các cột từ 002 migration
export interface UserProfile {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    team_id: string | null;
    shift_id: string | null;
    position_id: string | null; // Đã thêm cột này từ migration 002
    phone: string | null;
    date_of_birth: string | null;
    annual_leave_balance: number;
    // account_status là cột trong bảng profiles, không phải user_registrations
    account_status: 'PENDING' | 'APPROVED' | 'REJECTED' | null; 
    employment_status: string | null; // Cột này cũng nên có trong Profile
    created_at?: string;
    updated_at?: string;
}

export const getCurrentUser = async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

export const getCurrentSession = async (): Promise<Session | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
};

export const getUserRole = async (userId: string): Promise<UserRole> => {
    const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

    if (error || !data) return 'staff';
    return data.role as UserRole;
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error || !data) return null;
    return data as UserProfile;
};

export const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
};

// Sửa lỗi 'any' và chuẩn hóa kiểu metadata
export const signUp = async (email: string, password: string, metadata?: Record<string, unknown>) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: redirectUrl,
            data: metadata
        }
    });

    // Create profile record if signup successful
    if (!error && data.user) {
        try {
            // Sử dụng các giá trị an toàn hơn cho metadata
            await supabase.from('profiles').insert({
                id: data.user.id,
                email: email,
                first_name: metadata?.first_name as string || null,
                last_name: metadata?.last_name as string || null,
                phone: metadata?.phone as string || null,
                employment_status: metadata?.employment_status as string || null,
                date_of_birth: null,
                gender: null,
                university: null,
                major: null,
                degree: null,
                avatar_url: null,
                cv_url: null,
                team_id: null,
                shift_id: null,
                position_id: null, // Đảm bảo cột này được khởi tạo
                annual_leave_balance: 0,
                account_status: 'PENDING',
            });
            // Gán role 'staff' mặc định
             await supabase.from('user_roles').insert({
                user_id: data.user.id,
                role: 'staff',
            });

        } catch (profileError) {
            const errorMessage = profileError instanceof Error ? profileError.message : String(profileError);
            console.error('Error creating profile or setting default role:', errorMessage);
            // Don't return error as user was created successfully
        }
    }

    return { data, error };
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
};

export const resetPasswordRequest = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth/reset-password`;

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
    });
    return { data, error };
};

export const updatePassword = async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
        password: newPassword
    });
    return { data, error };
};

// Sửa lỗi type: chỉ cho phép 'recovery' và 'email_change'
export const verifyOtp = async (email: string, token: string, type: 'recovery' | 'email_change' = 'recovery') => {
    const params: VerifyOtpParams = {
        email,
        token,
        type: type as 'email_change' | 'recovery' // Ép kiểu an toàn hơn
    };
    
    const { data, error } = await supabase.auth.verifyOtp(params);
    return { data, error };
};

// =================================================================================
// CÁC HÀM XỬ LÝ ĐĂNG KÝ (FIXED: Truy vấn bảng 'profiles' thay vì 'user_registrations')
// =================================================================================

// Lấy danh sách đang chờ duyệt (PENDING) từ bảng profiles
export const getPendingRegistrations = async () => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('account_status', 'PENDING');

    return { data: data as UserProfile[] | null, error };
};

// Cập nhật trạng thái phê duyệt (Thay thế RPC 'approve_user_registration')
export const approveRegistration = async (userId: string) => {
    // 1. Cập nhật trạng thái trong profiles
    const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
            account_status: 'APPROVED',
            // Dòng này phải được xử lý ở SQL/Trigger
            // admin_approved_at: new Date().toISOString(), 
        })
        .eq('id', userId);

    if (profileError) {
        console.error('Error approving registration:', profileError);
        return { data: null, error: profileError };
    }

    // 2. Nếu cần, gán role mặc định (Đã gán trong signUp, bước này có thể bỏ qua)

    return { data: { success: true }, error: null };
};

// Cập nhật trạng thái từ chối (Thay thế RPC 'reject_user_registration')
export const rejectRegistration = async (userId: string, reason: string) => {
    // Cập nhật trạng thái trong profiles
    const { error } = await supabase
        .from('profiles')
        .update({ 
            account_status: 'REJECTED',
            // rejection_reason: reason, // Cột này không có trong Profile interface
        }) 
        .eq('id', userId);

    if (error) {
        console.error('Error rejecting registration:', error);
        return { data: null, error };
    }

    return { data: { success: true }, error: null };
};

// Lấy trạng thái đăng ký (Truy vấn profiles)
export const getRegistrationStatus = async (userId: string) => {
    const { data, error } = await supabase
        .from('profiles') // Lỗi 2769: Đã sửa từ 'user_registrations' thành 'profiles'
        .select('*')
        .eq('id', userId)
        .single();

    if (error || !data) {
        return { data: null, error };
    }

    // Lỗi 2339: Chỉ trả về các thuộc tính tồn tại trong UserProfile
    return {
        data: {
            status: data.account_status,
            // Xóa các thuộc tính không còn tồn tại trong profiles:
            // rejection_reason: data.rejection_reason,
            // reapplication_count: data.reapplication_count,
            // admin_approved: data.admin_approved_at !== null,
            // hr_approved: data.hr_approved_at !== null,
            // both_approved: data.admin_approved_at !== null && data.hr_approved_at !== null
        },
        error: null
    };
};

// Hàm này không cần thiết vì profile được tạo trong signUp
export const createUserRegistration = async (registrationData: Record<string, unknown>) => {
    // user_registrations table automatically creates a trigger on profile insertion
    return { data: null, error: null };
};