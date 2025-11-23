import { useState } from 'react';
import { useBoard, Field, Task } from '@/hooks/use-board';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash2, Edit2, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface KanbanBoardProps {
  teamId: string;
  userId: string;
  users: Array<{ id: string; first_name?: string; last_name?: string; avatar_url?: string | null }>;
}

const COLORS = ['blue', 'red', 'yellow', 'green', 'purple', 'pink', 'gray', 'orange', 'cyan'];

const colorBgClasses = {
  blue: 'bg-blue-50 border-t-4 border-blue-400',
  red: 'bg-red-50 border-t-4 border-red-400',
  yellow: 'bg-yellow-50 border-t-4 border-yellow-400',
  green: 'bg-green-50 border-t-4 border-green-400',
  purple: 'bg-purple-50 border-t-4 border-purple-400',
  pink: 'bg-pink-50 border-t-4 border-pink-400',
  gray: 'bg-gray-50 border-t-4 border-gray-400',
  orange: 'bg-orange-50 border-t-4 border-orange-400',
  cyan: 'bg-cyan-50 border-t-4 border-cyan-400',
};

const colorBadgeClasses = {
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

const priorityColors = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700'
};

export const KanbanBoard = ({ teamId, userId, users }: KanbanBoardProps) => {
  const { toast } = useToast();
  const {
    tasks,
    fields,
    loading,
    createField,
    updateField,
    deleteField,
    createTask,
    updateTask,
    deleteTask,
    getTasksInField
  } = useBoard(teamId);

  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [columnName, setColumnName] = useState('');
  const [columnColor, setColumnColor] = useState('blue');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!columnName.trim()) {
      toast({
        title: 'Error',
        description: 'Column name is required',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      await createField(columnName, columnColor);
      setColumnName('');
      setColumnColor('blue');
      setIsAddColumnOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-24 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const sortedFields = fields.sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Board</h2>
        <Dialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Column
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Column</DialogTitle>
              <DialogDescription>Add a new column to your board</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateColumn} className="space-y-4">
              <div>
                <Label htmlFor="column-name">Column Name</Label>
                <Input
                  id="column-name"
                  value={columnName}
                  onChange={(e) => setColumnName(e.target.value)}
                  placeholder="e.g., To Do, Doing, Review, Done"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="column-color">Color</Label>
                <Select value={columnColor} onValueChange={setColumnColor}>
                  <SelectTrigger id="column-color">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLORS.map(color => (
                      <SelectItem key={color} value={color}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${colorBadgeClasses[color as keyof typeof colorBadgeClasses]}`} />
                          {color.charAt(0).toUpperCase() + color.slice(1)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsAddColumnOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Create Column
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {sortedFields.length === 0 ? (
        <Card className="bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No columns yet. Create one to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-max">
          {sortedFields.map(field => (
            <KanbanColumn
              key={field.id}
              field={field}
              tasks={getTasksInField(field.id)}
              userId={userId}
              users={users}
              onCreateTask={createTask}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
              onDeleteField={deleteField}
              onUpdateField={updateField}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface KanbanColumnProps {
  field: Field;
  tasks: Task[];
  userId: string;
  users: Array<{ id: string; first_name?: string; last_name?: string; avatar_url?: string | null }>;
  onCreateTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>) => Promise<void>;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onDeleteField: (fieldId: string) => Promise<void>;
  onUpdateField: (fieldId: string, updates: Partial<Field>) => Promise<void>;
}

const KanbanColumn = ({
  field,
  tasks,
  userId,
  users,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onDeleteField,
  onUpdateField
}: KanbanColumnProps) => {
  const { toast } = useToast();
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isLoading, setIsLoading] = useState(false);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      toast({
        title: 'Error',
        description: 'Task title is required',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      await onCreateTask({
        title: taskTitle,
        description: null,
        priority: taskPriority,
        deadline: null,
        assignee_id: null,
        creator_id: userId,
        team_id: field.team_id,
        field_id: field.id
      });
      setTaskTitle('');
      setTaskPriority('medium');
      setIsAddTaskOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={`${colorBgClasses[field.color as keyof typeof colorBgClasses]} h-fit`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            {field.name}
            <Badge variant="secondary" className="ml-2 text-xs">
              {tasks.length}
            </Badge>
          </CardTitle>
          <ColumnMenu field={field} onDelete={onDeleteField} onUpdate={onUpdateField} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            users={users}
            onUpdate={onUpdateTask}
            onDelete={onDeleteTask}
          />
        ))}

        {tasks.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-xs">
            No tasks
          </div>
        )}

        <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="h-3 w-3 mr-1" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Task to {field.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <Label htmlFor="task-title">Task Title</Label>
                <Input
                  id="task-title"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="task-priority">Priority</Label>
                <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as any)}>
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
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsAddTaskOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Add
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

interface TaskCardProps {
  task: Task;
  users: Array<{ id: string; first_name?: string; last_name?: string; avatar_url?: string | null }>;
  onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

const TaskCard = ({ task, users, onUpdate, onDelete }: TaskCardProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState(task);
  const [isLoading, setIsLoading] = useState(false);

  const assignee = users.find(u => u.id === task.assignee_id);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onUpdate(task.id, formData);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return;
    setIsLoading(true);
    try {
      await onDelete(task.id);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card className="bg-white border-l-4 hover:shadow-md cursor-pointer transition-all" onClick={() => setIsOpen(true)}>
        <CardContent className="p-3 space-y-2">
          <h4 className="text-sm font-medium line-clamp-2">{task.title}</h4>
          <div className="flex flex-wrap gap-1">
            <Badge className={`text-xs ${priorityColors[task.priority]}`} variant="secondary">
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </Badge>
          </div>
          {task.deadline && (
            <p className="text-xs text-muted-foreground">
              {format(new Date(task.deadline), 'MMM dd')}
            </p>
          )}
          {assignee && (
            <p className="text-xs text-muted-foreground">
              👤 {assignee.first_name} {assignee.last_name}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="edit-priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v as any })}>
                <SelectTrigger id="edit-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-assignee">Assignee</Label>
              <Select value={formData.assignee_id || ''} onValueChange={(v) => setFormData({ ...formData, assignee_id: v || null })}>
                <SelectTrigger id="edit-assignee">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-deadline">Deadline</Label>
              <Input
                id="edit-deadline"
                type="date"
                value={formData.deadline ? formData.deadline.split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value || null })}
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-2 justify-between">
              <Button variant="destructive" onClick={handleDelete} disabled={isLoading} size="sm">
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface ColumnMenuProps {
  field: Field;
  onDelete: (fieldId: string) => Promise<void>;
  onUpdate: (fieldId: string, updates: Partial<Field>) => Promise<void>;
}

const ColumnMenu = ({ field, onDelete, onUpdate }: ColumnMenuProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(field.name);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdate = async () => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Column name is required',
        variant: 'destructive'
      });
      return;
    }
    setIsLoading(true);
    try {
      await onUpdate(field.id, { name });
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete column "${field.name}"? Tasks won't be deleted.`)) return;
    setIsLoading(true);
    try {
      await onDelete(field.id);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Column</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="col-name">Column Name</Label>
            <Input
              id="col-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="flex gap-2 justify-between">
            <Button variant="destructive" onClick={handleDelete} disabled={isLoading} size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
