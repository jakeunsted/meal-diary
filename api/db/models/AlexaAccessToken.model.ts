import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';
import AlexaLink from './AlexaLink.model.ts';

export interface AlexaAccessTokenAttributes {
  id: number;
  alexa_link_id: number;
  token_hash: string;
  expires_at: Date;
  created_at?: Date;
}

interface AlexaAccessTokenCreationAttributes extends Optional<
  AlexaAccessTokenAttributes,
  'id' | 'created_at'
> {}

class AlexaAccessToken extends Model<
  AlexaAccessTokenAttributes,
  AlexaAccessTokenCreationAttributes
> {
  declare id: number;
  declare alexa_link_id: number;
  declare token_hash: string;
  declare expires_at: Date;
  public readonly link?: AlexaLink;
}

AlexaAccessToken.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    alexa_link_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: AlexaLink,
        key: 'id',
      },
    },
    token_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'alexa_access_tokens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        fields: ['alexa_link_id'],
      },
    ],
  }
);

export default AlexaAccessToken;
