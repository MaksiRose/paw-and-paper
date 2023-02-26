import { Optional } from 'sequelize';
import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import DiscordUser from './discordUser';
import Server from './server';

interface ServerToDiscordUserAttributes {
	id: number;
	discordUserId: string;
	serverId: string;
	isMember: boolean;
	lastUpdatedTimestamp: number
}

type ServerToDiscordUserCreationAttributes = Optional<ServerToDiscordUserAttributes, 'id' | 'isMember' | 'lastUpdatedTimestamp'>

@Table
export default class ServerToDiscordUser extends Model<ServerToDiscordUserAttributes, ServerToDiscordUserCreationAttributes> {
	@Column({ type: DataType.SMALLINT.UNSIGNED, autoIncrement: true, primaryKey: true })
	declare id: number;

	@ForeignKey(() => DiscordUser)
	@Column({ type: DataType.STRING })
	declare discordUserId: string;

	@ForeignKey(() => Server)
	@Column({ type: DataType.STRING })
	declare serverId: string;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare isMember: boolean;

	@Column({ type: DataType.BIGINT, defaultValue: 0 })
	declare lastUpdatedTimestamp: number;
}