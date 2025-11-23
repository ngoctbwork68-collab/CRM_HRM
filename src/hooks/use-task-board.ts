import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Field {
  id: string;
  team_id: string;
  created_by: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  position: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskStatus {
  id: string;
  team_id: string;
  name: string;
  label: string;
  color: string;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string | null;
  assignee_id: string | null;
  creator_id: string;
  team_id: string | null;
  field_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Filters {
  fieldId?: string;
  priority?: string;
  createdBy?: string;
  deadline?: 'overdue' | 'today' | 'week' | 'month' | 'all';
}

export const useTaskBoard = (teamId: string) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({});

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!teamId) return;
    
    try {
      setLoading(true);
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tasks',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [teamId, toast]);

  // Fetch fields
  const fetchFields = useCallback(async () => {
    if (!teamId) return;
    
    try {
      const { data, error } = await supabase
        .from('fields')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_archived', false)
        .order('position', { ascending: true });

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      console.error('Error fetching fields:', error);
    }
  }, [teamId]);

  // Fetch task statuses
  const fetchStatuses = useCallback(async () => {
    if (!teamId) return;
    
    try {
      const { data, error } = await supabase
        .from('task_statuses')
        .select('*')
        .eq('team_id', teamId)
        .order('position', { ascending: true });

      if (error) throw error;
      setStatuses(data || []);
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  }, [teamId]);

  // Create field
  const createField = useCallback(async (fieldData: Omit<Field, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('fields')
        .insert([fieldData])
        .select()
        .single();

      if (error) throw error;
      setFields(prev => [...prev, data]);
      toast({
        title: 'Success',
        description: 'Field created successfully'
      });
      return data;
    } catch (error) {
      console.error('Error creating field:', error);
      toast({
        title: 'Error',
        description: 'Failed to create field',
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Update field
  const updateField = useCallback(async (fieldId: string, updates: Partial<Field>) => {
    try {
      const { data, error } = await supabase
        .from('fields')
        .update(updates)
        .eq('id', fieldId)
        .select()
        .single();

      if (error) throw error;
      setFields(prev => prev.map(f => f.id === fieldId ? data : f));
      toast({
        title: 'Success',
        description: 'Field updated successfully'
      });
      return data;
    } catch (error) {
      console.error('Error updating field:', error);
      toast({
        title: 'Error',
        description: 'Failed to update field',
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Delete field
  const deleteField = useCallback(async (fieldId: string) => {
    try {
      const { error } = await supabase
        .from('fields')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;
      setFields(prev => prev.filter(f => f.id !== fieldId));
      setTasks(prev => prev.map(t => t.field_id === fieldId ? { ...t, field_id: null } : t));
      toast({
        title: 'Success',
        description: 'Field deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting field:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete field',
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Update task
  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId ? data : t));
      return data;
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Create task
  const createTask = useCallback(async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();

      if (error) throw error;
      setTasks(prev => [data, ...prev]);
      toast({
        title: 'Success',
        description: 'Task created successfully'
      });
      return data;
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to create task',
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Delete task
  const deleteTask = useCallback(async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast({
        title: 'Success',
        description: 'Task deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Get filtered tasks
  const getFilteredTasks = useCallback((status: string) => {
    let filtered = tasks.filter(t => t.status === status);

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
  }, [tasks, filters]);

  // Initial load
  useEffect(() => {
    if (teamId) {
      fetchTasks();
      fetchFields();
      fetchStatuses();
    }
  }, [teamId, fetchTasks, fetchFields, fetchStatuses]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!teamId) return;

    const tasksChannel = supabase
      .channel(`tasks-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `team_id=eq.${teamId}` }, () => {
        fetchTasks();
      })
      .subscribe();

    const fieldsChannel = supabase
      .channel(`fields-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fields', filter: `team_id=eq.${teamId}` }, () => {
        fetchFields();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(fieldsChannel);
    };
  }, [teamId, fetchTasks, fetchFields]);

  return {
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
    getFilteredTasks,
    fetchTasks,
    fetchFields,
    fetchStatuses
  };
};
