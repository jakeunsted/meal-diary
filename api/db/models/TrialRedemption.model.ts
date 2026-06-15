import { DataTypes, Model, Op } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';

export interface TrialRedemptionAttributes {
  id: number;
  normalized_email: string | null;
  google_id: string | null;
  stripe_customer_id: string | null;
  family_group_id: number | null;
  redeemed_at?: Date;
}

interface TrialRedemptionCreationAttributes extends Optional<
  TrialRedemptionAttributes,
  | 'id'
  | 'normalized_email'
  | 'google_id'
  | 'stripe_customer_id'
  | 'family_group_id'
  | 'redeemed_at'
> {}

class TrialRedemption extends Model<
  TrialRedemptionAttributes,
  TrialRedemptionCreationAttributes
> {}

TrialRedemption.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    normalized_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    google_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    stripe_customer_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    family_group_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    redeemed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'trial_redemptions',
    timestamps: false,
    indexes: [
      {
        unique: true,
        name: 'trial_redemptions_email_unique',
        fields: ['normalized_email'],
        where: {
          normalized_email: { [Op.ne]: null },
        },
      },
      {
        unique: true,
        name: 'trial_redemptions_google_id_unique',
        fields: ['google_id'],
        where: {
          google_id: { [Op.ne]: null },
        },
      },
      {
        unique: true,
        name: 'trial_redemptions_stripe_customer_unique',
        fields: ['stripe_customer_id'],
        where: {
          stripe_customer_id: { [Op.ne]: null },
        },
      },
    ],
  }
);

export default TrialRedemption;
