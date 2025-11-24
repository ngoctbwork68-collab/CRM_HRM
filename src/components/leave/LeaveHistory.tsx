import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, UserRole } from "@/lib/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { Tables } from "@/integrations/supabase/types";
import { Check, X } from "lucide-react"; 

// --- INTERFACES CHÍNH XÁC ---
interface UserProfileData {
    first_name: string | null;
    last_name: string | null;
}
type LeaveRequestBase = Tables<'leave_requests'>;

interface LeaveRequest extends LeaveRequestBase {
    profiles: UserProfileData | null; 
}
// --- END INTERFACES ---


// Component hiển thị lịch sử yêu cầu nghỉ phép
const LeaveHistory = ({ role }: { role: UserRole }) => {
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    // Hàm lấy Tên đầy đủ
    const getFullName = (profile: UserProfileData | null, userId: string) => {
        const name = `${profile?.last_name || ''} ${profile?.first_name || ''}`.trim();
        return name || `ID: ${userId.substring(0, 8)}...`;
    };

    // --- LOGIC TẢI DỮ LIỆU ---
    const fetchLeaves = useCallback(async () => {
        try {
            const user = await getCurrentUser();
            if (!user) return;

            let query = supabase
                .from('leave_requests')
                .select(`*`)
                .order('created_at', { ascending: false });

            if (role === 'staff') {
                query = query.eq('user_id', user.id);
            }

            const { data: leavesData, error } = await query;
            if (error) throw error;

            // Fetch profiles separately and merge
            if (leavesData && leavesData.length > 0) {
                const userIds = [...new Set(leavesData.map((l: any) => l.user_id))];
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name')
                    .in('id', userIds);

                const profilesMap = new Map();
                profilesData?.forEach((p: any) => {
                    profilesMap.set(p.id, { first_name: p.first_name, last_name: p.last_name });
                });

                const leavesWithProfiles = (leavesData as any[]).map(leave => ({
                    ...leave,
                    profiles: profilesMap.get(leave.user_id) || null
                }));

                setLeaves(leavesWithProfiles as LeaveRequest[]);
            } else {
                setLeaves([]);
            }
        } catch (error) {
            console.error('Lỗi khi lấy dữ liệu nghỉ phép:', error);
            toast({ title: "Lỗi", description: "Không thể tải lịch sử nghỉ phép.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [role, toast]); 

    useEffect(() => {
        fetchLeaves();

        const channel = supabase
            .channel('leaves-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
                fetchLeaves();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchLeaves]); 

    // Xử lý phê duyệt yêu cầu nghỉ phép
    const handleApprove = async (leaveId: string) => {
        try {
            const user = await getCurrentUser();
            if (!user) return;

            // Find the leave request to calculate days
            const leave = leaves.find(l => l.id === leaveId);
            if (!leave) throw new Error('Không tìm thấy yêu cầu nghỉ phép');

            // Calculate number of days
            const startDate = new Date(leave.start_date);
            const endDate = new Date(leave.end_date);
            const daysRequested = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

            // Update leave request status
            const updatePayload: Partial<LeaveRequestBase> = {
                status: 'approved',
                approved_by: user.id,
                approved_at: new Date().toISOString()
            };

            const { error: updateError } = await supabase
                .from('leave_requests')
                .update(updatePayload)
                .eq('id', leaveId);

            if (updateError) throw updateError;

            // Update user's annual leave balance if it's annual leave type
            if (leave.type === 'annual') {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('annual_leave_balance')
                    .eq('id', leave.user_id)
                    .single();

                if (profile) {
                    const newBalance = Math.max(0, profile.annual_leave_balance - daysRequested);
                    await supabase
                        .from('profiles')
                        .update({ annual_leave_balance: newBalance })
                        .eq('id', leave.user_id);
                }
            }

            toast({ title: "Thành công", description: `Yêu cầu nghỉ phép đã được phê duyệt (${daysRequested} ngày)` });
            await fetchLeaves();
        } catch (error) {
            console.error('Lỗi khi phê duyệt:', error);
            toast({ title: "Lỗi", description: "Không thể phê duyệt yêu cầu nghỉ phép", variant: "destructive" });
        }
    };

    // Xử lý từ chối yêu cầu nghỉ phép
    const handleReject = async (leaveId: string) => {
        try {
            const user = await getCurrentUser();
            if (!user) return;

            const updatePayload: Partial<LeaveRequestBase> = {
                status: 'rejected', 
                approved_by: user.id,
                approved_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('leave_requests')
                .update(updatePayload)
                .eq('id', leaveId);

            if (error) throw error;

            toast({ title: "Thành công", description: "Yêu cầu nghỉ phép đã bị từ chối" });
        } catch (error) {
            console.error('Lỗi khi từ chối:', error);
            toast({ title: "Lỗi", description: "Không thể từ chối yêu cầu nghỉ phép", variant: "destructive" });
        }
    };

    // Hiển thị Skeleton khi đang tải dữ liệu
    if (loading) {
        return <SkeletonTable rows={6} columns={role === 'leader' || role === 'admin' ? 7 : 5} />;
    }

    // Render bảng hiển thị lịch sử nghỉ phép
    return (
        <div className="border rounded-lg shadow-lg">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        {(role === 'leader' || role === 'admin') && <TableHead>Nhân viên</TableHead>}
                        <TableHead>Loại</TableHead>
                        <TableHead>Ngày Bắt đầu</TableHead>
                        <TableHead>Ngày Kết thúc</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Gửi lúc</TableHead>
                        {(role === 'leader' || role === 'admin') && <TableHead className="text-right">Hành động</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {leaves.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={role === 'leader' || role === 'admin' ? 7 : 5} className="text-center text-muted-foreground py-8">
                                Không tìm thấy yêu cầu nghỉ phép nào.
                            </TableCell>
                        </TableRow>
                    ) : 
                        leaves.map((leave) => (
                            <TableRow key={leave.id}>
                                {/* Cột Nhân viên (Chỉ hiển thị cho Leader/Admin) */}
                                {(role === 'leader' || role === 'admin') && (
                                    <TableCell className="font-medium">
                                        {getFullName(leave.profiles, leave.user_id)}
                                    </TableCell>
                                )}
                                
                                {/* Các cột khác */}
                                <TableCell className="capitalize font-medium">{leave.type.replace('_', ' ')}</TableCell>
                                <TableCell>{format(new Date(leave.start_date), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>{format(new Date(leave.end_date), 'dd/MM/yyyy')}</TableCell>
                                
                                {/* Trạng thái */}
                                <TableCell>
                                    <Badge
                                        variant={
                                            leave.status === 'approved' ? 'default' :
                                            leave.status === 'rejected' ? 'destructive' : 'secondary'
                                        }
                                    >
                                        {leave.status}
                                    </Badge>
                                </TableCell>
                                
                                <TableCell className="text-muted-foreground text-sm">
                                    {format(new Date(leave.created_at), 'dd/MM/yyyy')}
                                </TableCell>
                                
                                {/* Cột Hành động (Chỉ hiển thị cho Leader/Admin) */}
                                {(role === 'leader' || role === 'admin') && (
                                    <TableCell className="text-right">
                                        {leave.status === 'pending' && (
                                            <div className="flex gap-2 justify-end">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleApprove(leave.id)}
                                                >
                                                    <Check className="w-4 h-4 mr-1" /> Phê duyệt
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleReject(leave.id)}
                                                >
                                                    <X className="w-4 h-4 mr-1" /> Từ chối
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                </TableBody>
            </Table>
        </div>
    );
};
export default LeaveHistory;
