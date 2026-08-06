import { Badge } from '@uipath/apollo-wind';
import { Bot, CircleUserRound, Cpu } from 'lucide-react';
import type { ActivityEvent } from '../cases/types';

type ActivityTimelineProps = {
  events: readonly ActivityEvent[];
};

const actorPresentation = {
  Human: { icon: CircleUserRound, variant: 'info' as const },
  System: { icon: Cpu, variant: 'secondary' as const },
  Agent: { icon: Bot, variant: 'warning' as const },
};

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  return (
    <section aria-labelledby="activity-heading" className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 id="activity-heading" className="text-base font-semibold text-slate-950">Full case timeline</h2>
          <p className="mt-1 text-sm text-slate-600">UiPath execution and recorded human activity in chronological order.</p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">{events.length} events</span>
      </div>

      <ol className="border-t border-slate-200">
        {events.map((event) => {
          const presentation = actorPresentation[event.actorKind];
          const ActorIcon = presentation.icon;

          return (
            <li key={event.id} className="grid gap-2 border-b border-slate-200 py-3 sm:grid-cols-[142px_108px_minmax(0,1fr)_88px] sm:items-start">
              <time className="font-mono text-xs text-slate-500">{event.timestamp}</time>
              <Badge variant={presentation.variant} className="w-fit gap-1">
                <ActorIcon aria-hidden="true" className="h-3.5 w-3.5" />
                {event.actorKind}
              </Badge>
              <div className="min-w-0">
                <div className="break-words text-sm font-semibold text-slate-900">{event.type}</div>
                <p className="mt-1 break-words text-sm text-slate-600">{event.detail}</p>
                <div className="mt-1 text-xs text-slate-500">{event.actor}</div>
              </div>
              <code className="text-xs text-slate-500 sm:text-right">{event.id}</code>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
