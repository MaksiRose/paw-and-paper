import { Optional } from 'sequelize';
import { BelongsTo, BelongsToMany, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import DiscordUser from './discordUser';
import Group from './group';
import Quid from './quid';
import Server from './server';
import UserToServer from './userToServer';

export enum ProxySetTo {
	off = 0,
	onWithSelectMode = 1,
	onWithStickyMode = 2
}

interface UserAttributes {
	id: string;
	proxy_editing: boolean;
	proxy_keepInMessage: boolean;
	proxy_setTo: ProxySetTo;
	proxy_lastGlobalProxiedQuidId: string | null;
	lastGlobalActiveQuidId: string | null;
	tag: string;
	lastPlayedVersion: string;
	antiproxies: string[][]
}

type UserCreationAttributes = Optional<UserAttributes, 'proxy_editing' | 'proxy_keepInMessage' | 'proxy_setTo' | 'tag' | 'antiproxies'>;

@Table
export default class User extends Model<UserAttributes, UserCreationAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@Column({ type: DataType.BOOLEAN, defaultValue: true })
	declare proxy_editing: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare proxy_keepInMessage: boolean;

	@Column({ type: DataType.SMALLINT, allowNull: false, defaultValue: 0 })
	declare proxy_setTo: ProxySetTo;

	@ForeignKey(() => Quid)
	@Column({ type: DataType.STRING, allowNull: true })
	declare proxy_lastGlobalProxiedQuidId: string | null;

	@BelongsTo(() => Quid, { foreignKey: 'proxy_lastGlobalProxiedQuidId' })
	declare proxy_lastGlobalProxiedQuid: Quid | null;

	@ForeignKey(() => Quid)
	@Column({ type: DataType.STRING, allowNull: true })
	declare lastGlobalActiveQuidId: string | null;

	@BelongsTo(() => Quid, { foreignKey: 'proxy_lastGlobalProxiedQuidId' })
	declare lastGlobalActiveQuid: Quid | null;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare tag: string;

	@Column({ type: DataType.STRING })
	declare lastPlayedVersion: string;

	@Column({ type: DataType.ARRAY(DataType.ARRAY(DataType.STRING)), defaultValue: [] })
	declare antiproxies: string[][];

	@BelongsToMany(() => Server, () => UserToServer)
	declare servers: Server[];

	@HasMany(() => Quid, { foreignKey: 'userId' })
	declare quids: Quid[];

	@HasMany(() => Group, { foreignKey: 'userId' })
	declare groups: Group[];

	@HasMany(() => DiscordUser, { foreignKey: 'userId' })
	declare discordUsers: DiscordUser[];
}