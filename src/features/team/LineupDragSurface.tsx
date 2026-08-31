import { useCallback, type ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { TeamPlacement } from "../../domain/team/repositionTeamSelection";

interface LineupDragSurfaceProps {
  placement: TeamPlacement;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function placementKey(placement: TeamPlacement): string {
  if (placement.type === "rotation") return `rotation:${placement.slot}`;
  if (placement.type === "bench") return `bench:${placement.playerId}`;
  return "libero";
}

export function LineupDragSurface({
  placement,
  children,
  className = "",
  disabled = false,
}: LineupDragSurfaceProps) {
  const key = placementKey(placement);
  const draggable = useDraggable({
    id: `drag:${key}`,
    data: { placement },
    disabled,
  });
  const droppable = useDroppable({
    id: `drop:${key}`,
    data: { placement },
    disabled,
  });
  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      draggable.setNodeRef(node);
      droppable.setNodeRef(node);
    },
    [draggable.setNodeRef, droppable.setNodeRef],
  );

  return (
    <div
      className={`lineup-drag-surface${draggable.isDragging ? " is-dragging" : ""}${droppable.isOver ? " is-over" : ""}${className ? ` ${className}` : ""}`}
      data-drag-placement={key}
      ref={setNodeRef}
      {...draggable.listeners}
    >
      {children}
    </div>
  );
}
