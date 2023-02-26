import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import Quid from './quid';

interface WebhookAttributes {
	id: string;
	quidId: string;
}

@Table
export default class Webhook extends Model<WebhookAttributes, WebhookAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => Quid)
	@Column({ type: DataType.STRING })
	declare quidId: string;

	@BelongsTo(() => Quid, { foreignKey: 'quidId' })
	declare quid: Quid;
}