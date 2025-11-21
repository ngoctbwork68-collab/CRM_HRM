import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, differenceInDays, parseISO } from "date-fns";
import { vi } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string | null;
  start_date: string | null;
  duration_days: number | null;
  progress_percentage: number;
  assignee?: { first_name: string; last_name: string };
}

interface TaskGanttChartProps {
  tasks: Task[];
  onTaskReschedule: (taskId: string, startDate: string | null, deadline: string | null) => void;
}

const TaskGanttChart = ({ tasks, onTaskReschedule }: TaskGanttChartProps) => {
  const [startViewDate, setStartViewDate] = useState(new Date());
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const chartDays = 30;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-500';
      case 'review': return 'bg-purple-500';
      case 'in_progress': return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };

  const getPriorityBorder = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-4 border-red-500';
      case 'high': return 'border-l-4 border-orange-500';
      case 'medium': return 'border-l-4 border-yellow-500';
      default: return 'border-l-4 border-blue-500';
    }
  };

  const getTaskPosition = (task: Task) => {
    const taskStart = task.start_date ? parseISO(task.start_date) : new Date();
    const taskEnd = task.deadline ? parseISO(task.deadline) : taskStart;
    const daysFromStart = differenceInDays(taskStart, startViewDate);
    const duration = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);

    return {
      left: Math.max(0, Math.min(daysFromStart, chartDays - 1)),
      width: Math.min(chartDays - Math.max(0, daysFromStart), duration),
    };
  };

  const handleTaskDragStart = (e: React.DragEvent<HTMLDivElement>, task: Task) => {
    setDraggedTaskId(task.id);
    const rect = (e.currentTarget).getBoundingClientRect();
    setDragOffset(e.clientX - rect.left);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTaskDragEnd = () => {
    setDraggedTaskId(null);
    setDragOffset(0);
  };

  const handleDayDrop = (e: React.DragEvent<HTMLDivElement>, dayIndex: number) => {
    e.preventDefault();

    if (!draggedTaskId) return;

    const task = tasks.find(t => t.id === draggedTaskId);
    if (!task) return;

    const newDate = addDays(startViewDate, dayIndex);
    const currentStart = task.start_date ? parseISO(task.start_date) : new Date();
    const currentEnd = task.deadline ? parseISO(task.deadline) : currentStart;
    const duration = differenceInDays(currentEnd, currentStart);

    const newStartDate = format(newDate, 'yyyy-MM-dd');
    const newEndDate = format(addDays(newDate, duration), 'yyyy-MM-dd');

    onTaskReschedule(draggedTaskId, newStartDate, newEndDate);
    handleTaskDragEnd();
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const aDate = a.deadline || a.start_date;
    const bDate = b.deadline || b.start_date;
    if (!aDate || !bDate) return 0;
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          Từ {format(startViewDate, 'dd MMM', { locale: vi })} - {format(addDays(startViewDate, chartDays - 1), 'dd MMM yyyy', { locale: vi })}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setStartViewDate(subDays(startViewDate, 7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStartViewDate(new Date())}
          >
            Hôm nay
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setStartViewDate(addDays(startViewDate, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="border rounded-lg overflow-x-auto bg-background">
        <div className="min-w-max">
          {/* Date Header */}
          <div className="flex bg-muted/50 border-b sticky top-0">
            <div className="w-64 p-3 border-r font-semibold text-sm flex-shrink-0">
              Công Việc
            </div>
            <div className="flex">
              {Array.from({ length: chartDays }).map((_, i) => {
                const date = addDays(startViewDate, i);
                return (
                  <div
                    key={i}
                    className="w-12 p-1 text-center border-r text-xs flex flex-col items-center justify-center min-h-16 flex-shrink-0"
                  >
                    <div className="font-semibold">{format(date, 'd')}</div>
                    <div className="text-muted-foreground">{format(date, 'EEE', { locale: vi }).substring(0, 3)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tasks */}
          {sortedTasks.map((task) => {
            const position = getTaskPosition(task);
            const taskName = task.title.length > 30 ? task.title.substring(0, 27) + '...' : task.title;

            return (
              <div key={task.id} className="flex border-b hover:bg-muted/30 transition-colors">
                <div className={`w-64 p-3 border-r text-sm flex-shrink-0 ${getPriorityBorder(task.priority)}`}>
                  <div className="font-medium truncate" title={task.title}>
                    {taskName}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {task.progress_percentage}% hoàn thành
                  </div>
                  <Badge variant="outline" className="text-xs mt-2">
                    {task.status}
                  </Badge>
                </div>

                <div className="flex relative h-16 flex-1">
                  {Array.from({ length: chartDays }).map((_, i) => (
                    <div
                      key={i}
                      className="w-12 border-r flex-shrink-0 hover:bg-blue-50 transition-colors cursor-move"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDayDrop(e, i)}
                    />
                  ))}

                  {/* Task Bar */}
                  {position.width > 0 && (
                    <div
                      className={`absolute top-2 h-12 rounded cursor-move hover:opacity-80 transition-opacity flex items-center px-2 ${getStatusColor(task.status)} text-white text-xs font-medium overflow-hidden whitespace-nowrap ${draggedTaskId === task.id ? 'opacity-50' : ''}`}
                      style={{
                        left: `calc(16rem + ${position.left * 48}px)`,
                        width: `${position.width * 48}px`,
                      }}
                      title={`${task.title} - ${task.progress_percentage}% done`}
                      draggable
                      onDragStart={(e) => handleTaskDragStart(e, task)}
                      onDragEnd={handleTaskDragEnd}
                    >
                      <div className="truncate">{task.title}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {sortedTasks.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              Không có công việc nào để hiển thị
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span>Hoàn thành</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500" />
              <span>Đang làm</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-500" />
              <span>Chờ duyệt</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-400" />
              <span>Chưa bắt đầu</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskGanttChart;
