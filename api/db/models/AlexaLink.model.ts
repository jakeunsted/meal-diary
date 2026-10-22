import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';
import User from './User.model.ts';

export interface AlexaLinkAttributes {
  id: number;
  user_id: number;
  refresh_token_hash: string;
  refresh_expires_at: Date;
  revoked_at?: Date | null;
  amazon_user_id?: string | null;
  linked_at: Date;
  created_at?: Date;
  updated_at?: Date;
}

interface AlexaLinkCreationAttributes extends Optional<
  AlexaLinkAttributes,
  'id' | 'revoked_at' | 'amazon_user_id' | 'created_at' | 'updated_at'
> {}

class AlexaLink extends Model<AlexaLinkAttributes, AlexaLinkCreationAttributes> {
  declare id: number;
  declare user_id: number;
  declare refresh_token_hash: string;
  declare refresh_expires_at: Date;
  declare revoked_at: Date | null;
  declare amazon_user_id: string | null;
  declare linked_at: Date;
  public readonly user?: User;
}

AlexaLink.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: User,
        key: 'id',
      },
    },
    refresh_token_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    refresh_expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    amazon_user_id: {
      type: DataTypes.STRING(512),
      allowNull: true,
      defaultValue: null,
    },
    linked_at: {
      type: DataTypes.DATE,
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
    tableName: 'alexa_links',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['refresh_token_hash'],
      },
    ],
  }
);

export default AlexaLink;
