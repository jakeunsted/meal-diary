import { apiFetch } from '@/lib/api/client';

export interface DeleteAccountInput {
  password?: string;
  confirmation?: string;
}

export async function exportUserData(): Promise<unknown> {
  return apiFetch<unknown>('/users/me/export');
}

export async function deleteAccount(input: DeleteAccountInput): Promise<void> {
  await apiFetch('/users/me', {
    method: 'DELETE',
    body: input,
  });
}
