import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireSelf, requireFamilyMember } from '../auth.middleware.ts';
import type User from '../../db/models/User.model.ts';

const fakeUser = (id: number, familyGroupId: number | null = null) =>
  ({ dataValues: { id, family_group_id: familyGroupId } }) as unknown as User;

const mockReq = (params: Record<string, string>, user?: User) =>
  ({ params, user }) as unknown as Request;

const mockRes = () =>
  ({ status: vi.fn().mockReturnThis(), json: vi.fn() }) as unknown as Response;

describe('requireSelf', () => {
  it('calls next when the authenticated user matches :id', () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireSelf(mockReq({ id: '1' }, fakeUser(1)), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when the authenticated user does not match :id', () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireSelf(mockReq({ id: '2' }, fakeUser(1)), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when no user is attached to the request', () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireSelf(mockReq({ id: '1' }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when :id is not numeric', () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireSelf(mockReq({ id: 'abc' }, fakeUser(1)), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireFamilyMember', () => {
  it('calls next when the user belongs to the family group', () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireFamilyMember(mockReq({ family_group_id: '3' }, fakeUser(1, 3)), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when the user belongs to a different family group', () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireFamilyMember(mockReq({ family_group_id: '3' }, fakeUser(1, 4)), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the user has no family group', () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireFamilyMember(mockReq({ family_group_id: '3' }, fakeUser(1, null)), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when :family_group_id is not numeric', () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireFamilyMember(mockReq({ family_group_id: 'abc' }, fakeUser(1, 3)), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});
