import { BelongsTo, BelongsToMany, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import GroupToQuid from './groupToQuid';
import GroupToServer from './groupToServer';
import Quid from './quid';
import Server from './server';
import User from './user';

@Table
export default class Group extends Model {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => User)
	@Column({ type: DataType.STRING })
	declare userId: string;

	@BelongsTo(() => User, { foreignKey: 'userId' })
	declare user: User;

	@Column({ type: DataType.STRING })
	declare name: string;

	@Column({ type: DataType.STRING })
	declare tag: string;

	@BelongsToMany(() => Quid, () => GroupToQuid)
	declare quids: Quid[];

	@BelongsToMany(() => Server, () => GroupToServer)
	declare groups: Server[];

	@HasMany(() => Quid)
	declare mainGroupFor: Quid[];
}