import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';
import User from './User.model.ts';

export interface OAuthExchangeCodeAttributes {
  id: number;
  user_id: number;
  code_hash: string;
  expires_at: Date;
  used_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

interface OAuthExchangeCodeCreationAttributes extends Optional<
  OAuthExchangeCodeAttributes,
  'id' | 'used_at' | 'created_at' | 'updated_at'
> {}

class OAuthExchangeCode extends Model<
  OAuthExchangeCodeAttributes,
  OAuthExchangeCodeCreationAttributes
> {
  declare user_id: number;
  declare code_hash: string;
  declare expires_at: Date;
  declare used_at: Date | null;
  public readonly user?: User;
}

OAuthExchangeCode.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
    code_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
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
    tableName: 'oauth_exchange_codes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id'],
      },
    ],
  }
);

export default OAuthExchangeCode;
