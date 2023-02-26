import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import Quid from './quid';

@Table
export default class Friendship extends Model {
	@Column({ type: DataType.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true })
	declare id: number;

	@ForeignKey(() => Quid)
	@Column({ type: DataType.STRING })
	declare quidId_1: string;

	@BelongsTo(() => Quid, { foreignKey: 'quidId_1' })
	declare quid_1: Quid;

	@ForeignKey(() => Quid)
	@Column({ type: DataType.STRING })
	declare quidId_2: string;

	@BelongsTo(() => Quid, { foreignKey: 'quidId_2' })
	declare quid_2: Quid;

	@Column({ type: DataType.ARRAY(DataType.BIGINT), defaultValue: [] })
	declare quid_1_mentions: number[];

	@Column({ type: DataType.ARRAY(DataType.BIGINT), defaultValue: [] })
	declare quid_2_mentions: number[];
}