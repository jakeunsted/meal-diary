import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';
import FamilyGroup from './FamilyGroup.model.ts';

export interface RecipeAttributes {
  id: number;
  name: string;
  method: string;
  created_by: number;
  family_group_id?: number;
  created_at?: Date;
  updated_at?: Date;
}

interface RecipeCreationAttributes extends Optional<RecipeAttributes, 'id' | 'created_at' | 'updated_at' | 'family_group_id'> {}

class Recipe extends Model<RecipeAttributes, RecipeCreationAttributes> {
  public getFamilyGroup!: () => Promise<FamilyGroup>;
  public setFamilyGroup!: (familyGroup: FamilyGroup) => Promise<void>;
}

Recipe.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    method: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    family_group_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'family_groups',
        key: 'id',
      },
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
  }
);

export default Recipe;
