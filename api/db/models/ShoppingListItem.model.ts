import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';

export interface ShoppingListItemAttributes {
  id: number;
  shopping_list_id: number;
  shopping_list_categories: number;
  name: string;
  checked: boolean;
  deleted: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface ShoppingListItemCreationAttributes extends Optional<ShoppingListItemAttributes, 'id' | 'checked' | 'deleted' | 'created_at' | 'updated_at'> {}

class ShoppingListItem extends Model<ShoppingListItemAttributes, ShoppingListItemCreationAttributes> {}

ShoppingListItem.init(
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
    shopping_list_categories: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    checked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    tableName: 'shopping_list_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default ShoppingListItem;
