import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';

export interface RecipeIngredientAttributes {
  id: number;
  recipe_id: number;
  name: string;
  quantity?: number;
  unit?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface RecipeIngredientCreationAttributes extends Optional<RecipeIngredientAttributes, 'id' | 'quantity' | 'unit' | 'created_at' | 'updated_at'> {}

class RecipeIngredient extends Model<RecipeIngredientAttributes, RecipeIngredientCreationAttributes> {}

RecipeIngredient.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    recipe_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    unit: {
      type: DataTypes.STRING(50),
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
    tableName: 'recipe_ingredients',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['recipe_id'],
      },
    ],
  }
);

export default RecipeIngredient;
