import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';
import User from './User.model.ts';

export interface OAuthLinkChallengeAttributes {
  id: number;
  user_id: number;
  token_hash: string;
  provider: 'google' | 'apple';
  subject: string;
  email: string;
  profile_json: string;
  expires_at: Date;
  used_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

interface OAuthLinkChallengeCreationAttributes extends Optional<
  OAuthLinkChallengeAttributes,
  'id' | 'used_at' | 'created_at' | 'updated_at'
> {}

class OAuthLinkChallenge extends Model<OAuthLinkChallengeAttributes, OAuthLinkChallengeCreationAttributes> {
  declare id: number;
  declare user_id: number;
  declare token_hash: string;
  declare provider: 'google' | 'apple';
  declare subject: string;
  declare email: string;
  declare profile_json: string;
  declare expires_at: Date;
  declare used_at: Date | null;
  public readonly user?: User;
}

OAuthLinkChallenge.init(
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
    token_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    provider: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    profile_json: {
      type: DataTypes.TEXT,
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
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'oauth_link_challenges',
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

export default OAuthLinkChallenge;
