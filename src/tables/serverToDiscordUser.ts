import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';
import Server from './server';
import DiscordUser from './discordUser';

export default class ServerToDiscordUser extends Model<InferAttributes<ServerToDiscordUser>, InferCreationAttributes<ServerToDiscordUser>> {
	declare id: number;
	declare discordUserId: string;
	declare serverId: string;
	declare isMember: boolean;
	declare lastUpdatedTimestamp: number;
}

ServerToDiscordUser.init({
	id: { type: DataTypes.SMALLINT.UNSIGNED, autoIncrement: true, primaryKey: true },
	discordUserId: { type: DataTypes.STRING, references: { model: DiscordUser, key: 'id' } },
	serverId: { type: DataTypes.STRING, references: { model: Server, key: 'id' } },
	isMember: { type: DataTypes.BOOLEAN, defaultValue: false },
	lastUpdatedTimestamp: { type: DataTypes.BIGINT, defaultValue: 0 },
}, { sequelize });