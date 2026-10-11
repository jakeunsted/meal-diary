import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';

export interface DailyMealEntryAttributes {
  id: number;
  daily_meal_id: number;
  meal_slot_id: number;
  name: string;
  position: number;
  dish: string | null;
  recipe_id: number | null;
  created_at?: Date;
  updated_at?: Date;
}

interface DailyMealEntryCreationAttributes
  extends Optional<
    DailyMealEntryAttributes,
    'id' | 'dish' | 'recipe_id' | 'created_at' | 'updated_at'
  > {}

class DailyMealEntry extends Model<DailyMealEntryAttributes, DailyMealEntryCreationAttributes> {}

DailyMealEntry.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    daily_meal_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    meal_slot_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(32),
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
    dish: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    recipe_id: {
      type: DataTypes.INTEGER,
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
    tableName: 'daily_meal_entries',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['daily_meal_id', 'meal_slot_id'],
      },
      {
        fields: ['meal_slot_id'],
      },
      {
        fields: ['daily_meal_id'],
      },
    ],
  }
);

export default DailyMealEntry;
