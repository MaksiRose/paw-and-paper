import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import Quid from './quid';

@Table
export default class Webhook extends Model {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => Quid)
	@Column({ type: DataType.STRING })
	declare quidId: string;

	@BelongsTo(() => Quid, { foreignKey: 'quidId' })
	declare quid: Quid;
}