import { useState, useMemo, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Filter, X, Loader2 } from 'lucide-react';
import { useTaskBoard, Task, Field, TaskStatus } from '@/hooks/use-task-board';
import { EnhancedTaskCard } from './EnhancedTaskCard';
import { FieldManager } from './FieldManager';
import { TaskDetailDialog } from './TaskDetailDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

interface EnhancedTaskBoardProps {
  teamId: string;
  userId: string;
  creatorData?: Record<string, any>;
  assigneeData?: Record<string, any>;
}

const statusColorClasses = {
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

export const EnhancedTaskBoard = ({
  teamId,
  userId,
  creatorData = {},
  assigneeData = {}
}: EnhancedTaskBoardProps) => {
  const { toast } = useToast();
  const {
    tasks,
    fields,
    statuses,
    loading,
    filters,
    setFilters,
    createField,
    updateField,
    deleteField,
    createTask,
    updateTask,
    deleteTask,
    getFilteredTasks
  } = useTaskBoard(teamId);

  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('board');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; first_name?: string; last_name?: string; avatar_url?: string | null }>>([]);

  // Load all users
  useEffect(() => {
    const loadUsers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url');
      if (data) setUsers(data);
    };
    loadUsers();
  }, []);

  // Set first status on load
  useMemo(() => {
    if (statuses.length > 0 && !selectedStatus) {
      setSelectedStatus(statuses[0].name);
    }
  }, [statuses, selectedStatus]);

  const handleCreateTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>) => {
    await createTask(taskData);
    setIsCreateTaskOpen(false);
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    await updateTask(taskId, { status: newStatus });
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    await updateTask(taskId, updates);
  };

  const sortedStatuses = statuses.sort((a, b) => a.position - b.position);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-32 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Board and Fields Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-secondary">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="fields">Fields</TabsTrigger>
        </TabsList>

        {/* Board Tab */}
        <TabsContent value="board" className="mt-6 space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-1">
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              <Button
                onClick={() => setIsCreateTaskOpen(true)}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Field</Label>
                    <Select
                      value={filters.fieldId || ''}
                      onValueChange={(value) => setFilters({ ...filters, fieldId: value || undefined })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Fields" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Fields</SelectItem>
                        {fields.map(field => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Priority</Label>
                    <Select
                      value={filters.priority || ''}
                      onValueChange={(value) => setFilters({ ...filters, priority: value || undefined })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Priorities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Priorities</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {Object.keys(filters).length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilters({})}
                      className="col-span-full"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Filters
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-max">
            {sortedStatuses.map((status) => {
              const statusTasks = tasks.filter(t => t.status === status.name);
              const filteredTasks = filterTasks(statusTasks, filters);

              return (
                <Card
                  key={status.id}
                  className={`${statusColorClasses[status.color as keyof typeof statusColorClasses]} h-fit`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">
                        {status.label}
                        <Badge variant="secondary" className="ml-2">
                          {filteredTasks.length}
                        </Badge>
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {filteredTasks.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-center">
                        <p className="text-xs text-muted-foreground">No tasks</p>
                      </div>
                    ) : (
                      filteredTasks.map(task => {
                        const fieldInfo = fields.find(f => f.id === task.field_id);
                        const creator = creatorData[task.creator_id];
                        const assignee = assigneeData[task.assignee_id || ''];

                        return (
                          <EnhancedTaskCard
                            key={task.id}
                            task={task}
                            field={fieldInfo}
                            creator={creator}
                            assignee={assignee}
                            onTaskClick={(clickedTask) => {
                              setSelectedTask(clickedTask);
                              setIsTaskDetailOpen(true);
                            }}
                            onStatusChange={handleStatusChange}
                          />
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Fields Tab */}
        <TabsContent value="fields" className="mt-6">
          <FieldManager
            fields={fields}
            onCreateField={createField}
            onUpdateField={updateField}
            onDeleteField={deleteField}
            teamId={teamId}
            userId={userId}
          />
        </TabsContent>
      </Tabs>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        open={isTaskDetailOpen}
        onOpenChange={setIsTaskDetailOpen}
        task={selectedTask}
        statuses={sortedStatuses}
        fields={fields}
        users={users}
        onUpdate={handleTaskUpdate}
        onDelete={deleteTask}
      />

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={isCreateTaskOpen}
        onOpenChange={setIsCreateTaskOpen}
        statuses={sortedStatuses}
        fields={fields}
        teamId={teamId}
        userId={userId}
        onCreate={handleCreateTask}
      />
    </div>
  );
};

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: TaskStatus[];
  fields: Field[];
  teamId: string;
  userId: string;
  onCreate: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>) => Promise<void>;
}

const CreateTaskDialog = ({
  open,
  onOpenChange,
  statuses,
  fields,
  teamId,
  userId,
  onCreate
}: CreateTaskDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: statuses[0]?.name || 'todo',
    priority: 'medium' as const,
    field_id: '',
    deadline: '',
    assignee_id: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Task title is required',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      await onCreate({
        title: formData.title,
        description: formData.description || null,
        status: formData.status,
        priority: formData.priority,
        field_id: formData.field_id || null,
        deadline: formData.deadline || null,
        assignee_id: formData.assignee_id || null,
        creator_id: userId,
        team_id: teamId
      });
      setFormData({
        title: '',
        description: '',
        status: statuses[0]?.name || 'todo',
        priority: 'medium',
        field_id: '',
        deadline: '',
        assignee_id: ''
      });
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>Add a new task to your board</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Task title"
            />
          </div>

          <div>
            <Label htmlFor="task-description">Description</Label>
            <Input
              id="task-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Task description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="task-status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
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
            </div>

            <div>
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value as any })}>
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
          </div>

          <div>
            <Label htmlFor="task-field">Field (Epic)</Label>
            <Select value={formData.field_id} onValueChange={(value) => setFormData({ ...formData, field_id: value })}>
              <SelectTrigger id="task-field">
                <SelectValue placeholder="Select a field" />
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
          </div>

          <div>
            <Label htmlFor="task-deadline">Deadline</Label>
            <Input
              id="task-deadline"
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

function filterTasks(tasks: Task[], filters: any): Task[] {
  let filtered = [...tasks];

  if (filters.fieldId) {
    filtered = filtered.filter(t => t.field_id === filters.fieldId);
  }
  if (filters.priority) {
    filtered = filtered.filter(t => t.priority === filters.priority);
  }
  if (filters.createdBy) {
    filtered = filtered.filter(t => t.creator_id === filters.createdBy);
  }

  return filtered;
}
