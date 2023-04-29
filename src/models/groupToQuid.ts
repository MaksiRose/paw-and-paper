import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import Group from './group';
import Quid from './quid';

interface GroupToQuidAttributes {
	id: string;
	groupId: string;
	quidId: string;
}

@Table
export default class GroupToQuid extends Model<GroupToQuidAttributes, GroupToQuidAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => Group)
	@Column({ type: DataType.STRING })
	declare groupId: string;

	@BelongsTo(() => Group, { foreignKey: 'groupId' })
	declare group: Group;

	@ForeignKey(() => Quid)
	@Column({ type: DataType.STRING })
	declare quidId: string;

	@BelongsTo(() => Quid, { foreignKey: 'quidId' })
	declare quid: Quid;
}