import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';

export interface ShoppingListAttributes {
  id: number;
  family_group_id: number;
  content: object;
  created_at?: Date;
  updated_at?: Date;
}

interface ShoppingListCreationAttributes extends Optional<ShoppingListAttributes, 'id' | 'created_at' | 'updated_at'> {}

class ShoppingList extends Model<ShoppingListAttributes, ShoppingListCreationAttributes> implements ShoppingListAttributes {
  public id!: number;
  public family_group_id!: number;
  public content!: object;
  
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

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
      allowNull: false,
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
