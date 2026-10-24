import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/user.service.ts', () => ({
  createUser: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  deleteUserAccount: vi.fn(),
}));

vi.mock('../../services/dataExport.service.ts', () => ({
  exportUserData: vi.fn(),
}));

vi.mock('../../middleware/entitlement.middleware.ts', () => ({
  handleEntitlementError: vi.fn(() => false),
}));

vi.mock('../../utils/posthog.ts', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
  getDistinctId: vi.fn(() => 'distinct-1'),
}));

import { handleEntitlementError } from '../../middleware/entitlement.middleware.ts';
import * as DataExportService from '../../services/dataExport.service.ts';
import * as UserService from '../../services/user.service.ts';
import { trackEvent } from '../../utils/posthog.ts';
import {
  createUser,
  deleteOwnAccount,
  exportOwnData,
  getUserById,
  updateUser,
} from '../user/user.controller.ts';

const mockResponse = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
};

const authed = (body: Record<string, unknown> = {}, params: Record<string, string> = {}) =>
  ({
    body,
    params,
    user: { dataValues: { id: 5 } },
  }) as unknown as Request;

describe('user.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handleEntitlementError).mockReturnValue(false);
  });

  it('creates a user and maps service failures onto HTTP statuses', async () => {
    vi.mocked(UserService.createUser).mockResolvedValue({
      user: { id: 8 },
      familyGroupId: null,
    } as never);
    const created = mockResponse();
    await createUser(authed({ username: 'Ada', email: 'ada@example.com', password: 'Password1!' }), created);
    expect(created.status).toHaveBeenCalledWith(201);
    expect(trackEvent).toHaveBeenCalledWith('8', 'user_registered', expect.any(Object));

    vi.mocked(handleEntitlementError).mockReturnValueOnce(true);
    vi.mocked(UserService.createUser).mockRejectedValueOnce(new Error('member limit'));
    const limited = mockResponse();
    await createUser(authed({ username: 'Ada' }), limited);
    expect(trackEvent).toHaveBeenCalledWith('distinct-1', 'user_registration_failed', { reason: 'member_limit' });

    vi.mocked(UserService.createUser).mockRejectedValueOnce(new Error('Email already exists'));
    const conflict = mockResponse();
    await createUser(authed({ username: 'Ada' }), conflict);
    expect(conflict.status).toHaveBeenCalledWith(409);

    vi.mocked(UserService.createUser).mockRejectedValueOnce(new Error('Family group not found'));
    const missingGroup = mockResponse();
    await createUser(authed({ username: 'Ada' }), missingGroup);
    expect(missingGroup.status).toHaveBeenCalledWith(404);
  });

  it('gets and updates a user, including not-found and conflict responses', async () => {
    vi.mocked(UserService.getUserById).mockResolvedValue({ id: 5 } as never);
    const found = mockResponse();
    await getUserById(authed({}, { id: '5' }), found);
    expect(found.status).toHaveBeenCalledWith(200);

    vi.mocked(UserService.getUserById).mockRejectedValueOnce(new Error('User not found'));
    const missing = mockResponse();
    await getUserById(authed({}, { id: '5' }), missing);
    expect(missing.status).toHaveBeenCalledWith(404);

    vi.mocked(UserService.updateUser).mockResolvedValue({ id: 5, username: 'Ada' } as never);
    const updated = mockResponse();
    await updateUser(authed({ username: 'Ada' }, { id: '5' }), updated);
    expect(updated.status).toHaveBeenCalledWith(200);

    vi.mocked(UserService.updateUser).mockRejectedValueOnce(new Error('Email already in use'));
    const conflict = mockResponse();
    await updateUser(authed({ email: 'ada@example.com' }, { id: '5' }), conflict);
    expect(conflict.status).toHaveBeenCalledWith(409);
  });

  it('deletes the signed-in account and maps confirmation and membership errors', async () => {
    vi.mocked(UserService.deleteUserAccount).mockResolvedValue(undefined as never);
    const deleted = mockResponse();
    await deleteOwnAccount(authed({ confirmation: 'DELETE' }), deleted);
    expect(deleted.status).toHaveBeenCalledWith(200);

    vi.mocked(UserService.deleteUserAccount).mockRejectedValueOnce(new Error('Password is incorrect'));
    const forbidden = mockResponse();
    await deleteOwnAccount(authed({ password: 'nope' }), forbidden);
    expect(forbidden.status).toHaveBeenCalledWith(403);

    vi.mocked(UserService.deleteUserAccount).mockRejectedValueOnce(new Error('Please confirm deletion'));
    const unconfirmed = mockResponse();
    await deleteOwnAccount(authed({}), unconfirmed);
    expect(unconfirmed.status).toHaveBeenCalledWith(400);

    vi.mocked(UserService.deleteUserAccount).mockRejectedValueOnce(new Error('Family has other members'));
    const conflict = mockResponse();
    await deleteOwnAccount(authed({}), conflict);
    expect(conflict.status).toHaveBeenCalledWith(409);
  });

  it('exports the signed-in user as a JSON attachment', async () => {
    vi.mocked(DataExportService.exportUserData).mockResolvedValue({ user: { id: 5 } } as never);
    const res = mockResponse();

    await exportOwnData(authed(), res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('"id": 5'));

    vi.mocked(DataExportService.exportUserData).mockRejectedValueOnce(new Error('User not found'));
    const missing = mockResponse();
    await exportOwnData(authed(), missing);
    expect(missing.status).toHaveBeenCalledWith(404);
  });
});
