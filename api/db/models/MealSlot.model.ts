import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';

export type LegacyMealKey = 'breakfast' | 'lunch' | 'dinner';

export interface MealSlotAttributes {
  id: number;
  family_group_id: number;
  position: number;
  name: string;
  legacy_key: LegacyMealKey | null;
  archived_at: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

interface MealSlotCreationAttributes
  extends Optional<
    MealSlotAttributes,
    'id' | 'legacy_key' | 'archived_at' | 'created_at' | 'updated_at'
  > {}

class MealSlot extends Model<MealSlotAttributes, MealSlotCreationAttributes> {}

MealSlot.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    family_group_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 6,
      },
    },
    name: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    legacy_key: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },
    archived_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
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
    tableName: 'meal_slots',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['family_group_id'],
      },
      {
        fields: ['family_group_id', 'archived_at'],
      },
    ],
  }
);

export default MealSlot;
