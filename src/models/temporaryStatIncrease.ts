import { Optional } from 'sequelize';
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import QuidToServer from './quidToServer';

interface TemporaryStatIncreaseAttributes {
	id: number;
	quidToServerId: number;
	startedTimestamp: number;
	type: string;
}

type TemporaryStatIncreaseCreationAttributes = Optional<TemporaryStatIncreaseAttributes, 'id'>

@Table
export default class TemporaryStatIncrease extends Model<TemporaryStatIncreaseAttributes, TemporaryStatIncreaseCreationAttributes> {
	@Column({ type: DataType.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true })
	declare id: number;

	@ForeignKey(() => QuidToServer)
	@Column({ type: DataType.INTEGER })
	declare quidToServerId: number;

	@BelongsTo(() => QuidToServer, { foreignKey: 'quidToServerId' })
	declare quidToServer: QuidToServer;

	@Column({ type: DataType.BIGINT })
	declare startedTimestamp: number;

	@Column({ type: DataType.STRING })
	declare type: string;
}