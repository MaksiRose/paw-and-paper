import { Column, DataType, Table, Model, BelongsTo, BelongsToMany } from 'sequelize-typescript';
import Server from './server';
import ServerToDiscordUser from './serverToDiscordUser';
import User from './user';

@Table
export default class DiscordUser extends Model {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@Column({ type: DataType.STRING })
	declare userId: string;

	@BelongsTo(() => User, { foreignKey: 'userId' })
	declare user: User;

	@BelongsToMany(() => Server, () => ServerToDiscordUser)
	declare servers: Server[];
}