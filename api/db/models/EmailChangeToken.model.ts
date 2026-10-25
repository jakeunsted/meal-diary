import { DataTypes, Model } from 'sequelize';
import type { Optional } from 'sequelize';
import sequelize from './index.ts';
import User from './User.model.ts';

export interface EmailChangeTokenAttributes {
  id: number;
  user_id: number;
  pending_email: string;
  token_hash: string;
  expires_at: Date;
  used_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

interface EmailChangeTokenCreationAttributes extends Optional<
  EmailChangeTokenAttributes,
  'id' | 'used_at' | 'created_at' | 'updated_at'
> {}

class EmailChangeToken extends Model<EmailChangeTokenAttributes, EmailChangeTokenCreationAttributes> {
  declare id: number;
  declare user_id: number;
  declare pending_email: string;
  declare token_hash: string;
  declare expires_at: Date;
  declare used_at: Date | null;
  public readonly user?: User;
}

EmailChangeToken.init(
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
    pending_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
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
    tableName: 'email_change_tokens',
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

export default EmailChangeToken;
