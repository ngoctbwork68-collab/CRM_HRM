import { Task, Field } from '@/hooks/use-task-board';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, AlertCircle } from 'lucide-react';
import { format, isPast, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { vi } from 'date-fns/locale';

interface EnhancedTaskCardProps {
  task: Task;
  field?: Field;
  creator?: { first_name?: string; last_name?: string; avatar_url?: string | null };
  assignee?: { first_name?: string; last_name?: string; avatar_url?: string | null };
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
}

const priorityColors = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700'
};

const fieldColorClasses = {
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  green: 'bg-green-100 text-green-700',
  purple: 'bg-purple-100 text-purple-700',
  pink: 'bg-pink-100 text-pink-700',
  gray: 'bg-gray-100 text-gray-700',
  orange: 'bg-orange-100 text-orange-700',
  cyan: 'bg-cyan-100 text-cyan-700',
};

const getDeadlineColor = (deadline: string) => {
  const date = new Date(deadline);
  if (isPast(date) && !isToday(date)) return 'text-red-600';
  if (isToday(date)) return 'text-red-500';
  if (isTomorrow(date)) return 'text-orange-500';
  if (isThisWeek(date)) return 'text-yellow-500';
  return 'text-muted-foreground';
};

const getDeadlineLabel = (deadline: string) => {
  const date = new Date(deadline);
  if (isPast(date) && !isToday(date)) return 'Quá hạn';
  if (isToday(date)) return 'Hôm nay';
  if (isTomorrow(date)) return 'Ngày mai';
  if (isThisWeek(date)) return format(date, 'EEEE', { locale: vi });
  return format(date, 'dd/MM', { locale: vi });
};

export const EnhancedTaskCard = ({
  task,
  field,
  creator,
  assignee,
  onTaskClick,
  onStatusChange
}: EnhancedTaskCardProps) => {
  const getInitials = (firstName?: string, lastName?: string) => {
    return `${(firstName?.[0] || '').toUpperCase()}${(lastName?.[0] || '').toUpperCase()}` || '?';
  };

  return (
    <Card
      className="bg-white border-l-4 hover:shadow-md transition-all cursor-pointer group"
      style={{
        borderLeftColor: field ? 
          (fieldColorClasses[field.color as keyof typeof fieldColorClasses] ? 
            getCSSColor(field.color) : '#e5e7eb') 
          : '#e5e7eb'
      }}
      onClick={() => onTaskClick(task)}
    >
      <div className="p-3 space-y-2">
        {/* Title */}
        <h4 className="text-sm font-medium line-clamp-2 text-foreground">{task.title}</h4>

        {/* Field Badge and Priority */}
        <div className="flex flex-wrap gap-1">
          {field && (
            <Badge
              className={`text-xs ${fieldColorClasses[field.color as keyof typeof fieldColorClasses]}`}
              variant="secondary"
            >
              {field.name}
            </Badge>
          )}
          <Badge
            className={`text-xs ${priorityColors[task.priority]}`}
            variant="secondary"
          >
            {getPriorityLabel(task.priority)}
          </Badge>
        </div>

        {/* Deadline */}
        {task.deadline && (
          <div className={`flex items-center gap-1 text-xs ${getDeadlineColor(task.deadline)}`}>
            {isPast(new Date(task.deadline)) && !isToday(task.deadline) ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            {getDeadlineLabel(task.deadline)}
          </div>
        )}

        {/* Description Preview */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
        )}

        {/* Avatar */}
        {(creator || assignee) && (
          <div className="flex gap-2">
            {assignee && (
              <Avatar className="h-5 w-5">
                <AvatarImage src={assignee.avatar_url || ''} />
                <AvatarFallback className="text-xs">
                  {getInitials(assignee.first_name, assignee.last_name)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

const getPriorityLabel = (priority: string) => {
  const labels: Record<string, string> = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    urgent: 'Gấp'
  };
  return labels[priority] || priority;
};

const getCSSColor = (color: string) => {
  const colors: Record<string, string> = {
    blue: '#3b82f6',
    red: '#ef4444',
    yellow: '#eab308',
    green: '#22c55e',
    purple: '#a855f7',
    pink: '#ec4899',
    gray: '#6b7280',
    orange: '#f97316',
    cyan: '#06b6d4'
  };
  return colors[color] || '#e5e7eb';
};
