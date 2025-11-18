import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { TablesInsert, Enums } from "@/integrations/supabase/types"; 

// Định nghĩa các kiểu cụ thể từ Supabase types
type LeaveType = Enums<'leave_type'>;
type LeaveInsert = TablesInsert<'leave_requests'>;

const LeaveRequestForm = () => {
 // Sử dụng kiểu LeaveType đã được định nghĩa
 const [type, setType] = useState<LeaveType>("annual"); 
 const [startDate, setStartDate] = useState("");
 const [endDate, setEndDate] = useState("");
 const [reason, setReason] = useState("");
 const [loading, setLoading] = useState(false);
 const { toast } = useToast();

  // 👇 KHẮC PHỤC LỖI: Tạo handler để ép kiểu giá trị từ Select (string) sang LeaveType
  const handleTypeChange = (value: string) => {
    // Ép kiểu (type assertion) là an toàn vì chúng ta kiểm soát các <SelectItem>
    setType(value as LeaveType);
  };
    
 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
   const user = await getCurrentUser();
   if (!user) throw new Error("Not authenticated");

      // Tạo đối tượng chèn với kiểu LeaveInsert đã được gán
      const newLeaveRequest: LeaveInsert = {
        user_id: user.id,
        type: type, 
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
        status: 'pending' 
      };
      
   const { error } = await supabase.from('leave_requests').insert([newLeaveRequest]);

   if (error) throw error;

   toast({
    title: "Success",
    description: "Leave request submitted successfully"
   });

   resetForm();
  } catch (error) {
   console.error('Error submitting leave request:', error);
   toast({
    title: "Error",
    description: "Failed to submit leave request",
    variant: "destructive"
   });
  } finally {
   setLoading(false);
  }
 };

 const resetForm = () => {
  setType("annual");
  setStartDate("");
  setEndDate("");
  setReason("");
 };

 return (
  <Card>
   <CardHeader>
    <CardTitle>Submit Leave Request</CardTitle>
   </CardHeader>
   <CardContent>
    <form onSubmit={handleSubmit} className="space-y-4">
     <div>
      <Label htmlFor="type">Leave Type *</Label>
      {/* 👇 Sử dụng handler mới thay vì trực tiếp setType */}
      <Select value={type} onValueChange={handleTypeChange}> 
       <SelectTrigger>
        <SelectValue placeholder="Select a leave type" />
       </SelectTrigger>
       <SelectContent>
        <SelectItem value="annual">Annual Leave</SelectItem>
        <SelectItem value="sick">Sick Leave</SelectItem>
        <SelectItem value="personal">Personal Leave</SelectItem>
        <SelectItem value="unpaid">Unpaid Leave</SelectItem>
       </SelectContent>
      </Select>
     </div>

     <div className="grid grid-cols-2 gap-4">
      <div>
       <Label htmlFor="start">Start Date *</Label>
       <Input
        id="start"
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        required
       />
      </div>

      <div>
       <Label htmlFor="end">End Date *</Label>
       <Input
        id="end"
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        required
       />
      </div>
     </div>

     <div>
      <Label htmlFor="reason">Reason</Label>
      <Textarea
       id="reason"
       value={reason}
       onChange={(e) => setReason(e.target.value)}
       rows={3}
       placeholder="Optional: Provide reason for leave"
      />
      
     </div>

     <div className="flex justify-end">
      <Button type="submit" disabled={loading}>
       {loading ? "Submitting..." : "Submit Request"}
      </Button>
     </div>
    </form>
   </CardContent>
  </Card>
 );
};

export default LeaveRequestForm;