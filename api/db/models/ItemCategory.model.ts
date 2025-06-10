import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';

export interface ItemCategoryAttributes {
  id: number;
  name: string;
  icon?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface ItemCategoryCreationAttributes extends Optional<ItemCategoryAttributes, 'id' | 'icon' | 'created_at' | 'updated_at'> {}

class ItemCategory extends Model<ItemCategoryAttributes, ItemCategoryCreationAttributes> {}

ItemCategory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    icon: {
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
    tableName: 'item_categories',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default ItemCategory;
