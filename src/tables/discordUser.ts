import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';
import User from './user';

export default class DiscordUser extends Model<InferAttributes<DiscordUser>, InferCreationAttributes<DiscordUser>> {
	declare id: string;
	declare userId: string;
}

DiscordUser.init({
	id: { type: DataTypes.STRING, primaryKey: true },
	userId: { type: DataTypes.STRING, references: { model: User, key: 'id' } },
}, { sequelize });