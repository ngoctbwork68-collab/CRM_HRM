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

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string | null;
  assignee_id: string | null;
  creator_id: string;
  team_id: string | null;
  field_id: string;  // Which column/field this task belongs to
  status?: string;   // Keep for backward compatibility
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export const useBoard = (teamId: string) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch fields (columns)
  const fetchFields = useCallback(async () => {
    if (!teamId) return;
    
    try {
      setLoading(true);
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
      toast({
        title: 'Error',
        description: 'Failed to load board columns',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [teamId, toast]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!teamId) return;
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tasks',
        variant: 'destructive'
      });
    }
  }, [teamId, toast]);

  // Create field (column)
  const createField = useCallback(async (name: string, color: string = 'blue') => {
    if (!teamId) return;
    
    try {
      const { data, error } = await supabase
        .from('fields')
        .insert([{
          team_id: teamId,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          name,
          color,
          position: fields.length,
          is_archived: false
        }])
        .select()
        .single();

      if (error) throw error;
      setFields(prev => [...prev, data]);
      toast({
        title: 'Success',
        description: `Column "${name}" created`
      });
      return data;
    } catch (error) {
      console.error('Error creating field:', error);
      toast({
        title: 'Error',
        description: 'Failed to create column',
        variant: 'destructive'
      });
    }
  }, [teamId, fields.length, toast]);

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
        description: 'Column updated'
      });
      return data;
    } catch (error) {
      console.error('Error updating field:', error);
      toast({
        title: 'Error',
        description: 'Failed to update column',
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Delete field
  const deleteField = useCallback(async (fieldId: string) => {
    try {
      const { error } = await supabase
        .from('fields')
        .update({ is_archived: true })
        .eq('id', fieldId);

      if (error) throw error;
      setFields(prev => prev.filter(f => f.id !== fieldId));
      // Tasks in this field will still exist but won't be displayed if field is archived
      toast({
        title: 'Success',
        description: 'Column archived'
      });
    } catch (error) {
      console.error('Error deleting field:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete column',
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
        description: 'Task created'
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
        description: 'Task deleted'
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

  // Move task to another field
  const moveTask = useCallback(async (taskId: string, fieldId: string) => {
    await updateTask(taskId, { field_id: fieldId });
  }, [updateTask]);

  // Get tasks for a specific field
  const getTasksInField = useCallback((fieldId: string) => {
    return tasks.filter(t => t.field_id === fieldId);
  }, [tasks]);

  // Initial load
  useEffect(() => {
    if (teamId) {
      fetchFields();
      fetchTasks();
    }
  }, [teamId, fetchFields, fetchTasks]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!teamId) return;

    const fieldsChannel = supabase
      .channel(`fields-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fields', filter: `team_id=eq.${teamId}` }, () => {
        fetchFields();
      })
      .subscribe();

    const tasksChannel = supabase
      .channel(`tasks-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `team_id=eq.${teamId}` }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(fieldsChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [teamId, fetchFields, fetchTasks]);

  return {
    tasks,
    fields,
    loading,
    createField,
    updateField,
    deleteField,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    getTasksInField,
    fetchFields,
    fetchTasks
  };
};
