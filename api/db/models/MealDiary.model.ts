import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';

interface MealDiaryAttributes {
  id: number;
  family_group_id: number;
  week_start_date: Date;
  created_at?: Date;
  updated_at?: Date;
}

interface MealDiaryCreationAttributes extends Optional<MealDiaryAttributes, 'id' | 'created_at' | 'updated_at'> {}

class MealDiary extends Model<MealDiaryAttributes, MealDiaryCreationAttributes> {}

MealDiary.init(
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
    week_start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
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
    tableName: 'meal_diaries',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['family_group_id', 'week_start_date'],
      },
    ],
  }
);

export default MealDiary;
