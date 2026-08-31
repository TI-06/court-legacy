import { useCallback, type ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { TeamPlacement } from "../../domain/team/repositionTeamSelection";

interface LineupDragSurfaceProps {
  placement: TeamPlacement;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

function placementKey(placement: TeamPlacement): string {
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
  const {
    isDragging,
    listeners,
    setNodeRef: setDraggableNodeRef,
  } = useDraggable({
    id: `drag:${key}`,
    data: { placement },
    disabled,
  });
  const { isOver, setNodeRef: setDroppableNodeRef } = useDroppable({
    id: `drop:${key}`,
    data: { placement },
    disabled,
  });
  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDraggableNodeRef(node);
      setDroppableNodeRef(node);
    },
    [setDraggableNodeRef, setDroppableNodeRef],
  );

  return (
    <div
      className={`lineup-drag-surface${isDragging ? " is-dragging" : ""}${isOver ? " is-over" : ""}${className ? ` ${className}` : ""}`}
      data-drag-placement={key}
      ref={setNodeRef}
      {...listeners}
    >
      {children}
    </div>
  );
}
