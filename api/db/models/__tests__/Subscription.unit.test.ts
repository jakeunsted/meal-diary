import { describe, it, expect } from 'vitest';
import { ValidationError } from 'sequelize';
import Subscription from '../Subscription.model.ts';

describe('Subscription Model', () => {
  it('should build a valid free subscription that passes validation', async () => {
    const subscription = Subscription.build({
      family_group_id: 1,
    });

    await expect(subscription.validate()).resolves.not.toThrow();

    const json = subscription.toJSON();
    expect(json.plan).toBe('free');
    expect(json.status).toBe('active');
    expect(json.is_complimentary).toBe(false);
  });

  it('should require a family_group_id field', async () => {
    const subscription = Subscription.build({} as never);

    await expect(subscription.validate()).rejects.toThrow(ValidationError);
  });
});
