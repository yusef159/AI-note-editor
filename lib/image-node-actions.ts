export type ImageNodeActions = {
  onEnhance: (pos: number) => void;
  onExtract: (pos: number) => void;
  onDelete: (pos: number) => void;
};

let actions: ImageNodeActions | null = null;

export function setImageNodeActions(next: ImageNodeActions | null): void {
  actions = next;
}

export function getImageNodeActions(): ImageNodeActions | null {
  return actions;
}
