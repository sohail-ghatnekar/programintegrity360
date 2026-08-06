import { Badge, Progress } from '@uipath/apollo-wind';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  PlayCircle,
} from 'lucide-react';
import type { CaseStageModel, CaseTaskModel, StageStatus } from './types';

type StageJourneyProps = {
  stages: readonly CaseStageModel[];
  tasks: readonly CaseTaskModel[];
};

const stagePresentation: Record<StageStatus, {
  label: string;
  icon: typeof CheckCircle2;
  badge: 'success' | 'info' | 'warning' | 'error' | 'secondary';
  accent: string;
}> = {
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    badge: 'success',
    accent: 'border-t-emerald-600',
  },
  active: {
    label: 'Active route',
    icon: PlayCircle,
    badge: 'info',
    accent: 'border-t-blue-600',
  },
  waiting: {
    label: 'Waiting',
    icon: Clock3,
    badge: 'warning',
    accent: 'border-t-amber-500',
  },
  faulted: {
    label: 'Faulted',
    icon: AlertTriangle,
    badge: 'error',
    accent: 'border-t-red-600',
  },
  'not-started': {
    label: 'Not started',
    icon: CircleDashed,
    badge: 'secondary',
    accent: 'border-t-slate-300',
  },
};

function taskProgress(stage: CaseStageModel, tasks: readonly CaseTaskModel[]) {
  const linkedTasks = tasks.filter((task) => task.stageLabel === stage.label);
  const completed = linkedTasks.filter((task) => task.status === 'Completed').length;

  if (stage.status === 'completed') {
    return { linkedTasks, completed, value: 100 };
  }

  return {
    linkedTasks,
    completed,
    value: linkedTasks.length === 0 ? 0 : Math.round((completed / linkedTasks.length) * 100),
  };
}

export function StageJourney({ stages, tasks }: StageJourneyProps) {
  return (
    <section aria-labelledby="stage-journey-heading" className="min-w-0 border-y border-slate-200 bg-white py-3">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 px-1">
        <div>
          <h2 id="stage-journey-heading" className="text-sm font-semibold text-slate-950">Six-stage case journey</h2>
          <p className="mt-0.5 text-xs text-slate-500">Route state and linked work from UiPath case execution.</p>
        </div>
        <Badge variant="outline">{stages.length} stages</Badge>
      </div>

      <div className="overflow-x-auto pb-1">
        <ol aria-label="Case stages" className="flex min-w-max gap-2 px-1">
          {stages.map((stage, index) => {
            const presentation = stagePresentation[stage.status];
            const StatusIcon = presentation.icon;
            const progress = taskProgress(stage, tasks);

            return (
              <li
                key={stage.key}
                data-testid="case-stage"
                className={`w-[196px] min-w-[196px] border border-slate-200 border-t-4 bg-white p-3 ${presentation.accent}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold tabular-nums text-slate-500">Stage {index + 1}</span>
                  <StatusIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-700" />
                </div>
                <h3 className="mt-2 min-h-10 text-sm font-semibold leading-5 text-slate-950">{stage.label}</h3>
                <Badge variant={presentation.badge} className="mt-2 w-fit">{presentation.label}</Badge>
                <div className="mt-3">
                  <Progress
                    value={progress.value}
                    aria-label={`${stage.label} task progress`}
                    aria-valuenow={progress.value}
                    aria-valuetext={progress.linkedTasks.length === 0
                      ? 'No linked tasks'
                      : `${progress.completed} of ${progress.linkedTasks.length} tasks complete`}
                  />
                  <div className="mt-1 text-xs tabular-nums text-slate-500">
                    {progress.linkedTasks.length === 0
                      ? 'No linked tasks'
                      : `${progress.completed}/${progress.linkedTasks.length} tasks complete`}
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 min-h-8 text-xs leading-4 text-slate-500">{stage.description}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
