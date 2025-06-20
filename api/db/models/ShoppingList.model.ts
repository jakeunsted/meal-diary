import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';

export interface ShoppingListAttributes {
  id: number;
  family_group_id: number;
  created_at?: Date;
  updated_at?: Date;
}

interface ShoppingListCreationAttributes extends Optional<ShoppingListAttributes, 'id' | 'created_at' | 'updated_at'> {}

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
      unique: true,
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
    tableName: 'shopping_lists',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default ShoppingList;
