import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { StatIncreaseType } from '../typings/data/user';
import QuidToServer from './quidToServer';

interface TemporaryStatIncreaseAttributes {
	id: string;
	quidToServerId: string;
	startedTimestamp: number;
	type: StatIncreaseType;
}

@Table
export default class TemporaryStatIncrease extends Model<TemporaryStatIncreaseAttributes, TemporaryStatIncreaseAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => QuidToServer)
	@Column({ type: DataType.STRING })
	declare quidToServerId: string;

	@BelongsTo(() => QuidToServer, { foreignKey: 'quidToServerId' })
	declare quidToServer: QuidToServer;

	@Column({ type: DataType.BIGINT })
	declare startedTimestamp: number;

	@Column({ type: DataType.STRING })
	declare type: StatIncreaseType;
}