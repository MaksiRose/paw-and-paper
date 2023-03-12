import { Column, DataType, Table, Model, BelongsTo, BelongsToMany, ForeignKey, HasMany } from 'sequelize-typescript';
import Server from './server';
import DiscordUserToServer from './discordUserToServer';
import User from './user';
import Webhook from './webhook';

interface DiscordUserAttributes {
	id: string;
	userId: string;
}

@Table
export default class DiscordUser extends Model<DiscordUserAttributes, DiscordUserAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => User)
	@Column({ type: DataType.STRING })
	declare userId: string;

	@BelongsTo(() => User, { foreignKey: 'userId' })
	declare user: User;

	@BelongsToMany(() => Server, () => DiscordUserToServer)
	declare servers: Server[];

	@HasMany(() => Webhook, { foreignKey: 'discordUserId' })
	declare webhooks: Webhook[];
}