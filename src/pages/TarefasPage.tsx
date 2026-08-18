import { useShell } from '@/hooks/use-shell';
import { TasksPage as TasksPageComponent } from '@/components/TasksPage';

export default function TarefasPage() {
  const shell = useShell();
  return (
    <TasksPageComponent
      initialTask={shell.pendingNewTask}
      onConsumed={shell.consumePendingNewTask}
    />
  );
}
