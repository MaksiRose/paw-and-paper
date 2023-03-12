import { Optional } from 'sequelize';
import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import Group from './group';
import Server from './server';

interface GroupToServerAttributes {
	id: string;
	groupId: string;
	serverId: string;
	tag: string;
}

type GroupToServerOptionalAttributes = Optional<GroupToServerAttributes, 'tag'>

@Table
export default class GroupToServer extends Model<GroupToServerAttributes, GroupToServerOptionalAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => Group)
	@Column({ type: DataType.STRING })
	declare groupId: string;

	@ForeignKey(() => Server)
	@Column({ type: DataType.STRING })
	declare serverId: string;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare tag: string;
}