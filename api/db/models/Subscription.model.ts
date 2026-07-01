import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';
import type { SubscriptionPlan, SubscriptionStatus } from '@meal-diary/shared';

export interface SubscriptionAttributes {
  id: number;
  family_group_id: number;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billing_interval: 'month' | 'year' | null;
  trial_ends_at: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  revenuecat_app_user_id: string | null;
  store_platform: 'web' | 'ios' | 'android' | null;
  is_complimentary: boolean;
  complimentary_reason: string | null;
  trial_expired_prompt_seen_at: Date | null;
  payment_failed_at: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

interface SubscriptionCreationAttributes extends Optional<
  SubscriptionAttributes,
  | 'id'
  | 'plan'
  | 'status'
  | 'billing_interval'
  | 'trial_ends_at'
  | 'current_period_end'
  | 'cancel_at_period_end'
  | 'stripe_customer_id'
  | 'stripe_subscription_id'
  | 'revenuecat_app_user_id'
  | 'store_platform'
  | 'is_complimentary'
  | 'complimentary_reason'
  | 'trial_expired_prompt_seen_at'
  | 'payment_failed_at'
  | 'created_at'
  | 'updated_at'
> {}

class Subscription extends Model<SubscriptionAttributes, SubscriptionCreationAttributes> {}

Subscription.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    family_group_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    plan: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'free',
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
    },
    billing_interval: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    trial_ends_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    current_period_end: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancel_at_period_end: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    stripe_customer_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    stripe_subscription_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    revenuecat_app_user_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    store_platform: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    is_complimentary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    complimentary_reason: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    trial_expired_prompt_seen_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    payment_failed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'subscriptions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Subscription;
