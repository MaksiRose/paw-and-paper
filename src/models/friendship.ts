import { Optional } from 'sequelize';
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import Quid from './quid';

interface FriendshipAttributes {
	id: number;
	quidId_1: string;
	quidId_2: string;
	quid_1_mentions: number[];
	quid_2_mentions: number[];
}

type FriendshipCreationAttributes = Optional<FriendshipAttributes, 'id' | 'quid_1_mentions' | 'quid_2_mentions'>

@Table
export default class Friendship extends Model<FriendshipAttributes, FriendshipCreationAttributes> {
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