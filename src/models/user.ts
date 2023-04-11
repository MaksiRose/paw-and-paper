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
	advice_resting: boolean;
	advice_eating: boolean;
	advice_drinking: boolean;
	advice_passingOut: boolean;
	advice_coloredButtons: boolean;
	advice_sapling: boolean;
	reminders_water: boolean;
	reminders_resting: boolean;
	proxy_editing: boolean;
	proxy_keepInMessage: boolean;
	proxy_setTo: ProxySetTo;
	proxy_lastGlobalProxiedQuidId: string | null;
	lastGlobalActiveQuidId: string | null;
	accessibility_replaceEmojis: boolean;
	tag: string;
	lastPlayedVersion: string;
	antiproxies: string[][]
	lastRecordedTopVote: number;
	nextRedeemableTopVote: number;
	lastRecordedDiscordsVote: number;
	nextRedeemableDiscordsVote: number;
	lastRecordedDblVote: number;
	nextRedeemableDblVote: number;
}

type UserCreationAttributes = Optional<UserAttributes, 'advice_resting' | 'advice_eating' | 'advice_drinking' | 'advice_passingOut' | 'advice_coloredButtons' | 'advice_sapling' | 'reminders_water' | 'reminders_resting' | 'proxy_editing' | 'proxy_keepInMessage' | 'proxy_setTo' | 'accessibility_replaceEmojis' | 'tag' | 'antiproxies' | 'lastRecordedTopVote' | 'nextRedeemableTopVote' | 'lastRecordedDiscordsVote' | 'nextRedeemableDiscordsVote' | 'lastRecordedDblVote' | 'nextRedeemableDblVote'>;

@Table
export default class User extends Model<UserAttributes, UserCreationAttributes> {
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

	@Column({ type: DataType.BOOLEAN, defaultValue: true })
	declare proxy_editing: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare proxy_keepInMessage: boolean;

	@Column({ type: DataType.SMALLINT, allowNull: false, defaultValue: 0 })
	declare proxy_setTo: ProxySetTo;

	@ForeignKey(() => Quid<false>)
	@Column({ type: DataType.STRING, allowNull: true })
	declare proxy_lastGlobalProxiedQuidId: string | null;

	@BelongsTo(() => Quid, { foreignKey: 'proxy_lastGlobalProxiedQuidId' })
	declare proxy_lastGlobalProxiedQuid: Quid | null;

	@ForeignKey(() => Quid<false>)
	@Column({ type: DataType.STRING, allowNull: true })
	declare lastGlobalActiveQuidId: string | null;

	@BelongsTo(() => Quid, { foreignKey: 'proxy_lastGlobalProxiedQuidId' })
	declare lastGlobalActiveQuid: Quid | null;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare accessibility_replaceEmojis: boolean;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare tag: string;

	@Column({ type: DataType.STRING })
	declare lastPlayedVersion: string;

	@Column({ type: DataType.ARRAY(DataType.ARRAY(DataType.STRING)), defaultValue: [] })
	declare antiproxies: string[][];

	@Column({ type: DataType.INTEGER, defaultValue: 0 })
	declare lastRecordedTopVote: number;

	@Column({ type: DataType.INTEGER, defaultValue: 0 })
	declare nextRedeemableTopVote: number;

	@Column({ type: DataType.INTEGER, defaultValue: 0 })
	declare lastRecordedDiscordsVote: number;

	@Column({ type: DataType.INTEGER, defaultValue: 0 })
	declare nextRedeemableDiscordsVote: number;

	@Column({ type: DataType.INTEGER, defaultValue: 0 })
	declare lastRecordedDblVote: number;

	@Column({ type: DataType.INTEGER, defaultValue: 0 })
	declare nextRedeemableDblVote: number;

	@BelongsToMany(() => Server, () => UserToServer)
	declare servers: Server[];

	@HasMany(() => Quid, { foreignKey: 'userId' })
	declare quids: Quid[];

	@HasMany(() => Group, { foreignKey: 'userId' })
	declare groups: Group[];

	@HasMany(() => DiscordUser, { foreignKey: 'userId' })
	declare discordUsers: DiscordUser[];
}