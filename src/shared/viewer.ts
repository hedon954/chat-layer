export type ViewerContent =
  | {
      kind: "svg";
      value: string;
    }
  | {
      kind: "image";
      value: string;
      alt: string;
    };

export type ViewerPayload = {
  title: string;
  source: string;
  externalUrl?: string;
  content: ViewerContent;
};

export type OpenViewerMessage = {
  type: "show-pic-open-viewer";
  viewerId: string;
};

export function createViewerStorageKey(viewerId: string): string {
  return `showPicViewer:${viewerId}`;
}
