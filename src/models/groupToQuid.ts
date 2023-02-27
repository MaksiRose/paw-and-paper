import { Optional } from 'sequelize';
import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import Group from './group';
import Quid from './quid';

interface GroupToQuidAttributes {
	id: number;
	groupId: string;
	quidId: string;
}

type GroupToQuidCreationAttributes = Optional<GroupToQuidAttributes, 'id'>

@Table
export default class GroupToQuid extends Model<GroupToQuidAttributes, GroupToQuidCreationAttributes> {
	@Column({ type: DataType.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true })
	declare id: number;

	@ForeignKey(() => Group)
	@Column({ type: DataType.STRING })
	declare groupId: string;

	@ForeignKey(() => Quid<false>)
	@Column({ type: DataType.STRING })
	declare quidId: string;
}