import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';

export interface RecipeAttributes {
  id: number;
  family_group_id: number;
  created_by: number;
  name: string;
  description?: string;
  instructions?: string;
  portions?: number;
  created_at?: Date;
  updated_at?: Date;
}

interface RecipeCreationAttributes extends Optional<RecipeAttributes, 'id' | 'description' | 'instructions' | 'portions' | 'created_at' | 'updated_at'> {}

class Recipe extends Model<RecipeAttributes, RecipeCreationAttributes> {}

Recipe.init(
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
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    portions: {
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
    tableName: 'recipes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['family_group_id'],
      },
      {
        fields: ['created_by'],
      },
    ],
  }
);

export default Recipe;
