import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, AlertCircle } from "lucide-react";
import { UserRole } from "@/lib/auth";
import { format } from "date-fns";

interface TaskCardProps {
  task: any;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onTaskClick: (task: any) => void;
  role: UserRole;
}

const priorityColors = {
  low: 'bg-blue-500/10 text-blue-500',
  medium: 'bg-yellow-500/10 text-yellow-500',
  high: 'bg-orange-500/10 text-orange-500',
  urgent: 'bg-red-500/10 text-red-500'
};

const TaskCard = ({ task, onStatusChange, onTaskClick, role }: TaskCardProps) => {
  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  return (
    <Card 
      className="p-4 shadow-medium hover:shadow-strong transition-smooth cursor-pointer group border-l-4 border-l-primary/20 hover:border-l-primary"
      onClick={() => onTaskClick(task)}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-smooth">{task.title}</h4>
          <Badge className={`${priorityColors[task.priority as keyof typeof priorityColors]} font-medium`}>
            {task.priority}
          </Badge>
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        {task.deadline && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md w-fit">
            <Calendar className="h-3 w-3" />
            {format(new Date(task.deadline), 'MMM dd')}
          </div>
        )}
      </div>
    </Card>
  );
};

export default TaskCard;
