import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';

export interface SubscriptionEventAttributes {
  id: number;
  subscription_id: number | null;
  stripe_event_id: string | null;
  event_type: string;
  provider: 'stripe' | 'revenuecat';
  payload: Record<string, unknown> | null;
  created_at?: Date;
}

interface SubscriptionEventCreationAttributes extends Optional<
  SubscriptionEventAttributes,
  | 'id'
  | 'subscription_id'
  | 'stripe_event_id'
  | 'payload'
  | 'created_at'
> {}

class SubscriptionEvent extends Model<
  SubscriptionEventAttributes,
  SubscriptionEventCreationAttributes
> {}

SubscriptionEvent.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    subscription_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    stripe_event_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    event_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    provider: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'subscription_events',
    timestamps: false,
  }
);

export default SubscriptionEvent;
