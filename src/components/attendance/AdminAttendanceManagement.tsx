import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Edit2, Trash2, Plus, Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import EditAttendanceDialog from "./EditAttendanceDialog";

interface DailyRecord {
  id: string;
  user_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total_hours: number;
  session_count: number;
  status: 'pending' | 'present' | 'absent' | 'late' | 'leave';
  notes: string | null;
  created_at: string;
}

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  team_id: string | null;
}

interface Team {
  id: string;
  name: string;
}

interface ViewRecord extends DailyRecord {
  user_name: string;
  user_email: string;
  team_name: string | null;
}

const AdminAttendanceManagement = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [records, setRecords] = useState<ViewRecord[]>([]);
  const [users, setUsers] = useState<Map<string, UserProfile>>(new Map());
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterTeam, setFilterTeam] = useState<string>("");
  const [filterUser, setFilterUser] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [selectedRecord, setSelectedRecord] = useState<ViewRecord | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<ViewRecord | null>(null);
  const [teamList, setTeamList] = useState<Team[]>([]);
  const [userList, setUserList] = useState<UserProfile[]>([]);

  const loadTeams = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('teams').select('id, name');
      if (error) throw error;
      const teamMap = new Map(data?.map(t => [t.id, t]) ?? []);
      setTeams(teamMap);
      setTeamList(data || []);
    } catch (error) {
      try {
        console.error('Error loading teams:', error instanceof Error ? error.message : 'Unknown error');
      } catch (e) {
        console.error('Error loading teams: Unknown error');
      }
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, team_id');
      if (error) throw error;
      const userMap = new Map(data?.map(u => [u.id, u]) ?? []);
      setUsers(userMap);
      setUserList(data || []);
    } catch (error) {
      try {
        console.error('Error loading users:', error instanceof Error ? error.message : 'Unknown error');
      } catch (e) {
        console.error('Error loading users: Unknown error');
      }
    }
  }, []);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('daily_attendance').select('*');

      if (filterDate) {
        query = query.eq('attendance_date', filterDate);
      }
      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query.order('attendance_date', { ascending: false });
      if (error) throw error;

      // Join with user and team data
      const enrichedRecords: ViewRecord[] = (data || [])
        .map(record => {
          const user = users.get(record.user_id);
          const team = user?.team_id ? teams.get(user.team_id) : null;

          return {
            ...record,
            user_name: user ? `${user.last_name || ''} ${user.first_name || ''}`.trim() : 'Unknown',
            user_email: user?.email || 'N/A',
            team_name: team?.name || null
          };
        })
        .filter(record => {
          // Filter by team
          if (filterTeam && !record.team_name?.includes(filterTeam)) return false;
          // Filter by user
          if (filterUser && record.user_id !== filterUser) return false;
          // Filter by search text
          if (searchText && !record.user_name.toLowerCase().includes(searchText.toLowerCase()) && 
              !record.user_email.toLowerCase().includes(searchText.toLowerCase())) return false;
          return true;
        });

      setRecords(enrichedRecords);
    } catch (error) {
      try {
        console.error('Error loading records:', error instanceof Error ? error.message : 'Unknown error');
      } catch (e) {
        console.error('Error loading records: Unknown error');
      }
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tải dữ liệu chấm công"
      });
    } finally {
      setIsLoading(false);
    }
  }, [filterDate, filterStatus, filterTeam, filterUser, searchText, users, teams, toast]);

  useEffect(() => {
    loadTeams();
    loadUsers();
  }, [loadTeams, loadUsers]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleDelete = async () => {
    if (!recordToDelete) return;

    try {
      const { error } = await supabase
        .from('daily_attendance')
        .delete()
        .eq('id', recordToDelete.id);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Đã xóa bản ghi chấm công"
      });

      setRecordToDelete(null);
      await loadRecords();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể xóa bản ghi"
      });
    }
  };

  const handleExportCSV = () => {
    if (records.length === 0) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không có dữ li��u để xuất"
      });
      return;
    }

    const isValidDate = (dateString: string | null): boolean => {
      if (!dateString) return false;
      const date = new Date(dateString);
      return date instanceof Date && !isNaN(date.getTime());
    };

    const headers = ['Ngày', 'Nhân viên', 'Email', 'Phòng ban', 'Giờ vào', 'Giờ ra', 'Tổng giờ', 'Trạng thái'];
    const rows = records.map(r => [
      isValidDate(r.attendance_date) ? format(new Date(r.attendance_date), 'dd/MM/yyyy') : 'N/A',
      r.user_name,
      r.user_email,
      r.team_name || 'N/A',
      r.check_in_time && isValidDate(r.check_in_time) ? format(new Date(r.check_in_time), 'HH:mm') : '',
      r.check_out_time && isValidDate(r.check_out_time) ? format(new Date(r.check_out_time), 'HH:mm') : '',
      r.total_hours.toFixed(2),
      r.status
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();

    toast({
      title: "Thành công",
      description: `Đã xuất ${records.length} bản ghi`
    });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-700';
      case 'absent':
        return 'bg-red-100 text-red-700';
      case 'leave':
        return 'bg-blue-100 text-blue-700';
      case 'late':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'present':
        return 'Có công';
      case 'absent':
        return 'Vắng';
      case 'leave':
        return 'Nghỉ phép';
      case 'late':
        return 'Đi trễ';
      default:
        return 'Chờ xử lý';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Tìm kiếm và lọc
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">T��m tên/email</label>
              <Input
                placeholder="Nhập tên hoặc email..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            {/* Date Filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ngày</label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>

            {/* Team Filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Phòng ban</label>
              <Select value={filterTeam || ""} onValueChange={setFilterTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  {teamList.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Trạng thái</label>
              <Select value={filterStatus || ""} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Có công</SelectItem>
                  <SelectItem value="absent">Vắng</SelectItem>
                  <SelectItem value="leave">Nghỉ phép</SelectItem>
                  <SelectItem value="late">Đi trễ</SelectItem>
                  <SelectItem value="pending">Chờ xử lý</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Export Button */}
            <div className="flex items-end">
              <Button
                className="w-full"
                variant="outline"
                onClick={handleExportCSV}
                disabled={records.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Xuất CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bản ghi chấm công ({records.length})</CardTitle>
          <CardDescription>Quản lý, chỉnh sửa hoặc xóa bản ghi chấm công</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Không có bản ghi nào</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-semibold">Ngày</th>
                    <th className="text-left p-2 font-semibold">Nhân viên</th>
                    <th className="text-left p-2 font-semibold">Phòng ban</th>
                    <th className="text-left p-2 font-semibold">Vào</th>
                    <th className="text-left p-2 font-semibold">Ra</th>
                    <th className="text-center p-2 font-semibold">Tổng giờ</th>
                    <th className="text-left p-2 font-semibold">Trạng thái</th>
                    <th className="text-center p-2 font-semibold">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => {
                    const isValidDate = (dateString: string | null): boolean => {
                      if (!dateString) return false;
                      const date = new Date(dateString);
                      return date instanceof Date && !isNaN(date.getTime());
                    };

                    const formatDate = (dateString: string | null, formatStr: string, opts?: any) => {
                      if (!isValidDate(dateString)) return '---';
                      try {
                        return format(new Date(dateString), formatStr, opts);
                      } catch {
                        return '---';
                      }
                    };

                    return (
                    <tr key={record.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        {formatDate(record.attendance_date, 'dd/MM/yyyy', { locale: vi })}
                      </td>
                      <td className="p-2">
                        <div>
                          <p className="font-medium">{record.user_name}</p>
                          <p className="text-xs text-muted-foreground">{record.user_email}</p>
                        </div>
                      </td>
                      <td className="p-2 text-sm">{record.team_name || 'N/A'}</td>
                      <td className="p-2">
                        {formatDate(record.check_in_time, 'HH:mm')}
                      </td>
                      <td className="p-2">
                        {formatDate(record.check_out_time, 'HH:mm')}
                      </td>
                      <td className="p-2 text-center font-bold text-green-600">
                        {record.total_hours.toFixed(2)}h
                      </td>
                      <td className="p-2">
                        <Badge className={`${statusColor(record.status)} border-0`}>
                          {statusLabel(record.status)}
                        </Badge>
                      </td>
                      <td className="p-2 text-center flex justify-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedRecord(record);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRecordToDelete(record)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {selectedRecord && (
        <EditAttendanceDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          record={selectedRecord}
          onSave={async () => {
            await loadRecords();
            setIsEditDialogOpen(false);
            setSelectedRecord(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!recordToDelete} onOpenChange={() => setRecordToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Xóa bản ghi chấm công?</AlertDialogTitle>
          <AlertDialogDescription>
            {(() => {
              const isValidDate = (dateString: string | null): boolean => {
                if (!dateString) return false;
                const date = new Date(dateString);
                return date instanceof Date && !isNaN(date.getTime());
              };
              const dateStr = recordToDelete?.attendance_date && isValidDate(recordToDelete.attendance_date)
                ? format(new Date(recordToDelete.attendance_date), 'dd/MM/yyyy')
                : 'chưa xác định';
              return `Hành động này không thể hoàn tác. Bản ghi chấm công của ${recordToDelete?.user_name} ngày ${dateStr} sẽ bị xóa vĩnh viễn.`;
            })()}
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Xóa
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminAttendanceManagement;
