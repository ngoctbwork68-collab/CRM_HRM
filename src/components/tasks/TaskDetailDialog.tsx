import { useState, useEffect } from 'react';
import { Task, Field, TaskStatus } from '@/hooks/use-task-board';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trash2, Loader2, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  statuses: TaskStatus[];
  fields: Field[];
  users: Array<{ id: string; first_name?: string; last_name?: string; avatar_url?: string | null }>;
  onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
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

export const TaskDetailDialog = ({
  open,
  onOpenChange,
  task,
  statuses,
  fields,
  users,
  onUpdate,
  onDelete
}: TaskDetailDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Task>>({});

  useEffect(() => {
    if (task) {
      setFormData(task);
    }
  }, [task]);

  if (!task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onUpdate(task.id, formData);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    setIsLoading(true);
    try {
      await onDelete(task.id);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const currentField = fields.find(f => f.id === formData.field_id);
  const currentStatus = statuses.find(s => s.name === formData.status);
  const currentAssignee = users.find(u => u.id === formData.assignee_id);

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${(firstName?.[0] || '').toUpperCase()}${(lastName?.[0] || '').toUpperCase()}` || '?';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Task Details</DialogTitle>
          <DialogDescription>Edit task information and properties</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Task title"
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Task description"
              rows={4}
              disabled={isLoading}
            />
          </div>

          {/* Status, Priority, Field Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="task-status">Status</Label>
              <Select
                value={formData.status || ''}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                disabled={isLoading}
              >
                <SelectTrigger id="task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map(status => (
                    <SelectItem key={status.id} value={status.name}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentStatus && (
                <Badge className="mt-2" variant="secondary">{currentStatus.label}</Badge>
              )}
            </div>

            <div>
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                value={formData.priority || 'medium'}
                onValueChange={(value) => setFormData({ ...formData, priority: value as any })}
                disabled={isLoading}
              >
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              {formData.priority && (
                <Badge className={`mt-2 ${priorityColors[formData.priority]}`} variant="secondary">
                  {formData.priority.charAt(0).toUpperCase() + formData.priority.slice(1)}
                </Badge>
              )}
            </div>

            <div>
              <Label htmlFor="task-field">Field (Epic)</Label>
              <Select
                value={formData.field_id || ''}
                onValueChange={(value) => setFormData({ ...formData, field_id: value || null })}
                disabled={isLoading}
              >
                <SelectTrigger id="task-field">
                  <SelectValue placeholder="No field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No field</SelectItem>
                  {fields.map(field => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentField && (
                <Badge
                  className={`mt-2 ${fieldColorClasses[currentField.color as keyof typeof fieldColorClasses]}`}
                  variant="secondary"
                >
                  {currentField.name}
                </Badge>
              )}
            </div>
          </div>

          {/* Deadline and Assignee */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="task-deadline" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Deadline
              </Label>
              <Input
                id="task-deadline"
                type="date"
                value={formData.deadline ? formData.deadline.split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value || null })}
                disabled={isLoading}
              />
              {formData.deadline && (
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(formData.deadline), 'PPP')}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="task-assignee">Assignee</Label>
              <Select
                value={formData.assignee_id || ''}
                onValueChange={(value) => setFormData({ ...formData, assignee_id: value || null })}
                disabled={isLoading}
              >
                <SelectTrigger id="task-assignee">
                  <SelectValue placeholder="No assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No assignee</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={user.avatar_url || ''} />
                          <AvatarFallback className="text-xs">
                            {getInitials(user.first_name, user.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        {user.first_name} {user.last_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentAssignee && (
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={currentAssignee.avatar_url || ''} />
                    <AvatarFallback className="text-xs">
                      {getInitials(currentAssignee.first_name, currentAssignee.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs">{currentAssignee.first_name} {currentAssignee.last_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t space-y-2 text-xs text-muted-foreground">
            <p>Created: {format(new Date(task.created_at), 'PPpp')}</p>
            <p>Updated: {format(new Date(task.updated_at), 'PPpp')}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-between">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
