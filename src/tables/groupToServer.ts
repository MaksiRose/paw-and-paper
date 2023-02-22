import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import Group from './group';
import Server from './server';

@Table
export default class GroupToServer extends Model {
	@Column({ type: DataType.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true })
	declare id: number;

	@ForeignKey(() => Group)
	@Column({ type: DataType.STRING })
	declare groupId: string;

	@ForeignKey(() => Server)
	@Column({ type: DataType.STRING })
	declare serverId: string;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare tag: string;
}