import { DataTypes, Model } from 'sequelize';
import sequelize from './index.ts';

export interface RecipeCategoryAssignmentAttributes {
  recipe_id: number;
  recipe_category_id: number;
}

class RecipeCategoryAssignment extends Model<
  RecipeCategoryAssignmentAttributes,
  RecipeCategoryAssignmentAttributes
> {}

RecipeCategoryAssignment.init(
  {
    recipe_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    recipe_category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
  },
  {
    sequelize,
    tableName: 'recipe_category_assignments',
    timestamps: false,
  }
);

export default RecipeCategoryAssignment;
