import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const familyGroupFindOne = vi.fn();
const familyGroupCreate = vi.fn();
const familyGroupFindByPk = vi.fn();
const userFindByPk = vi.fn();
const userUpdate = vi.fn();
const userFindAll = vi.fn();
const subscriptionCreate = vi.fn();
const shoppingListCreate = vi.fn();
const { transaction } = vi.hoisted(() => ({
  transaction: {
    commit: vi.fn(),
    rollback: vi.fn(),
  },
}));

vi.mock('../../db/models/index.ts', () => ({
  default: {
    transaction: vi.fn(async () => transaction),
  },
}));

vi.mock('../../db/models/associations.ts', () => ({
  FamilyGroup: {
    findOne: (...args: unknown[]) => familyGroupFindOne(...args),
    create: (...args: unknown[]) => familyGroupCreate(...args),
    findByPk: (...args: unknown[]) => familyGroupFindByPk(...args),
  },
  User: {
    findByPk: (...args: unknown[]) => userFindByPk(...args),
    update: (...args: unknown[]) => userUpdate(...args),
    findAll: (...args: unknown[]) => userFindAll(...args),
  },
  Subscription: {
    create: (...args: unknown[]) => subscriptionCreate(...args),
  },
}));

vi.mock('../../db/models/ShoppingList.model.ts', () => ({
  default: {
    create: (...args: unknown[]) => shoppingListCreate(...args),
  },
}));

vi.mock('../../services/mealDiary.service.ts', () => ({
  createNewWeeklyMeals: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/mealSlots.service.ts', () => ({
  ensureDefaultMealSlots: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/familyGroup.service.ts', () => ({
  leaveFamilyGroup: vi.fn(),
  transferFamilyGroupOwnership: vi.fn(),
  deleteFamilyGroup: vi.fn(),
}));

vi.mock('../../services/entitlements.service.ts', () => ({
  assertCanAddFamilyMember: vi.fn(),
}));

vi.mock('../../middleware/entitlement.middleware.ts', () => ({
  handleEntitlementError: vi.fn(() => false),
}));

vi.mock('../../utils/posthog.ts', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
  getDistinctId: vi.fn(() => 'distinct'),
}));

import { handleEntitlementError } from '../../middleware/entitlement.middleware.ts';
import * as EntitlementsService from '../../services/entitlements.service.ts';
import * as FamilyGroupService from '../../services/familyGroup.service.ts';
import { trackEvent } from '../../utils/posthog.ts';
import {
  createFamilyGroup,
  deleteFamilyGroup,
  getFamilyGroupById,
  getFamilyGroupMembers,
  joinFamilyGroup,
  leaveFamilyGroup,
  transferFamilyGroupOwnership,
} from '../family-group/familyGroup.controller.ts';

const mockResponse = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }) as unknown as Response;

const mockRequest = (
  body: Record<string, unknown> = {},
  params: Record<string, string> = {},
  familyGroupId: number | null = 10
) =>
  ({
    body,
    params,
    user: familyGroupId === null
      ? undefined
      : { dataValues: { id: 5, family_group_id: familyGroupId } },
  }) as unknown as Request;

describe('familyGroup.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    familyGroupFindOne.mockResolvedValue(null);
    familyGroupFindByPk.mockResolvedValue({ dataValues: { id: 4, created_by: 99 } });
    familyGroupCreate.mockResolvedValue({ dataValues: { id: 4 } });
    transaction.commit.mockResolvedValue(undefined);
    transaction.rollback.mockResolvedValue(undefined);
    userFindByPk.mockResolvedValue({ dataValues: { family_group_id: null } });
    userUpdate.mockResolvedValue([1]);
    subscriptionCreate.mockResolvedValue({});
    shoppingListCreate.mockResolvedValue({});
    vi.mocked(handleEntitlementError).mockReturnValue(false);
    vi.mocked(EntitlementsService.assertCanAddFamilyMember).mockResolvedValue(undefined as never);
  });

  it('creates a family group for the signed-in user and rejects a missing user', async () => {
    const res = mockResponse();

    await createFamilyGroup(mockRequest({ name: 'Home' }), res);

    expect(familyGroupCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Home',
      created_by: 5,
    }));
    expect(userUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(trackEvent).toHaveBeenCalledWith('5', 'family_group_created', { family_group_id: 4 });

    const unauthorized = mockResponse();
    await createFamilyGroup(mockRequest({ name: 'Home' }, {}, null), unauthorized);
    expect(unauthorized.status).toHaveBeenCalledWith(401);

    userFindByPk.mockResolvedValueOnce({ dataValues: { family_group_id: 10 } });
    const conflict = mockResponse();
    await createFamilyGroup(mockRequest({ name: 'Second' }), conflict);
    expect(conflict.status).toHaveBeenCalledWith(409);
    expect(familyGroupCreate).toHaveBeenCalledTimes(1);
  });

  it('joins a family group and maps missing, unknown, and member-limit responses', async () => {
    const missing = mockResponse();
    await joinFamilyGroup(mockRequest({}), missing);
    expect(missing.status).toHaveBeenCalledWith(412);

    familyGroupFindOne.mockResolvedValueOnce(null);
    const unknown = mockResponse();
    await joinFamilyGroup(mockRequest({ random_identifier: 'able-boat-calm' }), unknown);
    expect(unknown.status).toHaveBeenCalledWith(404);

    familyGroupFindOne.mockResolvedValue({ dataValues: { id: 4 } });
    const joined = mockResponse();
    await joinFamilyGroup(mockRequest({ random_identifier: 'able-boat-calm' }), joined);
    expect(joined.status).toHaveBeenCalledWith(200);
    expect(familyGroupFindByPk).toHaveBeenCalledWith(4, expect.objectContaining({
      transaction,
      lock: 'UPDATE',
    }));
    expect(EntitlementsService.assertCanAddFamilyMember).toHaveBeenCalledWith(4, 5, transaction);
    expect(userUpdate).toHaveBeenCalledWith(
      { family_group_id: 4 },
      expect.objectContaining({ where: { id: 5 }, transaction })
    );
    expect(transaction.commit).toHaveBeenCalled();

    vi.mocked(EntitlementsService.assertCanAddFamilyMember).mockRejectedValueOnce(new Error('limit'));
    vi.mocked(handleEntitlementError).mockReturnValueOnce(true);
    const limited = mockResponse();
    await joinFamilyGroup(mockRequest({ random_identifier: 'able-boat-calm' }), limited);
    expect(trackEvent).toHaveBeenCalledWith('5', 'family_group_join_failure', { reason: 'member_limit' });

    userFindByPk.mockResolvedValue({ dataValues: { id: 5, family_group_id: 10 } });
    familyGroupFindByPk.mockResolvedValue({ dataValues: { id: 10, created_by: 5 } });
    userUpdate.mockClear();
    const stillOwner = mockResponse();
    await joinFamilyGroup(mockRequest({ random_identifier: 'able-boat-calm' }), stillOwner);
    expect(stillOwner.status).toHaveBeenCalledWith(409);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('returns a family group only to its members', async () => {
    familyGroupFindByPk.mockResolvedValue({ id: 10 });
    const res = mockResponse();
    await getFamilyGroupById(mockRequest({}, { id: '10' }), res);
    expect(res.status).toHaveBeenCalledWith(200);

    const forbidden = mockResponse();
    await getFamilyGroupById(mockRequest({}, { id: '11' }), forbidden);
    expect(forbidden.status).toHaveBeenCalledWith(403);

    familyGroupFindByPk.mockResolvedValue(null);
    const missing = mockResponse();
    await getFamilyGroupById(mockRequest({}, { id: '10' }), missing);
    expect(missing.status).toHaveBeenCalledWith(404);
  });

  it('leaves, transfers, and deletes a family group', async () => {
    vi.mocked(FamilyGroupService.leaveFamilyGroup).mockResolvedValue(undefined as never);
    const left = mockResponse();
    await leaveFamilyGroup(mockRequest({}, { id: '10' }), left);
    expect(left.status).toHaveBeenCalledWith(200);

    vi.mocked(FamilyGroupService.leaveFamilyGroup).mockRejectedValueOnce(new Error('You cannot leave'));
    const conflict = mockResponse();
    await leaveFamilyGroup(mockRequest({}, { id: '10' }), conflict);
    expect(conflict.status).toHaveBeenCalledWith(409);

    const missingOwner = mockResponse();
    await transferFamilyGroupOwnership(mockRequest({}, { id: '10' }), missingOwner);
    expect(missingOwner.status).toHaveBeenCalledWith(400);

    vi.mocked(FamilyGroupService.transferFamilyGroupOwnership).mockRejectedValueOnce(
      new Error('Only the family owner can transfer')
    );
    const forbidden = mockResponse();
    await transferFamilyGroupOwnership(mockRequest({ new_owner_id: '8' }, { id: '10' }), forbidden);
    expect(forbidden.status).toHaveBeenCalledWith(403);

    vi.mocked(FamilyGroupService.deleteFamilyGroup).mockRejectedValueOnce(new Error('Family group not found'));
    const missing = mockResponse();
    await deleteFamilyGroup(mockRequest({}, { id: '10' }), missing);
    expect(missing.status).toHaveBeenCalledWith(404);

    vi.mocked(FamilyGroupService.deleteFamilyGroup).mockResolvedValue(undefined as never);
    const deleted = mockResponse();
    await deleteFamilyGroup(mockRequest({}, { id: '10' }), deleted);
    expect(deleted.status).toHaveBeenCalledWith(200);
  });

  it('lists members for the signed-in family', async () => {
    familyGroupFindByPk.mockResolvedValue({ id: 10 });
    userFindAll.mockResolvedValue([{ id: 5 }]);
    const res = mockResponse();

    await getFamilyGroupMembers(mockRequest({}, { id: '10' }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: 5 }]);
  });
});
