import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import DiscordUser from './discordUser';
import Quid from './quid';

interface WebhookAttributes {
	id: string;
	quidId: string;
	discordUserId: string;
}

@Table
export default class Webhook extends Model<WebhookAttributes, WebhookAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => Quid<false>)
	@Column({ type: DataType.STRING })
	declare quidId: string;

	@BelongsTo(() => Quid, { foreignKey: 'quidId' })
	declare quid: Quid;

	@ForeignKey(() => DiscordUser)
	@Column({ type: DataType.STRING })
	declare discordUserId: string;

	@BelongsTo(() => DiscordUser, { foreignKey: 'discordUserId' })
	declare discordUser: DiscordUser;
}