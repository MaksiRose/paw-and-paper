import { Optional } from 'sequelize';
import { BelongsTo, BelongsToMany, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import Den from './den';
import DiscordUser from './discordUser';
import Group from './group';
import GroupToServer from './groupToServer';
import ProxyLimits from './proxyLimits';
import Quid from './quid';
import QuidToServer from './quidToServer';
import DiscordUserToServer from './discordUserToServer';
import ShopRole from './shopRole';
import User from './user';
import UserToServer from './userToServer';
import Channel from './channel';

interface ServerAttributes {
	id: string;
	nextPossibleAttackTimestamp: number;
	visitChannelId: string | null;
	currentlyVisitingChannelId: string | null;
	skills: string[];
	proxy_logChannelId: string | null;
	proxy_requireTag: boolean;
	proxy_requireTagInDisplayname: boolean;
	proxy_possibleTags: string[];
	proxy_channelLimitsId: string;
	proxy_roleLimitsId: string;
	inventory: string[];
	sleepingDenId: string;
	medicineDenId: string;
	foodDenId: string;
	nameRuleSets: string[];
	logChannelId: string | null;
	logLimitsId: string;
}

type ServerCreationAttributes = Optional<ServerAttributes, 'nextPossibleAttackTimestamp' | 'visitChannelId' | 'currentlyVisitingChannelId' | 'skills' | 'proxy_logChannelId' | 'proxy_requireTag' | 'proxy_requireTagInDisplayname' | 'proxy_possibleTags' | 'inventory' | 'nameRuleSets' | 'logChannelId'>

@Table
export default class Server extends Model<ServerAttributes, ServerCreationAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@Column({ type: DataType.INTEGER, defaultValue: 0 })
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
	@Column({ type: DataType.STRING })
	declare proxy_channelLimitsId: string;

	@BelongsTo(() => ProxyLimits, { foreignKey: 'proxy_channelLimitsId' })
	declare proxy_channelLimits: ProxyLimits;

	@ForeignKey(() => ProxyLimits)
	@Column({ type: DataType.STRING })
	declare proxy_roleLimitsId: string;

	@BelongsTo(() => ProxyLimits, { foreignKey: 'proxy_roleLimitsId' })
	declare proxy_roleLimits: ProxyLimits;

	@Column({ type: DataType.ARRAY(DataType.STRING), defaultValue: [] })
	declare inventory: string[];

	@ForeignKey(() => Den)
	@Column({ type: DataType.STRING })
	declare sleepingDenId: string;

	@BelongsTo(() => Den, { foreignKey: 'sleepingDenId' })
	declare sleepingDen: Den;

	@ForeignKey(() => Den)
	@Column({ type: DataType.STRING })
	declare medicineDenId: string;

	@BelongsTo(() => Den, { foreignKey: 'medicineDenId' })
	declare medicineDen: Den;

	@ForeignKey(() => Den)
	@Column({ type: DataType.STRING })
	declare foodDenId: string;

	@BelongsTo(() => Den, { foreignKey: 'foodDenId' })
	declare foodDen: Den;

	@BelongsToMany(() => User, () => UserToServer)
	declare users: User[];

	@HasMany(() => ShopRole, { foreignKey: 'serverId' })
	declare shopRoles: ShopRole[];

	@HasMany(() => Channel, { foreignKey: 'serverId' })
	declare channels: Channel[];

	@BelongsToMany(() => Group, () => GroupToServer)
	declare groups: Group[];

	@BelongsToMany(() => Quid, () => QuidToServer)
	declare quids: Quid[];

	// Not sure if this is legal
	@HasMany(() => QuidToServer, { foreignKey: 'serverId' })
	declare quidToServers: QuidToServer[];

	@BelongsToMany(() => DiscordUser, () => DiscordUserToServer)
	declare discordUsers: DiscordUser[];

	@Column({ type: DataType.ARRAY(DataType.STRING), defaultValue: [] })
	declare nameRuleSets: string[];

	@Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
	declare logChannelId: string | null;

	@ForeignKey(() => ProxyLimits)
	@Column({ type: DataType.STRING })
	declare logLimitsId: string;

	@BelongsTo(() => ProxyLimits, { foreignKey: 'logLimitsId' })
	declare logLimits: ProxyLimits;
}