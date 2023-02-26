import { Column, DataType, Table, Model, BelongsTo, BelongsToMany, ForeignKey } from 'sequelize-typescript';
import Server from './server';
import ServerToDiscordUser from './serverToDiscordUser';
import User from './user';

interface DiscordUserAttributes {
	id: string;
	userId: string;
}

@Table
export default class DiscordUser extends Model<DiscordUserAttributes, DiscordUserAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => User)
	@Column({ type: DataType.STRING })
	declare userId: string;

	@BelongsTo(() => User, { foreignKey: 'userId' })
	declare user: User;

	@BelongsToMany(() => Server, () => ServerToDiscordUser)
	declare servers: Server[];
}