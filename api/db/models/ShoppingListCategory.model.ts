import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';

export interface ShoppingListCategoryAttributes {
  id: number;
  shopping_list_id: number;
  item_categories_id: number;
  created_at?: Date;
  updated_at?: Date;
}

interface ShoppingListCategoryCreationAttributes extends Optional<ShoppingListCategoryAttributes, 'id' | 'created_at' | 'updated_at'> {}

class ShoppingListCategory extends Model<ShoppingListCategoryAttributes, ShoppingListCategoryCreationAttributes> {}

ShoppingListCategory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    shopping_list_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    item_categories_id: {
      type: DataTypes.INTEGER,
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
    tableName: 'shopping_list_categories',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default ShoppingListCategory;
