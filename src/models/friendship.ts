import { Optional } from 'sequelize';
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import Quid from './quid';

interface FriendshipAttributes {
	id: string;
	quidId1: string;
	quidId2: string;
	quid1_mentions: number[];
	quid2_mentions: number[];
}

type FriendshipCreationAttributes = Optional<FriendshipAttributes, 'quid1_mentions' | 'quid2_mentions'>

@Table
export default class Friendship extends Model<FriendshipAttributes, FriendshipCreationAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => Quid<false>)
	@Column({ type: DataType.STRING })
	declare quidId1: string;

	@BelongsTo(() => Quid, { foreignKey: 'quidId_1' })
	declare quid1: Quid;

	@ForeignKey(() => Quid<false>)
	@Column({ type: DataType.STRING })
	declare quidId2: string;

	@BelongsTo(() => Quid, { foreignKey: 'quidId_2' })
	declare quid2: Quid;

	@Column({ type: DataType.ARRAY(DataType.BIGINT), defaultValue: [] })
	declare quid1_mentions: number[];

	@Column({ type: DataType.ARRAY(DataType.BIGINT), defaultValue: [] })
	declare quid2_mentions: number[];
}