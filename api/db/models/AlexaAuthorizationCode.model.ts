import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';
import User from './User.model.ts';

export interface AlexaAuthorizationCodeAttributes {
  id: number;
  user_id: number;
  code_hash: string;
  redirect_uri: string;
  expires_at: Date;
  used_at?: Date | null;
  created_at?: Date;
}

interface AlexaAuthorizationCodeCreationAttributes extends Optional<
  AlexaAuthorizationCodeAttributes,
  'id' | 'used_at' | 'created_at'
> {}

class AlexaAuthorizationCode extends Model<
  AlexaAuthorizationCodeAttributes,
  AlexaAuthorizationCodeCreationAttributes
> {
  declare id: number;
  declare user_id: number;
  declare code_hash: string;
  declare redirect_uri: string;
  declare expires_at: Date;
  declare used_at: Date | null;
  public readonly user?: User;
}

AlexaAuthorizationCode.init(
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
    redirect_uri: {
      type: DataTypes.STRING(2048),
      allowNull: false,
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
  },
  {
    sequelize,
    tableName: 'alexa_authorization_codes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        fields: ['user_id'],
      },
    ],
  }
);

export default AlexaAuthorizationCode;
