import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import Group from './group';
import Quid from './quid';

@Table
export default class GroupToQuid extends Model {
	@Column({ type: DataType.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true })
	declare id: number;

	@ForeignKey(() => Group)
	@Column({ type: DataType.STRING })
	declare groupId: string;

	@ForeignKey(() => Quid)
	@Column({ type: DataType.STRING })
	declare quidId: string;
}