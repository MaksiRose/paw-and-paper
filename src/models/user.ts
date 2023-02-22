import { BelongsToMany, Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';
import DiscordUser from './discordUser';
import Group from './group';
import Quid from './quid';
import Server from './server';
import UserToServer from './userToServer';

@Table
export default class User extends Model {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare advice_resting: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare advice_eating: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare advice_drinking: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare advice_passingOut: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare advice_coloredButtons: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare advice_sapling: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: true })
	declare reminders_water: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: true })
	declare reminders_resting: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare proxy_globalAutoproxy: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare proxy_globalStickymode: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare accessibility_replaceEmojis: boolean;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare tag: string;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare lastPlayedVersion: string;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare antiproxy_startsWith: string;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare antiproxy_endsWith: string;

	@BelongsToMany(() => Server, () => UserToServer)
	declare servers: Server[];

	@HasMany(() => Quid, { foreignKey: 'userId' })
	declare quids: Quid[];

	@HasMany(() => Group, { foreignKey: 'userId' })
	declare groups: Group[];

	@HasMany(() => DiscordUser, { foreignKey: 'userId' })
	declare discordUsers: DiscordUser;
}