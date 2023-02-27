import { Optional } from 'sequelize';
import { BelongsTo, BelongsToMany, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import Den from './den';
import DiscordUser from './discordUser';
import Group from './group';
import GroupToServer from './groupToServer';
import ProxyLimits from './proxyLimits';
import Quid from './quid';
import QuidToServer from './quidToServer';
import ServerToDiscordUser from './serverToDiscordUser';
import ShopRole from './shopRole';
import User from './user';
import UserToServer from './userToServer';

interface ServerAttributes {
	id: string;
	name: string;
	nextPossibleAttackTimestamp: number;
	visitChannelId: string | null;
	currentlyVisitingChannelId: string | null;
	skills: string[];
	proxy_logChannelId: string | null;
	proxy_requireTag: boolean;
	proxy_requireTagInDisplayname: boolean;
	proxy_possibleTags: string[];
	proxy_channelLimitsId: number;
	proxy_roleLimitsId: number;
	inventory: string[];
	sleepingDenId: number;
	medicineDenId: number;
	foodDenId: number;
}

type ServerCreationAttributes = Optional<ServerAttributes, 'nextPossibleAttackTimestamp' | 'visitChannelId' | 'currentlyVisitingChannelId' | 'skills' | 'proxy_logChannelId' | 'proxy_requireTag' | 'proxy_requireTagInDisplayname' | 'proxy_possibleTags' | 'inventory'>

@Table
export default class Server extends Model<ServerAttributes, ServerCreationAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@Column({ type: DataType.STRING })
	declare name: string;

	@Column({ type: DataType.BIGINT, defaultValue: 0 })
	declare nextPossibleAttackTimestamp: number;

	@Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
	declare visitChannelId: string | null;

	@Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
	declare currentlyVisitingChannelId: string | null;

	@Column({ type: DataType.ARRAY(DataType.STRING), defaultValue: ['strength', 'dexterity', 'constitution', 'charisma', 'wisdom', 'intelligence'] })
	declare skills: string[];

	@Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
	declare proxy_logChannelId: string | null;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare proxy_requireTag: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare proxy_requireTagInDisplayname: boolean;

	@Column({ type: DataType.ARRAY(DataType.STRING), defaultValue: [] })
	declare proxy_possibleTags: string[];

	@ForeignKey(() => ProxyLimits)
	@Column({ type: DataType.INTEGER.UNSIGNED })
	declare proxy_channelLimitsId: number;

	@BelongsTo(() => ProxyLimits, { foreignKey: 'proxy_channelLimitsId' })
	declare proxy_channelLimits: ProxyLimits;

	@ForeignKey(() => ProxyLimits)
	@Column({ type: DataType.INTEGER.UNSIGNED })
	declare proxy_roleLimitsId: number;

	@BelongsTo(() => ProxyLimits, { foreignKey: 'proxy_roleLimitsId' })
	declare proxy_roleLimits: ProxyLimits;

	@Column({ type: DataType.ARRAY(DataType.STRING), defaultValue: [] })
	declare inventory: string[];

	@ForeignKey(() => Den)
	@Column({ type: DataType.INTEGER.UNSIGNED })
	declare sleepingDenId: number;

	@BelongsTo(() => Den, { foreignKey: 'sleepingDenId' })
	declare sleepingDen: Den;

	@ForeignKey(() => Den)
	@Column({ type: DataType.INTEGER.UNSIGNED })
	declare medicineDenId: number;

	@BelongsTo(() => Den, { foreignKey: 'medicineDenId' })
	declare medicineDen: Den;

	@ForeignKey(() => Den)
	@Column({ type: DataType.INTEGER.UNSIGNED })
	declare foodDenId: number;

	@BelongsTo(() => Den, { foreignKey: 'foodDenId' })
	declare foodDen: Den;

	@BelongsToMany(() => User, () => UserToServer)
	declare users: User[];

	@HasMany(() => ShopRole, { foreignKey: 'serverId' })
	declare shopRoles: ShopRole[];

	@BelongsToMany(() => Group, () => GroupToServer)
	declare groups: Group[];

	@BelongsToMany(() => Quid, () => QuidToServer)
	declare quids: Quid[];

	// Not sure if this is legal
	@HasMany(() => QuidToServer, { foreignKey: 'serverId' })
	declare quidToServers: QuidToServer[];

	@BelongsToMany(() => DiscordUser, () => ServerToDiscordUser)
	declare discordUsers: DiscordUser[];
}