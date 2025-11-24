import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentUser, getUserProfile } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { TablesInsert, Enums } from "@/integrations/supabase/types";
import { Send, Clock, AlertCircle } from "lucide-react";

// Kiểu enum từ Supabase
type LeaveType = Enums<'leave_type'>;
type LeaveInsert = TablesInsert<'leave_requests'>;
type WorkHourType = 'FULL' | 'HALF_AM' | 'HALF_PM'; // Kiểu tùy chọn cho ngày công

const LeaveRequestForm = () => {
    const [leaveType, setLeaveType] = useState<LeaveType>("annual");
    const [workHourType, setWorkHourType] = useState<WorkHourType>("FULL");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [leaveBalance, setLeaveBalance] = useState(0);
    const [estimatedDays, setEstimatedDays] = useState(0);
    const { toast } = useToast();

    // Load user's leave balance
    useEffect(() => {
        const loadBalance = async () => {
            const user = await getCurrentUser();
            if (user) {
                const profile = await getUserProfile(user.id);
                if (profile) {
                    setLeaveBalance(profile.annual_leave_balance);
                }
            }
        };
        loadBalance();
    }, []);

    // Calculate estimated days
    useEffect(() => {
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (start <= end) {
                let days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                // Adjust for half days
                if (workHourType === 'HALF_AM' || workHourType === 'HALF_PM') {
                    days = days - 0.5;
                }
                setEstimatedDays(days);
            }
        }
    }, [startDate, endDate, workHourType]);

    // Xử lý Select Type (ép kiểu an toàn)
    const handleLeaveTypeChange = (value: string) => {
        setLeaveType(value as LeaveType);
    };

    // Xử lý Select Ngày công
    const handleWorkHourTypeChange = (value: string) => {
        setWorkHourType(value as WorkHourType);
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Kiểm tra điều kiện ngày
            if (new Date(startDate) > new Date(endDate)) {
                throw new Error("Ngày kết thúc không được trước ngày bắt đầu.");
            }

            // Kiểm tra hạn mức nghỉ phép cho loại Annual
            if (leaveType === 'annual' && estimatedDays > leaveBalance) {
                throw new Error(`Bạn chỉ còn ${leaveBalance} ngày nghỉ phép, nhưng yêu cầu ${estimatedDays} ngày.`);
            }

            const user = await getCurrentUser();
            if (!user) throw new Error("Chưa xác thực người dùng.");

            const descriptionDetail = `[ÁP DỤNG: ${workHourType}] - ${reason}`;

            const newLeaveRequest: LeaveInsert = {
                user_id: user.id,
                type: leaveType,
                start_date: startDate,
                end_date: endDate,
                reason: descriptionDetail,
                status: "pending",
            };

            const { error } = await supabase.from("leave_requests").insert([newLeaveRequest]);

            if (error) throw error;

            toast({
                title: "Yêu cầu đã gửi thành công",
                description: `Yêu cầu nghỉ phép ${estimatedDays} ngày của bạn đang chờ phê duyệt.`,
            });

            resetForm();
        } catch (error) {
            console.error("Lỗi gửi yêu cầu nghỉ phép:", error);
            toast({
                title: "Lỗi",
                description: error instanceof Error ? error.message : "Không thể gửi yêu cầu nghỉ phép. Vui lòng thử lại.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setLeaveType("annual");
        setWorkHourType("FULL");
        setStartDate("");
        setEndDate("");
        setReason("");
    };

    return (
        <Card className="shadow-xl">
            <CardHeader className="bg-primary/5 border-b rounded-t-lg">
                <CardTitle className="text-xl flex items-center gap-2">
                    <Send className="h-5 w-5 text-primary" /> Gửi Yêu cầu Nghỉ phép
                </CardTitle>
                <CardDescription>Điền vào biểu mẫu để yêu cầu nghỉ phép (Nghỉ phép năm, ốm, cá nhân).</CardDescription>
            </CardHeader>

            <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Leave Balance Info for Annual Leave */}
                    {leaveType === 'annual' && (
                        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
                            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 text-sm">
                                <p className="font-semibold text-blue-900 dark:text-blue-100">Thông tin Nghỉ phép Năm</p>
                                <p className="text-blue-800 dark:text-blue-300 mt-1">
                                    Số ngày còn lại: <span className="font-bold text-lg">{leaveBalance}</span> ngày
                                    {estimatedDays > 0 && (
                                        <>
                                            <br />
                                            Dự kiến sử dụng: <span className="font-bold">{estimatedDays}</span> ngày
                                            {estimatedDays <= leaveBalance ? (
                                                <span className="text-green-700 dark:text-green-400 ml-2">✓</span>
                                            ) : (
                                                <span className="text-red-700 dark:text-red-400 ml-2">✗ Vượt quá</span>
                                            )}
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* DÒNG 1: LOẠI NGHỈ PHÉP */}
                    <div>
                        <Label htmlFor="type" className="font-semibold">Loại nghỉ phép *</Label>
                        <Select value={leaveType} onValueChange={handleLeaveTypeChange}>
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Chọn loại nghỉ phép" />
                            </SelectTrigger>

                            <SelectContent>
                                {/* ĐÃ SỬA LỖI KEY/VALUE TRÙNG LẶP */}
                                <SelectItem value="annual">Nghỉ phép năm (Annual)</SelectItem>
                                <SelectItem value="sick">Nghỉ ốm (Sick)</SelectItem>
                                <SelectItem value="personal">Nghỉ cá nhân (Personal)</SelectItem>
                                <SelectItem value="unpaid">Nghỉ không lương (Unpaid)</SelectItem>
                                {/* Các trường mở rộng khác không được thêm vào ENUM gốc: nên dùng trường Reason */}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* DÒNG 2: THỜI GIAN NGHỈ */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="start">Ngày bắt đầu *</Label>
                            <Input
                                id="start"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                required
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="end">Ngày kết thúc *</Label>
                            <Input
                                id="end"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                required
                                className="mt-1"
                            />
                        </div>
                    </div>
                    
                    {/* DÒNG 3: NGÀY CÔNG ÁP DỤNG */}
                    <div>
                        <Label htmlFor="work_hours_type" className="font-semibold flex items-center gap-2">
                            <Clock className="h-4 w-4" /> Ngày công áp dụng *
                        </Label>
                        <Select value={workHourType} onValueChange={handleWorkHourTypeChange}>
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Chọn số ngày công nghỉ" />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="FULL">Nghỉ cả ngày (Full day)</SelectItem>
                                <SelectItem value="HALF_AM">Nghỉ nửa ngày (Sáng)</SelectItem>
                                <SelectItem value="HALF_PM">Nghỉ nửa ngày (Chiều)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    
                    {/* DÒNG 4: LÝ DO */}
                    <div>
                        <Label htmlFor="reason">Lý do nghỉ phép *</Label>
                        <Textarea
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={4}
                            placeholder="Vui lòng nhập lý do nghỉ phép chi tiết"
                            required
                            className="mt-1"
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                            {loading ? "Đang gửi..." : "Gửi Yêu cầu"}
                        </Button>
                    </div>

                </form>
            </CardContent>
        </Card>
    );
};

export default LeaveRequestForm;
