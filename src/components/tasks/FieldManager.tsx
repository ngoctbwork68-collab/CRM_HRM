import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Field } from '@/hooks/use-task-board';
import { useToast } from '@/hooks/use-toast';

interface FieldManagerProps {
  fields: Field[];
  onCreateField: (field: Omit<Field, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onUpdateField: (fieldId: string, updates: Partial<Field>) => Promise<void>;
  onDeleteField: (fieldId: string) => Promise<void>;
  teamId: string;
  userId: string;
}

const COLORS = ['blue', 'red', 'yellow', 'green', 'purple', 'pink', 'gray', 'orange', 'cyan'];

const colorClasses = {
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

export const FieldManager = ({
  fields,
  onCreateField,
  onUpdateField,
  onDeleteField,
  teamId,
  userId
}: FieldManagerProps) => {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: 'blue'
  });

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Field name is required',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const fieldData = {
        team_id: teamId,
        created_by: userId,
        name: formData.name,
        description: formData.description || null,
        color: formData.color,
        icon: null,
        position: fields.length,
        is_archived: false
      };
      
      await onCreateField(fieldData as any);
      setFormData({ name: '', description: '', color: 'blue' });
      setIsCreateOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateField = async (fieldId: string, updates: any) => {
    setIsLoading(true);
    try {
      await onUpdateField(fieldId, updates);
      setEditingFieldId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this field? Tasks will still exist but won\'t be grouped.')) {
      return;
    }
    
    setIsLoading(true);
    try {
      await onDeleteField(fieldId);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg">Fields (Epics)</CardTitle>
            <CardDescription>Organize tasks by themes or projects</CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Field
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Field</DialogTitle>
                <DialogDescription>Create a new field to organize your tasks</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateField} className="space-y-4">
                <div>
                  <Label htmlFor="field-name">Field Name</Label>
                  <Input
                    id="field-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Design System, API Integration"
                  />
                </div>
                <div>
                  <Label htmlFor="field-description">Description (Optional)</Label>
                  <Input
                    id="field-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe this field"
                  />
                </div>
                <div>
                  <Label htmlFor="field-color">Color</Label>
                  <Select value={formData.color} onValueChange={(color) => setFormData({ ...formData, color })}>
                    <SelectTrigger id="field-color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLORS.map(color => (
                        <SelectItem key={color} value={color}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${colorClasses[color as keyof typeof colorClasses]}`} />
                            {color}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Create Field
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No fields yet. Create one to get started!</p>
          ) : (
            fields.map(field => (
              <div
                key={field.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-3 h-3 rounded-full ${colorClasses[field.color as keyof typeof colorClasses]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{field.name}</p>
                    {field.description && (
                      <p className="text-xs text-muted-foreground truncate">{field.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingFieldId(field.id)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Field</DialogTitle>
                      </DialogHeader>
                      <FieldEditForm
                        field={field}
                        onSave={(updates) => handleUpdateField(field.id, updates)}
                        isLoading={isLoading}
                      />
                    </DialogContent>
                  </Dialog>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteField(field.id)}
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface FieldEditFormProps {
  field: Field;
  onSave: (updates: Partial<Field>) => Promise<void>;
  isLoading: boolean;
}

const FieldEditForm = ({ field, onSave, isLoading }: FieldEditFormProps) => {
  const [formData, setFormData] = useState({
    name: field.name,
    description: field.description || '',
    color: field.color
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      name: formData.name,
      description: formData.description || null,
      color: formData.color
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="edit-field-name">Field Name</Label>
        <Input
          id="edit-field-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="edit-field-description">Description</Label>
        <Input
          id="edit-field-description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="edit-field-color">Color</Label>
        <Select value={formData.color} onValueChange={(color) => setFormData({ ...formData, color })}>
          <SelectTrigger id="edit-field-color">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COLORS.map(color => (
              <SelectItem key={color} value={color}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${colorClasses[color as keyof typeof colorClasses]}`} />
                  {color}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" type="button" disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </form>
  );
};
