import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';

export interface ShoppingListItem {
  id: number;
  name: string;
  checked: boolean;
}

export interface ShoppingListCategory {
  id: number;
  name: string;
  items: ShoppingListItem[];
}

export interface ShoppingListContent {
  categories: ShoppingListCategory[];
}

export interface ShoppingListAttributes {
  id: number;
  family_group_id: number;
  content: ShoppingListContent;
  created_at?: Date;
  updated_at?: Date;
}

interface ShoppingListCreationAttributes extends Optional<ShoppingListAttributes, 'id' | 'content' | 'created_at' | 'updated_at'> {}

class ShoppingList extends Model<ShoppingListAttributes, ShoppingListCreationAttributes> {}

ShoppingList.init(
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
    content: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: { categories: [] },
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
    tableName: 'shopping_lists',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default ShoppingList;
