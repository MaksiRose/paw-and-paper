import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import QuidToServer from './quidToServer';

@Table
export default class TemporaryStatIncrease extends Model {
	@Column({ type: DataType.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true })
	declare id: number;

	@ForeignKey(() => QuidToServer)
	@Column({ type: DataType.INTEGER })
	declare quidToServerId: string;

	@BelongsTo(() => QuidToServer, { foreignKey: 'quidToServerId' })
	declare quidToServer: QuidToServer;

	@Column({ type: DataType.BIGINT, defaultValue: 0 })
	declare startedTimestamp: number;

	@Column({ type: DataType.STRING })
	declare type: string;
}