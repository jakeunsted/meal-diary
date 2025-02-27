import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';

interface DailyMealAttributes {
  daily_meal_id: number;
  meal_diary_id: number;
  day_of_week: number;
  breakfast?: string;
  lunch?: string;
  dinner?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface DailyMealCreationAttributes extends Optional<DailyMealAttributes, 'daily_meal_id' | 'breakfast' | 'lunch' | 'dinner' | 'created_at' | 'updated_at'> {}

class DailyMeal extends Model<DailyMealAttributes, DailyMealCreationAttributes> implements DailyMealAttributes {
  public daily_meal_id!: number;
  public meal_diary_id!: number;
  public day_of_week!: number;
  public breakfast!: string | undefined;
  public lunch!: string | undefined;
  public dinner!: string | undefined;
  
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

DailyMeal.init(
  {
    daily_meal_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    meal_diary_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    day_of_week: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 7,
      },
    },
    breakfast: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    lunch: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    dinner: {
      type: DataTypes.STRING(200),
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
    tableName: 'daily_meals',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['meal_diary_id', 'day_of_week'],
      },
    ],
  }
);

export default DailyMeal;
