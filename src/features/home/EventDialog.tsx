import type { GameDataRegistry } from "../../data/dataRegistry";
import type { GameState } from "../../domain/model/GameState";
import { FullscreenEventExperience } from "./FullscreenEventExperience";

interface EventDialogProps {
  state: GameState;
  data: GameDataRegistry;
  onChoose: (choiceId: string) => void | Promise<void>;
}

export function EventDialog(props: EventDialogProps) {
  return <FullscreenEventExperience {...props} />;
}
