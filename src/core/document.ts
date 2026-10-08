export interface DocumentSnapshot {
  id: number;
  name: string;
  path: string;
  content: string;
}

export interface InitialState {
  document: DocumentSnapshot | null;
  error: string | null;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : 'Could not complete this action. Please try again.';
}
