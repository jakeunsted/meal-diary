import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import type { RecipeCategoryStarterKey } from '@meal-diary/shared';
import sequelize from './index.ts';

export interface RecipeCategoryAttributes {
  id: number;
  family_group_id: number;
  name: string;
  is_default: boolean;
  default_key: RecipeCategoryStarterKey | null;
  created_at?: Date;
  updated_at?: Date;
}

interface RecipeCategoryCreationAttributes
  extends Optional<RecipeCategoryAttributes, 'id' | 'default_key' | 'created_at' | 'updated_at'> {}

class RecipeCategory extends Model<RecipeCategoryAttributes, RecipeCategoryCreationAttributes> {}

RecipeCategory.init(
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
    name: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    default_key: {
      type: DataTypes.STRING(16),
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
    tableName: 'recipe_categories',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['family_group_id'],
      },
      {
        // Postgres treats null default_key values as distinct, so custom rows can share this index.
        unique: true,
        fields: ['family_group_id', 'default_key'],
      },
    ],
  }
);

export default RecipeCategory;
