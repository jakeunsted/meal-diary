import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';
import ShoppingList from './ShoppingList.ts';
import type { ShoppingListAttributes } from './ShoppingList.ts';

interface FamilyGroupAttributes {
  family_group_id: number;
  name: string;
  created_by: number;
  created_at?: Date;
  updated_at?: Date;
}

interface FamilyGroupCreationAttributes extends Optional<FamilyGroupAttributes, 'family_group_id' | 'created_at' | 'updated_at'> {}

class FamilyGroup extends Model<FamilyGroupAttributes, FamilyGroupCreationAttributes> implements FamilyGroupAttributes {
  public family_group_id!: number;
  public name!: string;
  public created_by!: number;
  
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public createShoppingList!: (data?: Partial<ShoppingListAttributes>) => Promise<ShoppingList>;
  public getShoppingList!: () => Promise<ShoppingList>;
  public setShoppingList!: (shoppingList: ShoppingList) => Promise<void>;
}

FamilyGroup.init(
  {
    family_group_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    created_by: {
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
    tableName: 'family_groups',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default FamilyGroup;
